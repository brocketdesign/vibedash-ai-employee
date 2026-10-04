import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCompanyBySlug } from "@/lib/employee/companies";
import {
  connectUrl,
  ensureProfile,
  listAccounts,
  recentPosts,
  tweet,
  zernioConfigured,
  type Platform,
} from "@/lib/employee/zernio";
import { baseUrl } from "@/lib/employee/runtime";

export const runtime = "nodejs";

type Params = { params: Promise<{ slug: string }> };

const PLATFORMS: Platform[] = [
  "twitter", "instagram", "facebook", "linkedin", "tiktok", "youtube",
  "pinterest", "reddit", "bluesky", "threads", "googlebusiness", "telegram",
];

/** Connected accounts + recent posts for the dashboard's Twitter panel. */
export async function GET(_request: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const company = await getCompanyBySlug(userId, slug);
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  if (!zernioConfigured()) {
    return NextResponse.json({ configured: false, accounts: [], posts: [] });
  }

  try {
    const profileId = await ensureProfile(company);
    const [accounts, posts] = await Promise.all([
      listAccounts(profileId),
      recentPosts(company._id!.toString(), 10),
    ]);
    return NextResponse.json({ configured: true, profileId, accounts, posts });
  } catch (e) {
    console.error("[social] list failed", e);
    return NextResponse.json(
      { configured: true, accounts: [], posts: [], error: e instanceof Error ? e.message : "Zernio error" },
      { status: 502 },
    );
  }
}

/**
 * Two actions:
 *   { action: "connect", platform }  → OAuth URL to attach an account
 *   { action: "post", content }      → publish now (or schedule)
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const company = await getCompanyBySlug(userId, slug);
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  if (!zernioConfigured()) {
    return NextResponse.json(
      { error: "Social posting is not configured on this deployment (ZERNIO_API_KEY)." },
      { status: 503 },
    );
  }

  let body: { action?: string; platform?: string; content?: string; scheduledFor?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const profileId = await ensureProfile(company);

    if (body.action === "connect") {
      const platform = (body.platform || "twitter") as Platform;
      if (!PLATFORMS.includes(platform)) {
        return NextResponse.json({ error: `Unsupported platform "${platform}".` }, { status: 400 });
      }
      const redirect = `${baseUrl()}/dashboard/${company.slug}?connected=${platform}`;
      const authUrl = await connectUrl(profileId, platform, redirect);
      return NextResponse.json({ authUrl });
    }

    if (body.action === "post") {
      const content = (body.content || "").trim();
      if (!content) return NextResponse.json({ error: "Nothing to post." }, { status: 400 });
      const result = await tweet(company, content, { scheduledFor: body.scheduledFor });
      if (!result.posted) return NextResponse.json({ error: result.detail }, { status: 409 });
      return NextResponse.json({ ok: true, detail: result.detail, postId: result.postId });
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (e) {
    console.error("[social] action failed", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Zernio request failed." },
      { status: 502 },
    );
  }
}
