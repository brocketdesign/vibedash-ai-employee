import { companyBrief, done, failed, type ManagerAgent } from "./types";

/**
 * Revenue manager — pricing, packaging, checkout, upsells, churn.
 *
 * The cheapest revenue in any company is the revenue it is already failing to
 * collect: a price that is too low, a checkout that leaks, an upsell nobody is
 * offered. This manager works that seam, and it is the one place the employee
 * is allowed to argue with the user's own pricing.
 */
export const revenueManager: ManagerAgent = {
  id: "revenue",
  title: "Revenue",
  kind: "revenue",
  description:
    "Work the money directly: set or change pricing, design packaging and upsells, fix a leaking " +
    "checkout, or plan the path from the current MRR to the next milestone.",
  moneyPath:
    "Compounding and immediate. A 20% price rise on existing conversion is 20% more MRR tonight " +
    "with no new traffic. Pick this whenever there is traffic that is not converting, or " +
    "conversion that is not priced properly.",
  inputSchema: {
    type: "object",
    properties: {
      focus: {
        type: "string",
        enum: ["pricing", "packaging", "checkout", "upsell", "churn", "plan"],
        description: "Which part of the money machine to work on.",
      },
      context: {
        type: "string",
        description: "What is currently true — current price, current conversion, what is broken.",
      },
    },
    required: ["focus"],
  },

  async run(input, ctx) {
    const focus = String(input.focus || "pricing");
    const context = String(input.context || "").trim();
    const { metrics } = ctx.company;

    await ctx.log("info", `Working the ${focus} problem`);

    const body = await ctx.think(
      `${companyBrief(ctx.company)}

Current numbers: ${metrics.visitors} visitors, ${metrics.signups} signups, $${metrics.mrr.toFixed(2)} MRR, $${metrics.revenue.toFixed(2)} total revenue.
${context ? `What the founder says is true right now: ${context}` : ""}

Work the ${focus} problem. Produce:

## The diagnosis
What is actually costing this company money right now, stated as a number where the numbers exist and as an explicit assumption where they do not. If the honest answer is "there is not enough traffic yet for ${focus} to matter", say that first and say what matters instead.

## The change
The specific change to make, written so it could be implemented tomorrow. Exact prices, exact plan names, exact copy where copy is involved.

## The arithmetic
What this is worth per month at current traffic, showing the calculation. Do not round up in your own favour.

## The risk
What this breaks if you are wrong, and the cheapest way to find out before committing.

Be willing to tell the founder their current price is wrong. Be specific about by how much and why.`,
      {
        deep: true,
        maxTokens: 2500,
        system:
          "You are a pricing and monetisation operator. You argue from unit economics, you show " +
          "your arithmetic, and you do not flatter the founder's existing decisions.",
      },
    );

    if (!body || body.length < 250) return failed("The revenue analysis came back too thin to use.");

    const title = `${titleCase(focus)}: ${ctx.company.name}`.slice(0, 120);
    const doc = await ctx.saveDocument({ title, kind: "report", body });

    // Ask for a number so the dashboard can show what the night was worth.
    const estimate = await ctx.thinkJson<{ mrr: number; basis: string }>(
      `Based on this analysis, what is the realistic monthly revenue impact in USD if the founder implements it?
Be conservative. If the honest answer is 0 because there is not enough traffic, say 0.

Analysis:
${body.slice(0, 3000)}

Reply with JSON only: {"mrr": number, "basis": "one short sentence"}`,
      { maxTokens: 200 },
    );

    await ctx.log("success", `Revenue plan ready: ${title}`);

    return done(
      `Worked the ${focus} problem and filed a plan with the arithmetic behind it. ` +
        (estimate?.mrr
          ? `Estimated impact: $${estimate.mrr}/mo — ${estimate.basis}`
          : `No revenue impact claimed yet: ${estimate?.basis || "the traffic is not there to justify it"}.`),
      [{ label: title, id: doc.id, kind: "report" }],
      Math.max(0, Number(estimate?.mrr) || 0),
    );
  },

  async verify(_input, result) {
    if (result.status !== "done") return { ok: false, reason: result.error || "run failed" };
    return result.artifacts.length
      ? { ok: true, reason: "revenue plan saved" }
      : { ok: false, reason: "no plan produced" };
  },
};

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
