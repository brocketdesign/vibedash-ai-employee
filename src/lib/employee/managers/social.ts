import { tweet, zernioConfigured, recentPosts } from "../zernio";
import { companyBrief, done, failed, type ManagerAgent } from "./types";

/**
 * Social manager — auto-posting to X through Zernio.
 *
 * The employee writes in the company's voice, not in marketing voice. The rule
 * that matters: every post has to be worth reading on its own, because a
 * timeline full of "excited to announce" earns nothing.
 */
export const socialManager: ManagerAgent = {
  id: "social",
  title: "Social",
  kind: "social",
  description:
    "Write and publish a post to X (Twitter) for the company, or queue a short thread. " +
    "Use for launches, build-in-public updates, and distribution of anything the company shipped.",
  moneyPath:
    "Posts drive traffic to the site, which converts at whatever the landing page converts at. " +
    "Worth picking when there is something real to say — a shipped feature, a result, a number. " +
    "Posting into silence with nothing to show earns nothing.",
  requires: ["zernio"],
  inputSchema: {
    type: "object",
    properties: {
      angle: {
        type: "string",
        description: "What this post is about and why anyone would care.",
      },
      style: {
        type: "string",
        enum: ["build-in-public", "insight", "launch", "result", "question"],
        description: "The register to write in.",
      },
      link: { type: "string", description: "Optional URL to include." },
      scheduledFor: {
        type: "string",
        description: "Optional ISO timestamp to queue for instead of posting now.",
      },
    },
    required: ["angle"],
  },

  async run(input, ctx) {
    const angle = String(input.angle || "").trim();
    const style = String(input.style || "build-in-public");
    const link = String(input.link || ctx.company.infra.siteUrl || "").trim();

    if (!angle) return failed("No angle was given for the post.");

    if (!zernioConfigured()) {
      return failed(
        "Zernio is not configured, so there is no way to publish. Set ZERNIO_API_KEY and connect an X account.",
      );
    }

    await ctx.log("info", `Drafting a ${style} post: ${angle}`);

    // Show the model what it already posted so it doesn't repeat itself.
    const previous = await recentPosts(ctx.companyId, 8);
    const priorText = previous.length
      ? `\n\nPosts this account already made — do not repeat these angles or openings:\n${previous
          .map((p) => `- ${p.content.slice(0, 160)}`)
          .join("\n")}`
      : "";

    const draft = await ctx.think(
      `${companyBrief(ctx.company)}

Write ONE post for X about: ${angle}
Register: ${style}
${link ? `Include this link at the end on its own line: ${link}` : "Do not include a link."}${priorText}

Rules:
- Under 270 characters including the link.
- Plain sentences. No hashtags. No emoji. No "excited to announce". No rhetorical question openers.
- Say a specific thing. A number, a decision, a tradeoff, a result. If there is nothing specific to say, say the smallest true thing rather than inflating it.
- Do not claim traction, revenue, or customer counts that are not in the company profile above.

Return only the post text.`,
      {
        maxTokens: 400,
        temperature: 0.8,
        system:
          "You write short posts for a founder's account. You sound like a person who builds things, " +
          "not like a brand. You never fabricate metrics or milestones.",
      },
    );

    const content = draft.replace(/^["']|["']$/g, "").trim().slice(0, 280);
    if (content.length < 20) return failed("The drafted post was too short to publish.");

    const scheduledFor = typeof input.scheduledFor === "string" ? input.scheduledFor : undefined;
    const result = await tweet(ctx.company, content, { scheduledFor });

    if (!result.posted) {
      // Not a failure of judgement — the account just isn't connected yet. Save
      // the draft so nothing is lost and tell the user what to do.
      const doc = await ctx.saveDocument({
        title: `Draft post: ${angle.slice(0, 60)}`,
        kind: "copy",
        body: content,
      });
      await ctx.log("warn", result.detail);
      return {
        status: "done",
        summary: `Wrote the post but could not publish it: ${result.detail} The draft is saved in Documents and will go out as soon as an X account is connected.`,
        artifacts: [{ label: "Draft post", id: doc.id, kind: "doc" }],
        projectedMrr: 0,
      };
    }

    await ctx.log("success", result.detail);

    return done(
      `${result.detail}\n\n"${content}"`,
      [{ label: "Post on X", url: result.url, id: result.postId, kind: "post" }],
      0,
    );
  },

  async verify(_input, result) {
    if (result.status !== "done") return { ok: false, reason: result.error || "run failed" };
    const published = result.artifacts.some((a) => a.kind === "post");
    return published
      ? { ok: true, reason: "post published via Zernio" }
      : { ok: true, reason: "draft saved; no account connected yet" };
  },
};
