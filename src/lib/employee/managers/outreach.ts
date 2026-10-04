import { sendCampaign, sentToday, OUTREACH_DAILY_CAP, type Prospect } from "../outreach";
import { companyBrief, done, failed, type ManagerAgent } from "./types";

/**
 * Outreach manager — cold email to a researched list.
 *
 * This is the highest-variance capability the employee has, and the only one
 * that touches strangers' inboxes, so it refuses to guess: it will not invent
 * email addresses. It sends only to addresses that arrived in its input, and it
 * routes everything through the capped, deduplicated sender in ../outreach.
 */
export const outreachManager: ManagerAgent = {
  id: "outreach",
  title: "Cold outreach",
  kind: "outreach",
  description:
    "Write and send a personalised cold email campaign to a list of real prospects. " +
    "Requires actual email addresses supplied by the user or gathered by a prior research task.",
  moneyPath:
    "The shortest path to first revenue when the offer is high-ticket or B2B: 25 good emails " +
    "at a 2-5% reply rate is one conversation, and one conversation is one customer. " +
    "Worthless without a real list — do not pick this before a list exists.",
  requires: ["email"],
  inputSchema: {
    type: "object",
    properties: {
      prospects: {
        type: "array",
        description:
          "Real prospects to contact. Never invent these — they must come from the user or a research artifact.",
        items: {
          type: "object",
          properties: {
            email: { type: "string" },
            name: { type: "string" },
            company: { type: "string" },
            reason: { type: "string", description: "Why this person is a fit." },
          },
          required: ["email"],
        },
      },
      goal: {
        type: "string",
        description: "What a reply should lead to — a call, a trial, a reply with a question.",
      },
    },
    required: ["prospects", "goal"],
  },

  async run(input, ctx) {
    const raw = Array.isArray(input.prospects) ? input.prospects : [];
    const goal = String(input.goal || "start a conversation");

    const prospects: Prospect[] = raw
      .map((p) => p as Record<string, unknown>)
      .filter((p) => typeof p?.email === "string" && p.email.includes("@"))
      .map((p) => ({
        email: String(p.email),
        name: typeof p.name === "string" ? p.name : undefined,
        company: typeof p.company === "string" ? p.company : undefined,
        reason: typeof p.reason === "string" ? p.reason : undefined,
      }));

    if (!prospects.length) {
      return failed(
        "No valid prospect emails were supplied. Cold outreach needs a real list — " +
          "run a research task to build one, or paste addresses in yourself. " +
          "I will not invent email addresses.",
      );
    }

    const already = await sentToday(ctx.companyId);
    const room = Math.max(0, OUTREACH_DAILY_CAP - already);
    if (room === 0) {
      return failed(
        `Today's outreach cap of ${OUTREACH_DAILY_CAP} emails is already used. The campaign is queued for tomorrow.`,
      );
    }

    await ctx.log("info", `Writing a cold email for ${prospects.length} prospects`);

    const drafted = await ctx.thinkJson<{ subject: string; body: string }>(
      `${companyBrief(ctx.company)}

Write a cold email. The goal of a reply is: ${goal}

Here is who is receiving it:
${prospects.slice(0, 5).map((p) => `- ${p.name || p.email}${p.company ? ` at ${p.company}` : ""}${p.reason ? ` — ${p.reason}` : ""}`).join("\n")}

Rules:
- Under 120 words. Four short paragraphs at most.
- Open with the specific reason you are writing to THEM. Use the {{name}} and {{company}} placeholders — they are substituted per recipient.
- One sentence on what the company does, in their language, not yours.
- One clear ask that costs them under a minute to answer.
- No "I hope this finds you well", no "quick question", no fake compliments, no false urgency, no claims about their business you cannot know.
- Sign off as the founder of ${ctx.company.name}.

Reply with JSON only: {"subject": "...", "body": "..."}
The subject must be under 60 characters and read like a person wrote it, not a campaign.`,
      {
        deep: true,
        maxTokens: 900,
        system:
          "You write cold email that gets replies because it is short, specific and honest. " +
          "You never fabricate claims about the recipient or the sender.",
      },
    );

    if (!drafted?.subject || !drafted?.body) {
      return failed("Could not draft a usable email.");
    }

    const targets = prospects.slice(0, room);
    const result = await sendCampaign(ctx.company, targets, drafted.subject, drafted.body, {
      taskId: ctx.taskId,
    });

    const doc = await ctx.saveDocument({
      title: `Cold email: ${drafted.subject}`,
      kind: "copy",
      body: `**Subject:** ${drafted.subject}\n\n${drafted.body}\n\n---\n\nSent to ${result.sent} prospects.`,
    });

    if (result.sent === 0) {
      await ctx.log("warn", `Nothing sent: ${result.detail}`);
      return {
        status: "done",
        summary: `Drafted the campaign but sent nothing — ${result.detail}. The copy is saved in Documents.`,
        artifacts: [{ label: drafted.subject, id: doc.id, kind: "doc" }],
        projectedMrr: 0,
      };
    }

    await ctx.log("success", `Sent ${result.sent} cold emails`);

    return done(
      `Sent ${result.sent} cold emails with the subject "${drafted.subject}". ${result.detail}. ` +
        `Replies land in the inbox you connected — I will not answer them for you without being asked.`,
      [{ label: drafted.subject, id: doc.id, kind: "email" }],
      // A conservative estimate: ~3% reply, ~25% of replies close at the price point.
      estimateMrr(result.sent, ctx.company.pricePoint),
    );
  },

  async verify(_input, result) {
    if (result.status !== "done") return { ok: false, reason: result.error || "run failed" };
    return { ok: true, reason: "campaign recorded in the outreach log" };
  },
};

function estimateMrr(sent: number, pricePoint: string): number {
  const price = Number(pricePoint.replace(/[^0-9.]/g, "")) || 20;
  return Math.round(sent * 0.03 * 0.25 * price);
}
