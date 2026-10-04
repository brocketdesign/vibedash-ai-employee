// ============================================================
// Novita LLM client — the AI employee's brain
// ============================================================
//
// Novita exposes an OpenAI-compatible surface, so this is a thin typed fetch
// wrapper rather than another SDK dependency. Two tiers:
//
//   FAST      deepseek/deepseek-v4-flash — the workhorse. Every shift step,
//             every draft, every classification runs here. Cheap and quick.
//   REASONING deepseek/deepseek-v4-pro   — planning the night, judging whether
//             a task actually made money. Used sparingly.
//
// Both are overridable via env so the model lineup can move without a deploy.

const BASE_URL =
  process.env.NOVITA_BASE_URL?.replace(/\/+$/, "") || "https://api.novita.ai/openai/v1";

export const FAST_MODEL = process.env.NOVITA_MODEL || "deepseek/deepseek-v4-flash";
export const REASONING_MODEL =
  process.env.NOVITA_REASONING_MODEL || "deepseek/deepseek-v4-pro";

export type Role = "system" | "user" | "assistant" | "tool";

export interface ChatMessage {
  role: Role;
  content: string | null;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ToolDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface CompleteOptions {
  messages: ChatMessage[];
  model?: string;
  tools?: ToolDef[];
  temperature?: number;
  maxTokens?: number;
  /** Ask the model for a JSON object rather than prose. */
  json?: boolean;
  /** Shorthand for the reasoning tier; ignored when `model` is set explicitly. */
  deep?: boolean;
  signal?: AbortSignal;
}

export interface CompleteResult {
  text: string;
  toolCalls: ToolCall[];
  usage: { promptTokens: number; completionTokens: number };
  model: string;
}

export class ModelError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ModelError";
  }
}

function apiKey(): string {
  const key = process.env.NOVITA_API_KEY;
  if (!key) {
    throw new ModelError(
      "NOVITA_API_KEY is not configured — the AI employee cannot think without it.",
    );
  }
  return key;
}

/** True when the platform is wired up enough for the employee to run at all. */
export function modelConfigured(): boolean {
  return Boolean(process.env.NOVITA_API_KEY);
}

/**
 * One chat completion. Retries twice on 429/5xx with a short backoff, because a
 * night shift running unattended should ride out a blip rather than fail the
 * whole task.
 */
export async function complete(opts: CompleteOptions): Promise<CompleteResult> {
  const model = opts.model || (opts.deep ? REASONING_MODEL : FAST_MODEL);
  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.6,
    max_tokens: opts.maxTokens ?? 2048,
  };
  if (opts.tools?.length) {
    body.tools = opts.tools;
    body.tool_choice = "auto";
  }
  if (opts.json) body.response_format = { type: "json_object" };

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(600 * attempt);
    try {
      const res = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: opts.signal ?? AbortSignal.timeout(180_000),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        if (res.status === 429 || res.status >= 500) {
          lastError = new ModelError(
            `Novita ${res.status}: ${detail.slice(0, 300)}`,
            res.status,
          );
          continue;
        }
        throw new ModelError(`Novita ${res.status}: ${detail.slice(0, 300)}`, res.status);
      }

      const data = (await res.json()) as {
        choices?: Array<{
          message?: { content?: string | null; tool_calls?: ToolCall[] };
        }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const message = data.choices?.[0]?.message;
      return {
        text: (message?.content || "").trim(),
        toolCalls: message?.tool_calls || [],
        usage: {
          promptTokens: data.usage?.prompt_tokens ?? 0,
          completionTokens: data.usage?.completion_tokens ?? 0,
        },
        model,
      };
    } catch (e) {
      lastError = e;
      if (e instanceof ModelError && e.status && e.status < 500 && e.status !== 429) {
        throw e;
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new ModelError("Novita request failed after 3 attempts");
}

/** Stream a completion as plain text deltas — used by the strategy chat. */
export async function* streamText(
  opts: CompleteOptions,
): AsyncGenerator<string, void, unknown> {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model || FAST_MODEL,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 2048,
      stream: true,
    }),
    signal: opts.signal ?? AbortSignal.timeout(180_000),
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new ModelError(`Novita ${res.status}: ${detail.slice(0, 300)}`, res.status);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const chunk = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const delta = chunk.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        // A partial frame — the remainder arrives with the next chunk.
      }
    }
  }
}

/**
 * Ask for JSON and parse it. Models occasionally wrap JSON in prose or a fenced
 * block even under response_format, so the first balanced object/array in the
 * response wins. Returns null rather than throwing — callers decide the fallback.
 */
export async function completeJson<T>(opts: CompleteOptions): Promise<T | null> {
  const { text } = await complete({ ...opts, json: true });
  return parseJson<T>(text);
}

export function parseJson<T>(text: string): T | null {
  if (!text) return null;
  const cleaned = text.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const candidates = [cleaned, firstBalanced(cleaned, "{", "}"), firstBalanced(cleaned, "[", "]")];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // try the next shape
    }
  }
  return null;
}

function firstBalanced(text: string, open: string, close: string): string | null {
  const start = text.indexOf(open);
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === open) depth++;
    else if (text[i] === close) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

/** Rough USD cost, used to meter the $5/mo AI allowance included in the plan. */
export function estimateCostUsd(usage: CompleteResult["usage"], model: string): number {
  // Novita flash tiers are ~$0.28/M in, $0.42/M out; pro tiers ~4x that.
  const pro = model.includes("pro");
  const inRate = pro ? 1.1 : 0.28;
  const outRate = pro ? 1.7 : 0.42;
  return (
    (usage.promptTokens / 1_000_000) * inRate +
    (usage.completionTokens / 1_000_000) * outRate
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
