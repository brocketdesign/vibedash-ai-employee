// ============================================================
// Zernio — the employee's social media hands (auto-posting to X)
// ============================================================
//
// Zernio owns the OAuth tokens and the posting queue for every platform. We
// keep one Zernio *profile* per company so a user running several companies
// never has one company's employee tweeting from another's account.
//
// The API key is server-side only and never reaches the browser.

import { companies, getDb, COLLECTIONS } from "./db";
import type { CompanyDoc } from "./types";

const BASE_URL = process.env.ZERNIO_BASE_URL || "https://zernio.com/api/v1";

export type Platform =
  | "twitter" | "instagram" | "facebook" | "linkedin" | "tiktok" | "youtube"
  | "pinterest" | "reddit" | "bluesky" | "threads" | "googlebusiness"
  | "telegram" | "snapchat" | "whatsapp";

/** Platforms that silently fail without a media item attached. */
export const NEEDS_IMAGE: Platform[] = ["instagram", "facebook", "pinterest", "googlebusiness"];
export const NEEDS_VIDEO: Platform[] = ["tiktok", "youtube", "snapchat"];

export interface SocialAccount {
  id: string;
  platform: Platform;
  username: string;
  displayName: string;
  isActive: boolean;
}

export class ZernioError extends Error {
  constructor(
    message: string,
    readonly status = 500,
  ) {
    super(message);
    this.name = "ZernioError";
  }
}

export function zernioConfigured(): boolean {
  return Boolean(process.env.ZERNIO_API_KEY);
}

async function request<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const key = process.env.ZERNIO_API_KEY;
  if (!key) throw new ZernioError("ZERNIO_API_KEY is not configured.", 503);

  const res = await fetch(`${BASE_URL}${path}`, {
    method: init.method || "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });

  const text = await res.text().catch(() => "");
  if (!res.ok) {
    let message = `Zernio ${res.status}`;
    try {
      const parsed = JSON.parse(text) as { message?: string; error?: string };
      message = parsed.message || parsed.error || message;
    } catch {
      message = `${message}: ${text.slice(0, 200)}`;
    }
    console.error(`[zernio] ${init.method || "GET"} ${path} → ${res.status} ${message}`);
    throw new ZernioError(message, res.status);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

// ─── Profiles ───────────────────────────────────────────────────────────────

/**
 * Return this company's Zernio profile id, creating the profile on first use
 * and caching it on the company document.
 */
export async function ensureProfile(company: CompanyDoc): Promise<string> {
  if (company.infra.zernioProfileId) return company.infra.zernioProfileId;

  const created = await request<{ profile: { _id: string } }>("/profiles", {
    method: "POST",
    body: {
      name: company.name,
      description: `Managed by the VibeDash AI employee for ${company.name}`,
      color: "#ea580c",
    },
  });

  const profileId = created.profile?._id;
  if (!profileId) throw new ZernioError("Zernio did not return a profile id.");

  const col = await companies();
  await col.updateOne(
    { _id: company._id },
    { $set: { "infra.zernioProfileId": profileId, updatedAt: new Date() } },
  );
  company.infra.zernioProfileId = profileId;
  return profileId;
}

/** OAuth URL the user visits to connect an account to this company. */
export async function connectUrl(
  profileId: string,
  platform: Platform,
  redirectUrl: string,
): Promise<string> {
  const params = new URLSearchParams({ profileId, redirectUrl });
  const result = await request<{ authUrl: string }>(
    `/connect/${platform}?${params.toString()}`,
  );
  if (!result.authUrl) throw new ZernioError("Zernio did not return an auth URL.");
  return result.authUrl;
}

// ─── Accounts ───────────────────────────────────────────────────────────────

export async function listAccounts(profileId: string): Promise<SocialAccount[]> {
  const result = await request<{
    accounts?: Array<{
      _id: string;
      platform: Platform;
      username?: string;
      displayName?: string;
      isActive?: boolean;
    }>;
  }>(`/accounts?profileId=${encodeURIComponent(profileId)}`);

  return (result.accounts || []).map((a) => ({
    id: a._id,
    platform: a.platform,
    username: a.username || "",
    displayName: a.displayName || a.username || "",
    isActive: a.isActive !== false,
  }));
}

export async function disconnectAccount(accountId: string): Promise<void> {
  await request(`/accounts/${accountId}`, { method: "DELETE" });
}

// ─── Posting ────────────────────────────────────────────────────────────────

export interface PostInput {
  content: string;
  platforms: Array<{ platform: Platform; accountId: string }>;
  mediaItems?: Array<{ url: string }>;
  /** Publish immediately; omit and pass `scheduledFor` to queue it instead. */
  publishNow?: boolean;
  scheduledFor?: string;
  timezone?: string;
}

export async function createPost(input: PostInput): Promise<{ id: string }> {
  for (const target of input.platforms) {
    const needsMedia =
      NEEDS_IMAGE.includes(target.platform) || NEEDS_VIDEO.includes(target.platform);
    if (needsMedia && !input.mediaItems?.length) {
      throw new ZernioError(
        `${target.platform} posts require a media item — none was attached.`,
        400,
      );
    }
  }

  const result = await request<{ post: { _id: string } }>("/posts", {
    method: "POST",
    body: input,
  });
  return { id: result.post?._id || "" };
}

export interface UsageStats {
  planName: string;
  limits: { uploads?: number; profiles?: number };
  usage: { uploads?: number; profiles?: number; lastReset?: string };
}

export async function usageStats(): Promise<UsageStats | null> {
  try {
    return await request<UsageStats>("/usage-stats");
  } catch {
    return null;
  }
}

// ─── High level: what the employee calls ────────────────────────────────────

/**
 * Post to X for a company. Resolves the profile and the connected Twitter
 * account itself, records the post locally, and returns a human-readable
 * outcome the task report can quote.
 */
export async function tweet(
  company: CompanyDoc,
  content: string,
  opts?: { mediaUrl?: string; scheduledFor?: string },
): Promise<{ posted: boolean; postId?: string; detail: string; url?: string }> {
  if (!zernioConfigured()) {
    return { posted: false, detail: "Zernio is not configured — no social account connected." };
  }

  const profileId = await ensureProfile(company);
  const accounts = await listAccounts(profileId);
  const twitter = accounts.find((a) => a.platform === "twitter" && a.isActive);

  if (!twitter) {
    return {
      posted: false,
      detail: "No X account is connected to this company yet — connect one to enable auto-posting.",
    };
  }

  const post = await createPost({
    content: content.slice(0, 4000),
    platforms: [{ platform: "twitter", accountId: twitter.id }],
    mediaItems: opts?.mediaUrl ? [{ url: opts.mediaUrl }] : undefined,
    publishNow: opts?.scheduledFor ? undefined : true,
    scheduledFor: opts?.scheduledFor,
    timezone: opts?.scheduledFor ? "UTC" : undefined,
  });

  await recordPost(company, content, twitter, post.id, opts?.scheduledFor);

  return {
    posted: true,
    postId: post.id,
    detail: opts?.scheduledFor
      ? `Queued to @${twitter.username} for ${opts.scheduledFor}.`
      : `Posted to @${twitter.username}.`,
    url: twitter.username ? `https://x.com/${twitter.username}` : undefined,
  };
}

async function recordPost(
  company: CompanyDoc,
  content: string,
  account: SocialAccount,
  zernioPostId: string,
  scheduledFor?: string,
): Promise<void> {
  try {
    const db = await getDb();
    await db.collection(COLLECTIONS.social).insertOne({
      companyId: company._id?.toString(),
      userId: company.userId,
      platform: account.platform,
      accountId: account.id,
      username: account.username,
      content,
      zernioPostId,
      status: scheduledFor ? "scheduled" : "published",
      scheduledFor: scheduledFor ? new Date(scheduledFor) : null,
      createdAt: new Date(),
    });
  } catch (e) {
    console.error("[zernio] recordPost failed", e);
  }
}

/** Recent posts this company's employee has sent, newest first. */
export async function recentPosts(companyId: string, limit = 10) {
  const db = await getDb();
  const rows = await db
    .collection(COLLECTIONS.social)
    .find({ companyId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();

  return rows.map((r) => ({
    id: String(r._id),
    platform: String(r.platform || "twitter"),
    username: String(r.username || ""),
    content: String(r.content || ""),
    status: String(r.status || "published"),
    createdAt: (r.createdAt instanceof Date ? r.createdAt : new Date()).toISOString(),
  }));
}
