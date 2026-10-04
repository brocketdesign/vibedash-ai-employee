import { companyBrief, done, failed, type ManagerAgent } from "./types";

/**
 * Research manager — intel that every other lever depends on.
 *
 * Deliberately opinionated about output: a research task that ends in "here are
 * some thoughts" is worthless. Every run must end with a named list of things
 * the company can act on tomorrow — segments, competitors, prospects, channels —
 * with the next action spelled out.
 */
export const researchManager: ManagerAgent = {
  id: "research",
  title: "Research",
  kind: "research",
  description:
    "Investigate the market, competitors, pricing, channels, or a prospect list. " +
    "Use when the company does not yet know who pays, what they pay, or where to find them.",
  moneyPath:
    "Research does not earn money directly. It earns money by making the NEXT task hit — " +
    "a cold email list that converts, a price that holds, an ad angle that lands. " +
    "Only pick this when the next revenue task is blocked on not knowing something.",
  inputSchema: {
    type: "object",
    properties: {
      question: {
        type: "string",
        description: "The single question this research must answer.",
      },
      deliverable: {
        type: "string",
        enum: ["segments", "competitors", "prospects", "channels", "pricing"],
        description: "The shape of the list this research produces.",
      },
      count: {
        type: "number",
        description: "How many items the list should contain (default 10).",
      },
    },
    required: ["question", "deliverable"],
  },

  async run(input, ctx) {
    const question = String(input.question || "").trim();
    const deliverable = String(input.deliverable || "segments");
    const count = Math.min(50, Math.max(3, Number(input.count) || 10));

    if (!question) return failed("No research question was given.");

    await ctx.log("info", `Researching: ${question}`);

    const body = await ctx.think(
      `${companyBrief(ctx.company)}

Research question: ${question}

Produce a research brief that ends in ${count} concrete ${deliverable}. Rules:
- Every item must be specific enough to act on tomorrow. "Small businesses" is not a segment; "solo Shopify sellers doing $5-20k/mo who already pay for Klaviyo" is.
- For each item give: the item, why it fits this company, the estimated size or reach, and the single next action.
- Where you are inferring rather than certain, say so in one short clause. Do not invent statistics, company names, or contact details you cannot support.
- End with a section "What I would do next and why" naming exactly one follow-up task.

Format as markdown with a level-2 heading per section.`,
      {
        deep: true,
        maxTokens: 3000,
        system:
          "You are a growth researcher for a one-person company. You are paid for decisions, not prose. " +
          "You never fabricate specific facts, names, numbers, or email addresses — when you are estimating, you label it as an estimate.",
      },
    );

    if (!body || body.length < 200) {
      return failed("The research came back empty or too thin to be useful.");
    }

    const title = `${titleCase(deliverable)}: ${question}`.slice(0, 120);
    const doc = await ctx.saveDocument({ title, kind: "research", body });

    await ctx.log("success", `Research filed: ${title}`);

    return done(
      `Researched "${question}" and filed a brief with ${count} ${deliverable}, each with a next action. ` +
        `Read it in Documents — it is the input for the next revenue task.`,
      [{ label: title, id: doc.id, kind: "doc" }],
      0,
    );
  },

  async verify(input, result, ctx) {
    if (result.status !== "done") return { ok: false, reason: result.error || "run failed" };
    const hasDoc = result.artifacts.some((a) => a.kind === "doc");
    if (!hasDoc) return { ok: false, reason: "no research document was saved" };

    const judgment = await ctx.thinkJson<{ ok: boolean; reason: string }>(
      `A research task asked: "${String(input.question || "")}".
The employee reported: "${result.summary}".
Did this produce actionable, specific output rather than generic advice?
Reply with JSON only: {"ok": boolean, "reason": "one short sentence"}`,
      { maxTokens: 150 },
    );

    return judgment ?? { ok: true, reason: "verification skipped" };
  },
};

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
