// ============================================================
// Novita Agent Sandbox — where the employee actually builds things
// ============================================================
//
// The employee needs somewhere to run code it wrote: scaffold a landing page,
// run a scraper over a prospect list, render ad creative, build and test a
// feature before it goes near the VPS. Novita sandboxes are isolated, stateful
// and billed per second, so one is created per task and killed at the end.
//
// The SDK is loaded lazily via a dynamic import so that a deployment without
// `novita-sandbox` installed (or without a key) still builds and runs — every
// entry point degrades to a clear "sandbox not configured" error instead of
// crashing the route.

export interface ExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface SandboxHandle {
  id: string;
  run(command: string, opts?: { cwd?: string; timeoutMs?: number }): Promise<ExecResult>;
  runCode(code: string): Promise<ExecResult>;
  writeFile(path: string, contents: string): Promise<void>;
  readFile(path: string): Promise<string>;
  listFiles(path: string): Promise<string[]>;
  /** Public URL for a port the sandbox is serving on, when supported. */
  host(port: number): Promise<string | null>;
  kill(): Promise<void>;
}

export class SandboxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SandboxError";
  }
}

export function sandboxConfigured(): boolean {
  return Boolean(process.env.NOVITA_API_KEY);
}

/* eslint-disable @typescript-eslint/no-explicit-any */

async function loadSdk(): Promise<any> {
  if (!sandboxConfigured()) {
    throw new SandboxError(
      "NOVITA_API_KEY is not configured — cannot start a sandbox.",
    );
  }
  try {
    // Indirect specifier keeps the bundler from hard-failing when the optional
    // dependency is absent at build time.
    const specifier = "novita-sandbox";
    return await import(/* webpackIgnore: true */ specifier);
  } catch {
    throw new SandboxError(
      "The `novita-sandbox` package is not installed. Run `npm i novita-sandbox`.",
    );
  }
}

/**
 * The default image the employee works in: Node + Python + git + a headless
 * browser, which covers scaffolding a site, running a scraper and rendering
 * screenshots. Built once and cached by template name on Novita's side.
 */
export const DEFAULT_TEMPLATE_NAME = "vibedash-employee";
export const DEFAULT_TEMPLATE_IMAGE =
  process.env.NOVITA_TEMPLATE_IMAGE || "node:22-bookworm";

export const TEMPLATE_SETUP_COMMANDS = [
  "apt-get update && apt-get install -y --no-install-recommends git curl ca-certificates python3 python3-pip",
  "npm install -g pnpm",
];

/**
 * Build (or rebuild) the employee's sandbox template and return its id. Store
 * the result on the company so later shifts skip straight to `createSandbox`.
 */
export async function buildTemplate(opts?: {
  name?: string;
  image?: string;
  cpuCount?: number;
  memoryMB?: number;
}): Promise<{ templateId: string; buildId: string }> {
  const sdk = await loadSdk();
  const { Template } = sdk;
  if (!Template) throw new SandboxError("novita-sandbox does not export `Template`.");

  let template = Template().fromImage(opts?.image || DEFAULT_TEMPLATE_IMAGE);
  // `runCmd` is the documented setup hook; tolerate SDKs that name it differently.
  for (const command of TEMPLATE_SETUP_COMMANDS) {
    if (typeof template.runCmd === "function") template = template.runCmd(command);
    else if (typeof template.run === "function") template = template.run(command);
  }

  const build = await Template.build(template, opts?.name || DEFAULT_TEMPLATE_NAME, {
    cpuCount: opts?.cpuCount ?? 2,
    memoryMB: opts?.memoryMB ?? 2048,
  });

  return {
    templateId: String(build.templateId ?? build.template_id ?? ""),
    buildId: String(build.buildId ?? build.build_id ?? ""),
  };
}

/**
 * Start a sandbox. `templateId` is optional — without one Novita provisions its
 * default code-interpreter image, which is enough for research and scripting
 * tasks that don't need the full toolchain.
 */
export async function createSandbox(templateId?: string): Promise<SandboxHandle> {
  const sdk = await loadSdk();
  const Sandbox = sdk.Sandbox;
  if (!Sandbox) throw new SandboxError("novita-sandbox does not export `Sandbox`.");

  const sandbox = templateId
    ? await Sandbox.create(templateId)
    : await Sandbox.create();

  return wrap(sandbox);
}

function wrap(sandbox: any): SandboxHandle {
  const normalize = (raw: any): ExecResult => ({
    stdout: String(raw?.stdout ?? raw?.logs?.stdout ?? raw?.logs ?? ""),
    stderr: String(raw?.stderr ?? raw?.logs?.stderr ?? raw?.error ?? ""),
    exitCode: Number(raw?.exitCode ?? raw?.exit_code ?? 0),
  });

  return {
    id: String(sandbox.sandboxId ?? sandbox.id ?? ""),

    async run(command, opts) {
      const raw = await sandbox.commands.run(command, {
        cwd: opts?.cwd,
        timeoutMs: opts?.timeoutMs ?? 300_000,
      });
      return normalize(raw);
    },

    async runCode(code) {
      if (typeof sandbox.runCode === "function") {
        return normalize(await sandbox.runCode(code));
      }
      // Fall back to writing the script out and executing it.
      await sandbox.files.write("/tmp/_snippet.py", code);
      return normalize(await sandbox.commands.run("python3 /tmp/_snippet.py"));
    },

    async writeFile(path, contents) {
      await sandbox.files.write(path, contents);
    },

    async readFile(path) {
      const raw = await sandbox.files.read(path);
      return typeof raw === "string" ? raw : String(raw ?? "");
    },

    async listFiles(path) {
      const entries = await sandbox.files.list(path);
      if (!Array.isArray(entries)) return [];
      return entries.map((e: any) => String(e?.name ?? e?.path ?? e));
    },

    async host(port) {
      try {
        if (typeof sandbox.getHost === "function") {
          const host = await sandbox.getHost(port);
          return host ? `https://${String(host).replace(/^https?:\/\//, "")}` : null;
        }
      } catch {
        // Port exposure isn't available on every template tier.
      }
      return null;
    },

    async kill() {
      try {
        await sandbox.kill();
      } catch (e) {
        console.error("[sandbox] kill failed", e);
      }
    },
  };
}

/**
 * Run a unit of work in a fresh sandbox and always tear it down — sandboxes bill
 * per second, so a leaked one is a real cost to the user's $20.
 */
export async function withSandbox<T>(
  templateId: string | undefined,
  work: (sandbox: SandboxHandle) => Promise<T>,
): Promise<T> {
  const sandbox = await createSandbox(templateId);
  try {
    return await work(sandbox);
  } finally {
    await sandbox.kill();
  }
}
