// ============================================================
// VibeDash — AI Employee core types
// ============================================================
//
// The product model: a user "hires" an AI employee for $20/mo. The employee is
// assigned to a Company. Every night it works a shift: it picks the highest
// expected-value task from the backlog, executes it with real tools (sandbox,
// VPS, email, social, ads), and reports back. Everything it does is scored
// against one metric — money made for the company.

import type { ObjectId } from "mongodb";

// ─── Company ────────────────────────────────────────────────────────────────

/** How the company came to exist — drives the first night's plan. */
export type CompanyOrigin = "new" | "existing";

export type CompanyStatus = "draft" | "live" | "paused";

export interface CompanyMetrics {
  visitors: number;
  /** Gross revenue in USD, all time. */
  revenue: number;
  mrr: number;
  signups: number;
  /** Last time metrics were recomputed from connected sources. */
  updatedAt: string;
}

export interface CompanyInfra {
  /** Novita sandbox template the employee builds/deploys inside. */
  sandboxTemplateId?: string;
  /** Long-lived sandbox id, reused between shifts while it is warm. */
  sandboxId?: string;
  /** Hostinger VPS that hosts the company's site. */
  vpsIp?: string;
  vpsSubdomain?: string;
  vpsStatus?: "none" | "provisioning" | "ready" | "failed";
  /** Public URLs. */
  siteUrl?: string;
  appUrl?: string;
  /** Zernio profile that owns this company's social accounts. */
  zernioProfileId?: string;
  /** Resend sending identity. */
  fromEmail?: string;
  /** Stripe account connected for taking payments (revenue side). */
  stripeAccountId?: string;
}

export interface CompanyDoc {
  _id?: ObjectId;
  userId: string;
  /** URL slug, e.g. "acme-invoicing". */
  slug: string;
  name: string;
  /** One-paragraph mission the employee optimises against. */
  mission: string;
  /** What the company sells and to whom. */
  offer: string;
  audience: string;
  pricePoint: string;
  origin: CompanyOrigin;
  status: CompanyStatus;
  /** When true the employee queues and runs its own work every night. */
  autoMode: boolean;
  metrics: CompanyMetrics;
  infra: CompanyInfra;
  /** Free-form knowledge the employee accumulates (market notes, ICP, voice). */
  knowledge: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Tasks ──────────────────────────────────────────────────────────────────

/**
 * Task kinds map 1:1 onto managers. Each is a lever on revenue; the planner is
 * told what each one is worth so it can choose.
 */
export type TaskKind =
  | "research" // market/competitor/customer intel that feeds every other lever
  | "feature" // ship product in the sandbox, deploy to the VPS
  | "content" // landing page copy, docs, SEO pages
  | "social" // auto-post to X via Zernio
  | "outreach" // cold email to a researched list
  | "ads" // paid acquisition creative + plan
  | "revenue" // pricing, checkout, upsells, churn
  | "ops"; // infra, domains, deploys, housekeeping

export const TASK_KINDS: TaskKind[] = [
  "research",
  "feature",
  "content",
  "social",
  "outreach",
  "ads",
  "revenue",
  "ops",
];

export type TaskStatus =
  | "queued"
  | "running"
  | "awaiting_callback"
  | "verifying"
  | "done"
  | "failed"
  | "blocked";

export interface TaskArtifact {
  label: string;
  url?: string;
  /** Id of a produced document / post / campaign row. */
  id?: string;
  kind?: "doc" | "post" | "email" | "deploy" | "campaign" | "report";
}

export interface TaskDoc {
  _id?: ObjectId;
  taskId: string;
  companyId: string;
  userId: string;
  title: string;
  /** The brief the employee wrote for itself (or the user typed). */
  brief: string;
  kind: TaskKind;
  status: TaskStatus;
  /** Scheduled for the next night shift. */
  tonight: boolean;
  /** Planner's estimate, 0-100, of how much this moves revenue. */
  moneyScore: number;
  /** Why the planner thinks so — shown in the UI. */
  rationale: string;
  /** Set when the user (not the planner) created it. */
  createdBy: "employee" | "user";
  /** Consumes a task credit when run on demand rather than on a night shift. */
  costsCredit: boolean;
  input?: Record<string, unknown>;
  result?: {
    summary: string;
    artifacts: TaskArtifact[];
    /** Revenue impact the employee claims, in USD/month. */
    projectedMrr?: number;
  };
  verify?: { ok: boolean; reason: string };
  error?: string;
  attempts: number;
  shiftId?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  heartbeatAt?: Date;
}

// ─── Night shifts ───────────────────────────────────────────────────────────

export interface ShiftDoc {
  _id?: ObjectId;
  shiftId: string;
  companyId: string;
  userId: string;
  status: "running" | "done" | "failed" | "skipped";
  /** Why a shift was skipped (no subscription, no credits, auto mode off). */
  skipReason?: string;
  taskIds: string[];
  /** The morning report the user wakes up to. */
  report?: string;
  startedAt: Date;
  finishedAt?: Date;
}

// ─── Activity log (the terminal ticker) ─────────────────────────────────────

export type LogLevel = "info" | "warn" | "error" | "success";

export interface ActivityDoc {
  _id?: ObjectId;
  companyId: string;
  userId: string;
  taskId?: string;
  shiftId?: string;
  level: LogLevel;
  message: string;
  createdAt: Date;
}

// ─── Documents the employee writes ──────────────────────────────────────────

export interface DocumentDoc {
  _id?: ObjectId;
  companyId: string;
  userId: string;
  title: string;
  kind: "mission" | "research" | "roadmap" | "report" | "copy" | "list";
  body: string;
  taskId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Chat (unlimited strategy & planning) ───────────────────────────────────

export interface ChatMessageDoc {
  _id?: ObjectId;
  companyId: string;
  userId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

// ─── Subscription / credits ─────────────────────────────────────────────────

export interface SubscriptionDoc {
  _id?: ObjectId;
  userId: string;
  status: "none" | "active" | "past_due" | "canceled";
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  /** Companies paid for (1 included, +$20/mo each extra). */
  companySeats: number;
  /** Task credits remaining this period. */
  taskCredits: number;
  /** Night shifts remaining this period. */
  nightShifts: number;
  /** AI spend allowance in USD for the period, and what has been used. */
  aiCreditsUsd: number;
  aiSpentUsd: number;
  periodStart: Date;
  periodEnd: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─── API shapes ─────────────────────────────────────────────────────────────

export interface CompanyView {
  id: string;
  slug: string;
  name: string;
  mission: string;
  offer: string;
  audience: string;
  pricePoint: string;
  origin: CompanyOrigin;
  status: CompanyStatus;
  autoMode: boolean;
  metrics: CompanyMetrics;
  infra: CompanyInfra;
  createdAt: string;
  updatedAt: string;
}

export interface TaskView {
  id: string;
  title: string;
  brief: string;
  kind: TaskKind;
  status: TaskStatus;
  tonight: boolean;
  moneyScore: number;
  rationale: string;
  createdBy: "employee" | "user";
  result?: TaskDoc["result"];
  error?: string | null;
  createdAt: string;
  completedAt?: string | null;
}
