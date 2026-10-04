// ============================================================
// Manager agents — one file per capability the employee has
// ============================================================
//
// Every manager is pointed at money. A manager is a small uniform unit:
//
//   id           what the planner delegates to
//   description  tells the planner WHEN this is the right lever
//   moneyPath    tells the planner HOW this turns into revenue
//   run()        does the real work with real tools
//   verify()     confirms the work actually landed
//
// Adding a capability is one file plus one line in the registry. Everything
// else — task rows, the ticker, the morning report, the chat tool surface — is
// generated from this shape.

import type { CompanyDoc, TaskArtifact, TaskKind } from "../types";

export interface ManagerResult {
  status: "done" | "failed" | "awaiting_callback";
  /** One paragraph the user reads in the morning. Written for a human. */
  summary: string;
  artifacts: TaskArtifact[];
  /** The manager's honest estimate of monthly revenue impact, in USD. */
  projectedMrr?: number;
  error?: string;
  /** Passed through to verify() and persisted on the task. */
  data?: Record<string, unknown>;
}

export interface VerifyResult {
  ok: boolean;
  reason: string;
}

export interface ManagerContext {
  company: CompanyDoc;
  companyId: string;
  userId: string;
  taskId: string;
  /** Append a line to the company's activity ticker. */
  log(level: "info" | "warn" | "error" | "success", message: string): Promise<void>;
  /** A metered model call. Cost is billed against the plan's AI allowance. */
  think(prompt: string, opts?: ThinkOptions): Promise<string>;
  /** A metered model call that must return JSON. Null if the model wouldn't. */
  thinkJson<T>(prompt: string, opts?: ThinkOptions): Promise<T | null>;
  /** Persist a document the user can read in the dashboard. */
  saveDocument(input: {
    title: string;
    kind: "mission" | "research" | "roadmap" | "report" | "copy" | "list";
    body: string;
  }): Promise<{ id: string }>;
  /** Absolute URL back into the app, e.g. for async callbacks. */
  baseUrl: string;
}

export interface ThinkOptions {
  system?: string;
  /** Use the slower reasoning tier — reserve for planning and judgement. */
  deep?: boolean;
  maxTokens?: number;
  temperature?: number;
}

export interface ManagerAgent {
  id: string;
  title: string;
  kind: TaskKind;
  /** Read by the planner to decide when to delegate here. */
  description: string;
  /** The causal chain from this work to revenue. Keeps the planner honest. */
  moneyPath: string;
  /** JSON Schema for the input the planner supplies (also the tool params). */
  inputSchema: Record<string, unknown>;
  /** Does this manager need paid infrastructure that may not be configured? */
  requires?: Array<"sandbox" | "vps" | "zernio" | "email" | "stripe">;
  run(input: Record<string, unknown>, ctx: ManagerContext): Promise<ManagerResult>;
  verify(
    input: Record<string, unknown>,
    result: ManagerResult,
    ctx: ManagerContext,
  ): Promise<VerifyResult>;
}

/** Convenience: a failed result with a readable reason. */
export function failed(error: string): ManagerResult {
  return { status: "failed", summary: error, artifacts: [], error };
}

/** Convenience: a successful result. */
export function done(
  summary: string,
  artifacts: TaskArtifact[] = [],
  projectedMrr?: number,
): ManagerResult {
  return { status: "done", summary, artifacts, projectedMrr };
}

/** A short profile of the company, injected into every manager prompt. */
export function companyBrief(company: CompanyDoc): string {
  return [
    `Company: ${company.name}`,
    `Mission: ${company.mission}`,
    `Offer: ${company.offer}`,
    `Audience: ${company.audience}`,
    `Price point: ${company.pricePoint}`,
    company.infra.siteUrl ? `Website: ${company.infra.siteUrl}` : null,
    `Current traction: ${company.metrics.visitors} visitors, $${company.metrics.revenue.toFixed(2)} revenue, $${company.metrics.mrr.toFixed(2)} MRR`,
    company.knowledge ? `\nWhat the employee has learned so far:\n${company.knowledge.slice(0, 4000)}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}
