// ============================================================
// Companies — what the AI employee is hired to run
// ============================================================

import { ObjectId } from "mongodb";
import { companies, documents, ensureIndexes, logActivity, tasks, uniqueSlug } from "./db";
import { completeJson } from "./model";
import { recordAiSpend } from "./plan";
import type { CompanyDoc, CompanyOrigin, CompanyView, TaskView } from "./types";

export interface CreateCompanyInput {
  userId: string;
  name: string;
  /** What the founder typed on /new — a sentence about the idea or business. */
  pitch: string;
  origin: CompanyOrigin;
  /** Existing companies can hand over a site to work from. */
  existingUrl?: string;
}

/**
 * Create a company. The founder types one sentence; the employee turns it into
 * the profile it will optimise against for the rest of its life — mission,
 * offer, audience, price. Getting the price on the record at minute one is
 * deliberate: a company with no price has nothing to make money with.
 */
export async function createCompany(input: CreateCompanyInput): Promise<CompanyDoc> {
  await ensureIndexes();

  const name = input.name.trim().slice(0, 80) || "Untitled Company";
  const slug = await uniqueSlug(input.userId, name);

  const profile = await draftProfile(input, name);

  const now = new Date();
  const doc: CompanyDoc = {
    userId: input.userId,
    slug,
    name,
    mission: profile.mission,
    offer: profile.offer,
    audience: profile.audience,
    pricePoint: profile.pricePoint,
    origin: input.origin,
    status: "draft",
    autoMode: true,
    metrics: {
      visitors: 0,
      revenue: 0,
      mrr: 0,
      signups: 0,
      updatedAt: now.toISOString(),
    },
    infra: {
      vpsStatus: "none",
      siteUrl: input.existingUrl?.trim() || undefined,
    },
    knowledge: "",
    createdAt: now,
    updatedAt: now,
  };

  const col = await companies();
  const result = await col.insertOne(doc);
  doc._id = result.insertedId;

  const companyId = result.insertedId.toString();

  // File the mission document so the founder has something to read immediately.
  const docCol = await documents();
  await docCol.insertOne({
    companyId,
    userId: input.userId,
    title: `${name} Mission`,
    kind: "mission",
    body: [
      `# ${name}`,
      "",
      `## Mission`,
      profile.mission,
      "",
      `## What we sell`,
      profile.offer,
      "",
      `## Who buys it`,
      profile.audience,
      "",
      `## Price`,
      profile.pricePoint,
      "",
      `## How this makes money`,
      profile.moneyPath,
    ].join("\n"),
    createdAt: now,
    updatedAt: now,
  });

  await logActivity(companyId, input.userId, "success", `${name} created — your employee starts tonight.`);

  return doc;
}

interface DraftedProfile {
  mission: string;
  offer: string;
  audience: string;
  pricePoint: string;
  moneyPath: string;
}

/** Turn one sentence into a working company profile. */
async function draftProfile(
  input: CreateCompanyInput,
  name: string,
): Promise<DraftedProfile> {
  const fallback: DraftedProfile = {
    mission: input.pitch.slice(0, 500) || `Build ${name} into a profitable business.`,
    offer: input.pitch.slice(0, 300) || "To be defined on the first night shift.",
    audience: "To be defined on the first night shift.",
    pricePoint: "$20/month",
    moneyPath: "To be defined on the first night shift.",
  };

  try {
    const drafted = await completeJson<DraftedProfile>({
      deep: true,
      maxTokens: 1200,
      messages: [
        {
          role: "system",
          content:
            "You turn a founder's one-line idea into a company profile an AI employee can act on. " +
            "You are commercially blunt: you name a real price and a real buyer rather than hedging. " +
            "If the idea has no plausible buyer, say so in the moneyPath rather than pretending.",
        },
        {
          role: "user",
          content: `Company name: ${name}
${input.origin === "existing" ? "This is an EXISTING business the founder wants to grow." : "This is a NEW company starting from scratch."}
${input.existingUrl ? `Existing site: ${input.existingUrl}` : ""}

What the founder said: "${input.pitch}"

Reply with JSON only:
{
  "mission": "2-3 sentences. What this company is for, and what winning looks like in numbers.",
  "offer": "What exactly is sold — the product or service, concretely.",
  "audience": "Who pays, specific enough to find them. Not 'small businesses'.",
  "pricePoint": "A specific price, e.g. '$49/month' or '$500 one-time'. Pick one; do not offer a range.",
  "moneyPath": "The shortest honest path from today to the first dollar, in 2-3 sentences."
}`,
        },
      ],
    });

    await recordAiSpend(input.userId, 0.01);

    if (!drafted?.mission) return fallback;
    return {
      mission: String(drafted.mission).slice(0, 1000),
      offer: String(drafted.offer || fallback.offer).slice(0, 600),
      audience: String(drafted.audience || fallback.audience).slice(0, 600),
      pricePoint: String(drafted.pricePoint || fallback.pricePoint).slice(0, 100),
      moneyPath: String(drafted.moneyPath || fallback.moneyPath).slice(0, 1000),
    };
  } catch (e) {
    console.error("[companies] draftProfile failed", e);
    return fallback;
  }
}

// ─── Reads ──────────────────────────────────────────────────────────────────

export async function listCompanies(userId: string): Promise<CompanyDoc[]> {
  await ensureIndexes();
  const col = await companies();
  return col.find({ userId }).sort({ createdAt: -1 }).toArray();
}

export async function getCompanyBySlug(
  userId: string,
  slug: string,
): Promise<CompanyDoc | null> {
  const col = await companies();
  return col.findOne({ userId, slug });
}

export async function getCompanyById(
  userId: string,
  id: string,
): Promise<CompanyDoc | null> {
  if (!ObjectId.isValid(id)) return null;
  const col = await companies();
  return col.findOne({ _id: new ObjectId(id), userId });
}

export async function updateCompany(
  userId: string,
  slug: string,
  patch: Partial<
    Pick<CompanyDoc, "name" | "mission" | "offer" | "audience" | "pricePoint" | "autoMode" | "status" | "knowledge">
  >,
): Promise<CompanyDoc | null> {
  const col = await companies();
  const result = await col.findOneAndUpdate(
    { userId, slug },
    { $set: { ...patch, updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  return result ?? null;
}

export async function deleteCompany(userId: string, slug: string): Promise<boolean> {
  const col = await companies();
  const company = await col.findOne({ userId, slug });
  if (!company) return false;

  const companyId = company._id!.toString();
  const taskCol = await tasks();
  const docCol = await documents();
  await Promise.all([
    col.deleteOne({ _id: company._id }),
    taskCol.deleteMany({ companyId }),
    docCol.deleteMany({ companyId }),
  ]);
  return true;
}

// ─── Mapping ────────────────────────────────────────────────────────────────

export function mapCompany(doc: CompanyDoc): CompanyView {
  return {
    id: doc._id!.toString(),
    slug: doc.slug,
    name: doc.name,
    mission: doc.mission,
    offer: doc.offer,
    audience: doc.audience,
    pricePoint: doc.pricePoint,
    origin: doc.origin,
    status: doc.status,
    autoMode: doc.autoMode,
    metrics: doc.metrics,
    infra: doc.infra,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function mapTask(doc: {
  taskId: string;
  title: string;
  brief: string;
  kind: TaskView["kind"];
  status: TaskView["status"];
  tonight: boolean;
  moneyScore: number;
  rationale: string;
  createdBy: "employee" | "user";
  result?: TaskView["result"];
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}): TaskView {
  return {
    id: doc.taskId,
    title: doc.title,
    brief: doc.brief,
    kind: doc.kind,
    status: doc.status,
    tonight: doc.tonight,
    moneyScore: doc.moneyScore,
    rationale: doc.rationale,
    createdBy: doc.createdBy,
    result: doc.result,
    error: doc.error ?? null,
    createdAt: doc.createdAt.toISOString(),
    completedAt: doc.completedAt ? doc.completedAt.toISOString() : null,
  };
}
