import { createSite, liveUrlFor, vpsConfigured, vpsHealth } from "../vps";
import { buildTemplate, sandboxConfigured } from "../sandbox";
import { companies } from "../db";
import { done, failed, type ManagerAgent } from "./types";

/**
 * Ops manager — the plumbing the company runs on.
 *
 * Runs on night one to stand up hosting and the sandbox template, and whenever
 * something in the infrastructure needs repairing. Everything here is
 * idempotent: running it twice must never break a live site.
 */
export const opsManager: ManagerAgent = {
  id: "ops",
  title: "Infrastructure",
  kind: "ops",
  description:
    "Stand up or repair the company's infrastructure: hosting vhost, sandbox build template, " +
    "domain, health checks. Run this first for a brand-new company.",
  moneyPath:
    "No revenue on its own, but it is the precondition for the levers that do earn: without a " +
    "vhost there is nowhere to ship, and without a sandbox template there is nothing to build with. " +
    "Do it once, early, then stop picking it.",
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: ["provision", "health", "rebuild-template"],
        description: "What piece of infrastructure to work on.",
      },
    },
    required: ["action"],
  },

  async run(input, ctx) {
    const action = String(input.action || "provision");

    if (action === "health") {
      const [vps, sandbox] = await Promise.all([
        vpsHealth(),
        Promise.resolve({
          ok: sandboxConfigured(),
          detail: sandboxConfigured() ? "configured" : "NOVITA_API_KEY missing",
        }),
      ]);
      const lines = [
        `Hosting VPS: ${vps.ok ? "healthy" : `unavailable (${vps.detail})`}`,
        `Sandbox: ${sandbox.ok ? "ready" : sandbox.detail}`,
        `Site: ${ctx.company.infra.siteUrl || "not deployed yet"}`,
      ];
      await ctx.log(vps.ok ? "success" : "warn", lines.join(" · "));
      return done(`Infrastructure check:\n\n${lines.map((l) => `- ${l}`).join("\n")}`);
    }

    if (action === "rebuild-template") {
      if (!sandboxConfigured()) return failed("NOVITA_API_KEY is not configured.");
      await ctx.log("info", "Rebuilding the sandbox template");
      const built = await buildTemplate({ name: `vibedash-${ctx.company.slug}` });
      const col = await companies();
      await col.updateOne(
        { _id: ctx.company._id },
        { $set: { "infra.sandboxTemplateId": built.templateId, updatedAt: new Date() } },
      );
      await ctx.log("success", `Sandbox template ${built.templateId} built`);
      return done(
        `Rebuilt the sandbox build environment (template ${built.templateId}). Future builds start from a warm image.`,
      );
    }

    // ── provision ───────────────────────────────────────────────────────────
    if (!vpsConfigured()) {
      return failed(
        "Hosting is not configured on this deployment (HOSTINGER_HOST_VPS_IP / HOSTINGER_MGMT_SECRET). " +
          "Run scripts/setup-static-vps.sh on the host VPS and set those variables.",
      );
    }

    const subdomain = ctx.company.slug;
    await ctx.log("info", `Provisioning hosting for ${subdomain}`);

    await createSite(subdomain);
    const url = liveUrlFor(subdomain);

    const col = await companies();
    await col.updateOne(
      { _id: ctx.company._id },
      {
        $set: {
          "infra.vpsSubdomain": subdomain,
          "infra.vpsStatus": "ready",
          "infra.siteUrl": url,
          "infra.vpsIp": process.env.HOSTINGER_HOST_VPS_IP,
          updatedAt: new Date(),
        },
      },
    );

    await ctx.log("success", `Hosting ready at ${url}`);

    return done(
      `Hosting is live at ${url}. The next build task can deploy straight to it.`,
      [{ label: url, url, kind: "deploy" }],
    );
  },

  async verify(input, result) {
    if (result.status !== "done") return { ok: false, reason: result.error || "run failed" };
    if (String(input.action) !== "provision") return { ok: true, reason: "no artifact expected" };
    return result.artifacts.length
      ? { ok: true, reason: "vhost created" }
      : { ok: false, reason: "no hosting URL returned" };
  },
};
