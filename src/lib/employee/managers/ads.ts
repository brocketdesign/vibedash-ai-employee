import { companyBrief, done, failed, type ManagerAgent } from "./types";

/**
 * Ads manager — paid acquisition creative and a spend plan.
 *
 * It deliberately stops short of spending money. The employee produces the
 * campaign — angles, creative, targeting, budget, the kill criteria — and the
 * user pushes the button. Handing an autonomous agent a funded ad account is
 * how a $20/mo subscription turns into a $2,000 mistake overnight.
 */
export const adsManager: ManagerAgent = {
  id: "ads",
  title: "Ads",
  kind: "ads",
  description:
    "Produce a ready-to-launch paid campaign: angles, ad copy variations, targeting, budget " +
    "and the numbers at which to kill or scale it. Prepares the campaign; does not spend.",
  moneyPath:
    "Buys traffic that the landing page converts. Only worth picking once there IS a landing page " +
    "and a price — paid traffic to a page that does not convert burns money faster than anything " +
    "else the company can do.",
  inputSchema: {
    type: "object",
    properties: {
      platform: {
        type: "string",
        enum: ["meta", "google", "x", "reddit", "tiktok"],
        description: "Where the campaign will run.",
      },
      objective: {
        type: "string",
        description: "What the campaign is buying — signups, sales, waitlist.",
      },
      monthlyBudgetUsd: {
        type: "number",
        description: "Budget the user is willing to test with.",
      },
    },
    required: ["platform", "objective"],
  },

  async run(input, ctx) {
    const platform = String(input.platform || "meta");
    const objective = String(input.objective || "").trim();
    const budget = Math.max(0, Number(input.monthlyBudgetUsd) || 300);

    if (!objective) return failed("No campaign objective was given.");

    if (!ctx.company.infra.siteUrl) {
      return failed(
        "There is no live landing page to send paid traffic to yet. " +
          "Build the page first — buying clicks to nothing is the fastest way to lose money.",
      );
    }

    await ctx.log("info", `Planning a ${platform} campaign for ${objective}`);

    const body = await ctx.think(
      `${companyBrief(ctx.company)}

Landing page: ${ctx.company.infra.siteUrl}
Platform: ${platform}
Objective: ${objective}
Test budget: $${budget}/month

Produce a campaign plan with these sections:

## Angles
Three distinct angles, each stating the belief the ad has to change in the viewer's head.

## Creative
For each angle: primary text (under 125 characters), headline (under 40), description, and a one-line brief for the visual. Label which single variable each variation tests — one variable per variation, or the test tells you nothing.

## Targeting
Interests, behaviours, exclusions, and the lookalike source once there is one. Be specific to this audience: ${ctx.company.audience}

## Budget & structure
How to split $${budget} across the test, how long to run before judging, minimum sample per variation.

## Kill and scale criteria
The exact CPA above which to kill, and below which to scale. Compute both from the price point (${ctx.company.pricePoint}) and state the assumed conversion rate you used. If the maths does not work at this price point, say so plainly and recommend against running it.

Be concrete. No platform-agnostic filler.`,
      {
        deep: true,
        maxTokens: 3000,
        system:
          "You are a direct-response media buyer. You are ruthless about unit economics and you " +
          "will tell a founder when paid acquisition cannot work at their price point.",
      },
    );

    if (!body || body.length < 300) return failed("The campaign plan came back too thin to use.");

    const title = `${titleCase(platform)} campaign: ${objective}`.slice(0, 120);
    const doc = await ctx.saveDocument({ title, kind: "roadmap", body });

    await ctx.log("success", `Campaign plan ready: ${title}`);

    return done(
      `Built a ${platform} campaign for "${objective}" on a $${budget}/mo test budget — three angles, ` +
        `creative variations, targeting and the CPA thresholds to kill or scale at. ` +
        `It is ready to launch in Documents; I have not spent anything, so review the kill criteria before you fund it.`,
      [{ label: title, id: doc.id, kind: "campaign" }],
      0,
    );
  },

  async verify(_input, result) {
    if (result.status !== "done") return { ok: false, reason: result.error || "run failed" };
    return result.artifacts.length
      ? { ok: true, reason: "campaign plan saved" }
      : { ok: false, reason: "no campaign plan was produced" };
  },
};

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
