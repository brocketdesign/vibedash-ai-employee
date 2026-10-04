import { deployFile, vpsConfigured } from "../vps";
import { companyBrief, done, failed, type ManagerAgent } from "./types";

/**
 * Content manager — words that pull traffic or close a sale.
 *
 * Two modes with different jobs: `landing` copy is rewritten and published onto
 * the live site immediately, because copy that sits in a doc converts nobody;
 * `article` content is filed for review, because SEO pages published without a
 * human read are how a company ends up with a hundred pages of slop.
 */
export const contentManager: ManagerAgent = {
  id: "content",
  title: "Content",
  kind: "content",
  description:
    "Write the words: landing page copy, an SEO article, documentation, a launch post. " +
    "Landing copy is published live; longer content is filed for review.",
  moneyPath:
    "Copy is the conversion rate. The same traffic against better words is more revenue with no " +
    "extra spend. SEO articles are the slowest lever here — months to compound — so only pick " +
    "them once the fast levers are done.",
  inputSchema: {
    type: "object",
    properties: {
      mode: {
        type: "string",
        enum: ["landing", "article", "docs", "launch"],
        description: "What kind of content this is.",
      },
      topic: { type: "string", description: "What it is about." },
      keyword: { type: "string", description: "Target search phrase, for articles." },
    },
    required: ["mode", "topic"],
  },

  async run(input, ctx) {
    const mode = String(input.mode || "landing");
    const topic = String(input.topic || "").trim();
    const keyword = String(input.keyword || "").trim();

    if (!topic) return failed("No topic was given.");

    await ctx.log("info", `Writing ${mode} content: ${topic}`);

    const briefs: Record<string, string> = {
      landing:
        "Rewrite the landing page copy. Structure: headline (under 12 words, states the outcome not the category), " +
        "subhead (who it is for and what it costs them not to have it), three benefit blocks tied to concrete outcomes, " +
        "an objection-handling section, and one call to action repeated twice. State the price plainly.",
      article:
        `Write a genuinely useful article${keyword ? ` targeting the search phrase "${keyword}"` : ""}. ` +
        "It must be worth reading by someone who never buys anything. Lead with the answer, not with a preamble. " +
        "Use concrete examples. Mention the company once, at the end, where it is actually relevant.",
      docs:
        "Write clear product documentation. Task-oriented headings, the shortest path to working first, " +
        "and every code sample complete enough to paste and run.",
      launch:
        "Write a launch post for Product Hunt / Hacker News / a founder's newsletter. " +
        "Lead with what it does and what it costs. Say what it does NOT do — that is what earns trust in these venues.",
    };

    const body = await ctx.think(
      `${companyBrief(ctx.company)}

Topic: ${topic}

${briefs[mode] || briefs.landing}

Rules that apply to everything you write here:
- No invented testimonials, customer counts, press mentions, or results.
- No "in today's fast-paced world", no "unlock", no "revolutionise", no "game-changing".
- Short sentences. Specific nouns. If you cannot say something specific, cut the sentence.

${mode === "landing" ? "Reply with a complete self-contained HTML page: inline <style>, no external resources, responsive, accessible heading order." : "Reply with markdown."}`,
      {
        deep: true,
        maxTokens: 5000,
        system:
          "You are a direct-response copywriter who also knows how to write things worth reading. " +
          "You never fabricate proof.",
      },
    );

    if (!body || body.length < 200) return failed("The content came back too thin to use.");

    // Landing copy goes live; everything else gets filed for a human read.
    if (mode === "landing" && vpsConfigured() && ctx.company.infra.vpsSubdomain) {
      const html = extractHtml(body);
      if (html) {
        const deployed = await deployFile(ctx.company.infra.vpsSubdomain, {
          path: "index.html",
          content: html,
        });
        await ctx.log("success", `New landing copy live at ${deployed.url}`);
        return done(
          `Rewrote the landing page around "${topic}" and published it. It is live at ${deployed.url} — ` +
            `the same traffic now meets better words.`,
          [{ label: "Live landing page", url: deployed.url, kind: "deploy" }],
          0,
        );
      }
    }

    const kind = mode === "landing" || mode === "launch" ? "copy" : "research";
    const title = `${titleCase(mode)}: ${topic}`.slice(0, 120);
    const doc = await ctx.saveDocument({ title, kind: kind as "copy" | "research", body });

    await ctx.log("success", `Content filed: ${title}`);

    return done(
      `Wrote ${mode} content on "${topic}" and filed it in Documents for your read before it goes out.`,
      [{ label: title, id: doc.id, kind: "doc" }],
      0,
    );
  },

  async verify(_input, result) {
    if (result.status !== "done") return { ok: false, reason: result.error || "run failed" };
    return result.artifacts.length
      ? { ok: true, reason: "content saved or published" }
      : { ok: false, reason: "no content produced" };
  },
};

/** Pull a full HTML document out of a model response that may be fenced. */
function extractHtml(text: string): string | null {
  const fenced = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] || text).trim();
  return /<html[\s>]/i.test(candidate) ? candidate : null;
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
