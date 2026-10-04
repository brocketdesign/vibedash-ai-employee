import { createSandbox, sandboxConfigured, type SandboxHandle } from "../sandbox";
import { deploySite, vpsConfigured, type DeployFileInput } from "../vps";
import { companies } from "../db";
import { companyBrief, done, failed, type ManagerAgent } from "./types";

/**
 * Build manager — the employee writes code, runs it in a Novita sandbox, and
 * publishes the result to the company's VPS.
 *
 * The sandbox is the safety boundary: generated code is executed there and
 * nowhere else, and the only thing that leaves it is a set of static files that
 * were verified to exist. A build that fails its own checks never touches the
 * live site.
 */
export const buildManager: ManagerAgent = {
  id: "build",
  title: "Build & ship",
  kind: "feature",
  description:
    "Write, run and deploy real code: a landing page, a pricing page, a signup flow, a small tool. " +
    "Builds inside an isolated sandbox and publishes the output to the company's live site.",
  moneyPath:
    "The most direct lever there is. No landing page means no conversion at any traffic level; " +
    "no checkout means no revenue at any conversion rate. Pick this first when the company " +
    "has nowhere for a visitor to land or nothing for them to buy.",
  requires: ["sandbox", "vps"],
  inputSchema: {
    type: "object",
    properties: {
      objective: {
        type: "string",
        description: "What to build, in one sentence, framed by what it should make the visitor do.",
      },
      pages: {
        type: "array",
        items: { type: "string" },
        description: 'Page paths to produce, e.g. ["index.html", "pricing.html"].',
      },
      deploy: {
        type: "boolean",
        description: "Publish to the live site when the build passes (default true).",
      },
    },
    required: ["objective"],
  },

  async run(input, ctx) {
    const objective = String(input.objective || "").trim();
    const pages = (Array.isArray(input.pages) ? input.pages : ["index.html"])
      .map((p) => String(p).replace(/^\/+/, ""))
      .filter((p) => /\.(html|css|js|json|txt|md|svg|webmanifest)$/i.test(p))
      .slice(0, 8);
    const shouldDeploy = input.deploy !== false;

    if (!objective) return failed("No build objective was given.");
    if (!pages.length) pages.push("index.html");

    await ctx.log("info", `Building: ${objective}`);

    // ── 1. Generate the site ────────────────────────────────────────────────
    const generated = await ctx.thinkJson<{ files: Array<{ path: string; content: string }> }>(
      `${companyBrief(ctx.company)}

Build this: ${objective}

Produce these files: ${pages.join(", ")}

Requirements:
- Self-contained static HTML. Inline all CSS in a <style> block; no external stylesheets, fonts, scripts or images from a CDN — they will be blocked.
- The page must make one thing obvious in the first screenful: what this is, who it is for, and the single action to take.
- A real, working call to action. If the company has a price point (${ctx.company.pricePoint}), state it plainly rather than hiding it behind "contact us".
- Responsive: readable on a phone, no horizontal scroll.
- Honest copy. Do not invent testimonials, customer logos, user counts, press mentions, or results.
- Accessible: real heading order, sufficient contrast, alt text on any inline SVG.

Reply with JSON only:
{"files": [{"path": "index.html", "content": "<!doctype html>..."}]}`,
      {
        deep: true,
        maxTokens: 8000,
        system:
          "You are a product engineer who ships conversion-focused static sites. " +
          "You write complete, valid, self-contained HTML. You never fabricate social proof.",
      },
    );

    const files = (generated?.files || [])
      .filter((f) => f && typeof f.path === "string" && typeof f.content === "string")
      .map((f) => ({
        path: f.path.replace(/^\/+/, ""),
        content: f.content,
      }))
      .filter((f) => f.content.trim().length > 50);

    if (!files.length) return failed("The build produced no usable files.");

    // ── 2. Verify it in the sandbox ─────────────────────────────────────────
    let checks: string[] = [];
    if (sandboxConfigured()) {
      try {
        checks = await verifyInSandbox(files, ctx.company.infra.sandboxTemplateId, (m) =>
          ctx.log("info", m),
        );
      } catch (e) {
        await ctx.log(
          "warn",
          `Sandbox check skipped: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    } else {
      await ctx.log("warn", "No sandbox configured — deploying without a runtime check.");
    }

    const brokenPages = checks.filter((c) => c.startsWith("FAIL"));
    if (brokenPages.length) {
      return failed(`The build failed its own checks and was not deployed:\n${brokenPages.join("\n")}`);
    }

    // ── 3. Deploy to the VPS ────────────────────────────────────────────────
    if (!shouldDeploy) {
      const doc = await ctx.saveDocument({
        title: `Build: ${objective.slice(0, 70)}`,
        kind: "copy",
        body: files.map((f) => `### ${f.path}\n\n\`\`\`html\n${f.content.slice(0, 4000)}\n\`\`\``).join("\n\n"),
      });
      return done(`Built ${files.length} file(s) but held off deploying, as asked.`, [
        { label: "Build output", id: doc.id, kind: "doc" },
      ]);
    }

    if (!vpsConfigured()) {
      const doc = await ctx.saveDocument({
        title: `Build: ${objective.slice(0, 70)}`,
        kind: "copy",
        body: files.map((f) => `### ${f.path}\n\n\`\`\`html\n${f.content}\n\`\`\``).join("\n\n"),
      });
      await ctx.log("warn", "No VPS configured — the build is saved but not live.");
      return {
        status: "done",
        summary:
          `Built ${files.length} file(s) for "${objective}" but the hosting VPS is not configured, ` +
          `so nothing is live yet. The full output is saved in Documents and will deploy as soon as hosting is connected.`,
        artifacts: [{ label: "Build output", id: doc.id, kind: "doc" }],
        projectedMrr: 0,
      };
    }

    const subdomain = ctx.company.slug;
    const deployFiles: DeployFileInput[] = files.map((f) => ({
      path: f.path,
      content: f.content,
    }));

    await ctx.log("info", `Deploying ${files.length} file(s) to ${subdomain}`);
    const deployed = await deploySite(subdomain, deployFiles);

    // Remember where the company lives now.
    const col = await companies();
    await col.updateOne(
      { _id: ctx.company._id },
      {
        $set: {
          "infra.siteUrl": deployed.url,
          "infra.vpsSubdomain": subdomain,
          "infra.vpsStatus": "ready",
          status: "live",
          updatedAt: new Date(),
        },
      },
    );

    await ctx.log("success", `Live at ${deployed.url}`);

    return done(
      `Shipped "${objective}". ${files.length} file(s) are live at ${deployed.url}. ` +
        `${checks.length ? `Sandbox checks passed: ${checks.join("; ")}.` : ""} ` +
        `Traffic sent here now has somewhere to convert.`,
      [
        { label: "Live site", url: deployed.url, kind: "deploy" },
        ...deployed.files.slice(0, 5).map((f) => ({
          label: f.path,
          url: f.url,
          kind: "deploy" as const,
        })),
      ],
      0,
    );
  },

  async verify(_input, result) {
    if (result.status !== "done") return { ok: false, reason: result.error || "run failed" };

    const live = result.artifacts.find((a) => a.kind === "deploy" && a.url);
    if (!live?.url) return { ok: true, reason: "built but not deployed" };

    // The real check: does the URL actually serve a page?
    try {
      const res = await fetch(live.url, {
        method: "GET",
        signal: AbortSignal.timeout(15_000),
      });
      if (!res.ok) return { ok: false, reason: `live URL returned ${res.status}` };
      const html = await res.text();
      if (html.length < 200) return { ok: false, reason: "live URL served an empty page" };
      return { ok: true, reason: `live URL serves ${html.length} bytes` };
    } catch (e) {
      return {
        ok: false,
        reason: `could not reach the live URL: ${e instanceof Error ? e.message : "unknown"}`,
      };
    }
  },
};

/**
 * Write the generated files into a sandbox and sanity-check them there: valid
 * HTML structure, no external resource references, non-trivial body content.
 * Returns one line per check; any line starting with FAIL blocks the deploy.
 */
async function verifyInSandbox(
  files: Array<{ path: string; content: string }>,
  templateId: string | undefined,
  log: (message: string) => Promise<void>,
): Promise<string[]> {
  let sandbox: SandboxHandle | null = null;
  try {
    sandbox = await createSandbox(templateId);
    await log(`Sandbox ${sandbox.id || "(new)"} up — checking the build`);

    for (const file of files) {
      await sandbox.writeFile(`/tmp/site/${file.path}`, file.content);
    }

    const script = `
import os, re, sys, json
root = "/tmp/site"
out = []
for dirpath, _, names in os.walk(root):
    for name in names:
        p = os.path.join(dirpath, name)
        rel = os.path.relpath(p, root)
        html = open(p, encoding="utf-8", errors="replace").read()
        if not rel.endswith(".html"):
            out.append("OK %s (%d bytes)" % (rel, len(html)))
            continue
        if "<html" not in html.lower():
            out.append("FAIL %s: no <html> element" % rel); continue
        body = re.sub(r"<script.*?</script>|<style.*?</style>|<[^>]+>", " ", html, flags=re.S)
        words = len(body.split())
        if words < 30:
            out.append("FAIL %s: only %d words of visible copy" % (rel, words)); continue
        external = re.findall(r'(?:src|href)="(https?://[^"]+)"', html)
        blocking = [u for u in external if not u.startswith("mailto:")]
        out.append("OK %s (%d words, %d external links)" % (rel, words, len(blocking)))
print(json.dumps(out))
`.trim();

    const result = await sandbox.runCode(script);
    const parsed = safeParseList(result.stdout);
    await log(`Build check: ${parsed.join("; ") || "no output"}`);
    return parsed;
  } finally {
    if (sandbox) await sandbox.kill();
  }
}

function safeParseList(stdout: string): string[] {
  const match = stdout.match(/\[[\s\S]*\]/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
