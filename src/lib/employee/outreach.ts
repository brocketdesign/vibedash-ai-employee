// ============================================================
// Cold outreach — the employee's email arm
// ============================================================
//
// Sending on behalf of a company is the one capability that can damage a real
// person's reputation if it misfires, so the rules here are deliberately tight:
//
//   • Every send is logged with its full body, recipient and task id.
//   • A company can send at most OUTREACH_DAILY_CAP messages per UTC day.
//   • The same address is never contacted twice by the same company.
//   • Every message carries a real reply-to and an opt-out line.
//
// The employee drafts; this module is the only thing that actually sends.

import { sendEmail } from "@/lib/email-service";
import { COLLECTIONS, getDb } from "./db";
import type { CompanyDoc } from "./types";

export const OUTREACH_DAILY_CAP = 25;

export interface Prospect {
  email: string;
  name?: string;
  company?: string;
  /** Why the employee thinks this person is a fit — used to personalise. */
  reason?: string;
}

export interface OutreachResult {
  sent: number;
  skipped: number;
  failures: number;
  detail: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

export function outreachConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/** How many messages this company has already sent today (UTC). */
export async function sentToday(companyId: string): Promise<number> {
  const db = await getDb();
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  return db
    .collection(COLLECTIONS.outreach)
    .countDocuments({ companyId, status: "sent", createdAt: { $gte: since } });
}

async function alreadyContacted(companyId: string, email: string): Promise<boolean> {
  const db = await getDb();
  const hit = await db
    .collection(COLLECTIONS.outreach)
    .findOne({ companyId, to: email.toLowerCase() });
  return Boolean(hit);
}

/**
 * Send one campaign. `subject` and `body` are templates: `{{name}}`,
 * `{{company}}` and `{{reason}}` are substituted per prospect. Body is plain
 * text — it is wrapped in minimal HTML so it reads like a person wrote it, not
 * a marketing blast.
 */
export async function sendCampaign(
  company: CompanyDoc,
  prospects: Prospect[],
  subject: string,
  body: string,
  opts?: { taskId?: string; replyTo?: string },
): Promise<OutreachResult> {
  if (!outreachConfigured()) {
    return {
      sent: 0,
      skipped: prospects.length,
      failures: 0,
      detail: "RESEND_API_KEY is not configured — drafted but not sent.",
    };
  }

  const companyId = company._id?.toString() || "";
  const db = await getDb();
  const already = await sentToday(companyId);
  let remaining = Math.max(0, OUTREACH_DAILY_CAP - already);

  let sent = 0;
  let skipped = 0;
  let failures = 0;

  for (const prospect of prospects) {
    const to = prospect.email.trim().toLowerCase();

    if (!isValidEmail(to) || (await alreadyContacted(companyId, to))) {
      skipped++;
      continue;
    }
    if (remaining <= 0) {
      skipped++;
      continue;
    }

    const personalisedSubject = fill(subject, prospect, company);
    const personalisedBody = fill(body, prospect, company);

    try {
      await sendEmail({
        to,
        subject: personalisedSubject,
        html: renderHtml(personalisedBody, company, opts?.replyTo),
        replyTo: opts?.replyTo || company.infra.fromEmail,
        tags: [{ name: "kind", value: "outreach" }],
      });

      await db.collection(COLLECTIONS.outreach).insertOne({
        companyId,
        userId: company.userId,
        taskId: opts?.taskId,
        to,
        name: prospect.name || "",
        subject: personalisedSubject,
        body: personalisedBody,
        status: "sent",
        createdAt: new Date(),
      });

      sent++;
      remaining--;
      // Space the sends out so a burst never trips a provider's rate limits.
      await sleep(700);
    } catch (e) {
      failures++;
      await db.collection(COLLECTIONS.outreach).insertOne({
        companyId,
        userId: company.userId,
        taskId: opts?.taskId,
        to,
        subject: personalisedSubject,
        body: personalisedBody,
        status: "failed",
        error: e instanceof Error ? e.message : String(e),
        createdAt: new Date(),
      });
    }
  }

  const capped = remaining <= 0 && skipped > 0;
  return {
    sent,
    skipped,
    failures,
    detail:
      `${sent} sent, ${skipped} skipped${capped ? ` (daily cap of ${OUTREACH_DAILY_CAP} reached)` : ""}` +
      (failures ? `, ${failures} failed` : ""),
  };
}

function fill(template: string, prospect: Prospect, company: CompanyDoc): string {
  return template
    .replace(/\{\{\s*name\s*\}\}/gi, prospect.name || "there")
    .replace(/\{\{\s*company\s*\}\}/gi, prospect.company || "your team")
    .replace(/\{\{\s*reason\s*\}\}/gi, prospect.reason || "")
    .replace(/\{\{\s*sender\s*\}\}/gi, company.name);
}

function renderHtml(body: string, company: CompanyDoc, replyTo?: string): string {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

  const contact = replyTo || company.infra.fromEmail || "";

  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:#111;max-width:560px;">
${paragraphs}
<p style="margin:24px 0 0;font-size:12px;color:#888;">
Sent by ${escapeHtml(company.name)}${contact ? ` · <a href="mailto:${escapeHtml(contact)}" style="color:#888;">${escapeHtml(contact)}</a>` : ""}<br>
Not relevant? Reply "no thanks" and you won't hear from us again.
</p>
</div>`;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Outreach history for the dashboard's Email panel. */
export async function outreachHistory(companyId: string, limit = 20) {
  const db = await getDb();
  const rows = await db
    .collection(COLLECTIONS.outreach)
    .find({ companyId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();

  return rows.map((r) => ({
    id: String(r._id),
    to: String(r.to || ""),
    subject: String(r.subject || ""),
    status: String(r.status || "sent"),
    createdAt: (r.createdAt instanceof Date ? r.createdAt : new Date()).toISOString(),
  }));
}

export async function outreachCounts(companyId: string) {
  const db = await getDb();
  const [sent, replies] = await Promise.all([
    db.collection(COLLECTIONS.outreach).countDocuments({ companyId, status: "sent" }),
    db.collection(COLLECTIONS.outreach).countDocuments({ companyId, replied: true }),
  ]);
  return { sent, replies };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
