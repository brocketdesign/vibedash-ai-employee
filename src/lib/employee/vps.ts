// ============================================================
// Hostinger VPS host — where the company's website actually lives
// ============================================================
//
// One shared Hostinger VPS runs a small management agent
// (see `scripts/vps-agent.js`) on port 7854, guarded by a shared secret. Each
// company gets an Nginx vhost + webroot at `{subdomain}.{ROOT_DOMAIN}`, so the
// employee can publish a landing page on night one without the user ever
// touching DNS or a server.
//
// The sandbox builds; the VPS hosts. Keeping those separate means a broken
// build never takes the live site down.

export const ROOT_DOMAIN = process.env.VPS_ROOT_DOMAIN || "example.com";
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB per file

const AGENT_PORT = process.env.VPS_AGENT_PORT || "7854";

const SUBDOMAIN_REGEX = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

const RESERVED_SUBDOMAINS = new Set([
  "www", "api", "mail", "ftp", "admin", "dashboard", "app", "blog", "shop",
  "store", "help", "support", "docs", "dev", "staging", "test", "demo",
  "static", "cdn", "media", "img", "images", "assets", "login", "auth",
  "signup", "register", "account", "user", "users", "status", "vibedash",
]);

export class VpsError extends Error {
  constructor(
    message: string,
    readonly status = 500,
  ) {
    super(message);
    this.name = "VpsError";
  }
}

export function isValidSubdomain(sub: string): boolean {
  return SUBDOMAIN_REGEX.test(sub) && !RESERVED_SUBDOMAINS.has(sub);
}

export function liveUrlFor(subdomain: string, path?: string): string {
  const base = `https://${subdomain}.${ROOT_DOMAIN}`;
  if (!path) return base;
  return `${base}/${path.replace(/^\/+/, "")}`;
}

export function vpsConfigured(): boolean {
  return Boolean(process.env.HOSTINGER_HOST_VPS_IP && process.env.HOSTINGER_MGMT_SECRET);
}

/**
 * Format a host for use in a URL. A bare IPv6 literal must be bracketed —
 * `http://2001:db8::1:7854` is not a valid URL and fetch will reject it, so an
 * IPv6-addressed VPS would fail every call without this.
 */
export function formatHost(host: string): string {
  const trimmed = host.trim();
  // Already bracketed, a hostname, or IPv4 — leave alone. Two or more colons
  // is the giveaway for a bare IPv6 literal (a hostname:port has exactly one).
  if (trimmed.startsWith("[") || (trimmed.match(/:/g) || []).length < 2) {
    return trimmed;
  }
  return `[${trimmed}]`;
}

function agentConfig(): { ip: string; secret: string } {
  const ip = process.env.HOSTINGER_HOST_VPS_IP;
  const secret = process.env.HOSTINGER_MGMT_SECRET;
  if (!ip) {
    throw new VpsError(
      "HOSTINGER_HOST_VPS_IP is not configured. Run scripts/setup-vps.sh on the host VPS first.",
      503,
    );
  }
  if (!secret) throw new VpsError("HOSTINGER_MGMT_SECRET is not configured.", 503);
  return { ip: formatHost(ip), secret };
}

/** POST to the VPS management agent and return its parsed JSON body. */
export async function vpsCallJson<T = unknown>(
  endpoint: string,
  body: Record<string, unknown>,
  timeoutMs = 60_000,
): Promise<T> {
  const { ip, secret } = agentConfig();
  const url = `http://${ip}:${AGENT_PORT}${endpoint}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Secret": secret },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new VpsError(`Could not reach the VPS agent at ${url}: ${message}`, 503);
  }

  const text = await response.text().catch(() => "");
  if (!response.ok) {
    throw new VpsError(`VPS ${endpoint} failed (${response.status}): ${text.slice(0, 300)}`, 502);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return {} as T;
  }
}

export async function vpsCall(
  endpoint: string,
  body: Record<string, unknown>,
): Promise<void> {
  await vpsCallJson(endpoint, body);
}

/** Is the host VPS alive? Used by the dashboard's infra indicator. */
export async function vpsHealth(): Promise<{ ok: boolean; detail: string }> {
  if (!vpsConfigured()) return { ok: false, detail: "not configured" };
  const { ip, secret } = agentConfig();
  try {
    const res = await fetch(`http://${ip}:${AGENT_PORT}/health`, {
      headers: { "X-Secret": secret },
      signal: AbortSignal.timeout(8_000),
    });
    return { ok: res.ok, detail: res.ok ? "ready" : `status ${res.status}` };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "unreachable" };
  }
}

// ─── Static site hosting ────────────────────────────────────────────────────

export interface DeployFileInput {
  path: string;
  /** UTF-8 text; encoded to base64 on the way to the agent. */
  content: string;
  mimeType?: string;
}

export interface DeployedFile {
  path: string;
  url: string;
  size: number;
  mimeType: string;
}

/** Strip path traversal, leading slashes and backslashes from a file path. */
export function sanitizeFilePath(rawPath: unknown): string {
  return (typeof rawPath === "string" ? rawPath : "")
    .replace(/\.\./g, "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .trim();
}

export function guessMimeType(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    html: "text/html", htm: "text/html", css: "text/css",
    js: "application/javascript", mjs: "application/javascript",
    json: "application/json", txt: "text/plain", md: "text/markdown",
    svg: "image/svg+xml", png: "image/png", jpg: "image/jpeg",
    jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp",
    ico: "image/x-icon", xml: "application/xml", webmanifest: "application/manifest+json",
  };
  return map[ext] || "application/octet-stream";
}

/** Create the Nginx vhost + webroot for a subdomain. Idempotent on the agent. */
export async function createSite(subdomain: string): Promise<void> {
  if (!isValidSubdomain(subdomain)) {
    throw new VpsError(`"${subdomain}" is not a valid or available subdomain.`, 400);
  }
  await vpsCall("/create-static", { subdomain });
}

/** Push one file to the live site. */
export async function deployFile(
  subdomain: string,
  input: DeployFileInput,
): Promise<DeployedFile> {
  const filePath = sanitizeFilePath(input.path);
  if (!filePath) throw new VpsError("Invalid or missing file path", 400);

  const buffer = Buffer.from(input.content, "utf-8");
  if (buffer.byteLength > MAX_FILE_BYTES) {
    throw new VpsError(`File "${filePath}" exceeds the 10MB per-file limit.`, 413);
  }

  const mimeType = input.mimeType || guessMimeType(filePath);
  await vpsCall("/deploy-static-file", {
    subdomain,
    path: filePath,
    content: buffer.toString("base64"),
    mimeType,
  });

  return {
    path: filePath,
    url: liveUrlFor(subdomain, filePath),
    size: buffer.byteLength,
    mimeType,
  };
}

/** Deploy a whole site in one go, creating the vhost first. */
export async function deploySite(
  subdomain: string,
  files: DeployFileInput[],
): Promise<{ url: string; files: DeployedFile[] }> {
  await createSite(subdomain);
  const deployed: DeployedFile[] = [];
  for (const file of files) {
    deployed.push(await deployFile(subdomain, file));
  }
  return { url: liveUrlFor(subdomain), files: deployed };
}

export async function readFile(subdomain: string, path: string): Promise<string> {
  const result = await vpsCallJson<{ content?: string }>("/get-static-file", {
    subdomain,
    path: sanitizeFilePath(path),
  });
  const content = result?.content ?? "";
  // The agent returns base64 on newer builds and raw text on older ones. Real
  // text files contain characters outside the base64 alphabet, so this is
  // unambiguous.
  return looksLikeBase64(content)
    ? Buffer.from(content, "base64").toString("utf-8")
    : content;
}

export async function deleteFile(subdomain: string, path: string): Promise<void> {
  await vpsCall("/delete-static-file", { subdomain, path: sanitizeFilePath(path) });
}

export async function deleteSite(subdomain: string): Promise<void> {
  await vpsCall("/delete-static", { subdomain });
}

export function looksLikeBase64(s: string): boolean {
  const t = s.replace(/\s/g, "");
  return t.length > 0 && t.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(t);
}

// ─── WordPress provisioning ─────────────────────────────────────────────────

/**
 * Provision a WordPress install on the host VPS for companies whose offer is
 * content-led. Fire-and-forget: the agent accepts the job and calls back when
 * the install finishes.
 */
export async function provisionWordPress(params: {
  subdomain: string;
  siteTitle: string;
  adminUser: string;
  adminPassword: string;
  adminEmail: string;
  dbPassword: string;
  force?: boolean;
  callbackUrl?: string;
}): Promise<string> {
  const { ip } = agentConfig();
  await vpsCallJson("/provision", params, 15_000);
  return ip;
}
