// ============================================================
// Task runtime — turns a queued task into work that happened
// ============================================================

import { randomUUID } from "crypto";
import { companies, documents, logActivity, tasks } from "./db";
import {
  complete,
  completeJson,
  estimateCostUsd,
  FAST_MODEL,
  REASONING_MODEL,
  type CompleteResult,
} from "./model";
import { aiBudgetExhausted, recordAiSpend } from "./plan";
import { getManager, managerAvailable, managerForKind } from "./managers";
import type { ManagerContext, ManagerResult } from "./managers/types";
import type { CompanyDoc, TaskDoc, TaskKind } from "./types";

export function newId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

export function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  );
}

/**
 * Build the context handed to a manager. Every model call made through it is
 * metered against the plan's AI allowance, and every log line lands on the
 * company's ticker.
 */
export function buildContext(company: CompanyDoc, taskId: string): ManagerContext {
  const companyId = company._id!.toString();
  const userId = company.userId;

  /** Run a completion and bill its cost against the plan's AI allowance. */
  const meter = async (fn: () => Promise<CompleteResult>): Promise<CompleteResult> => {
    const result = await fn();
    await recordAiSpend(userId, estimateCostUsd(result.usage, result.model));
    return result;
  };

  return {
    company,
    companyId,
    userId,
    taskId,
    baseUrl: baseUrl(),

    async log(level, message) {
      await logActivity(companyId, userId, level, message, { taskId });
    },

    async think(prompt, opts) {
      const result = await meter(() =>
        complete({
          model: opts?.deep ? REASONING_MODEL : FAST_MODEL,
          maxTokens: opts?.maxTokens ?? 2000,
          temperature: opts?.temperature,
          messages: [
            ...(opts?.system ? [{ role: "system" as const, content: opts.system }] : []),
            { role: "user" as const, content: prompt },
          ],
        }),
      );
      return result.text;
    },

    async thinkJson<T>(prompt: string, opts?: { deep?: boolean; maxTokens?: number; system?: string }) {
      const parsed = await completeJson<T>({
        model: opts?.deep ? REASONING_MODEL : FAST_MODEL,
        maxTokens: opts?.maxTokens ?? 1500,
        messages: [
          ...(opts?.system ? [{ role: "system" as const, content: opts.system }] : []),
          { role: "user" as const, content: prompt },
        ],
      });
      // JSON calls are small; charge a flat conservative estimate rather than
      // threading usage back through completeJson.
      await recordAiSpend(userId, 0.001);
      return parsed;
    },

    async saveDocument(input) {
      const col = await documents();
      const now = new Date();
      const result = await col.insertOne({
        companyId,
        userId,
        title: input.title,
        kind: input.kind,
        body: input.body,
        taskId,
        createdAt: now,
        updatedAt: now,
      });
      return { id: result.insertedId.toString() };
    },
  };
}

export interface RunOutcome {
  status: TaskDoc["status"];
  summary: string;
  result?: ManagerResult;
}

/**
 * Execute one task end to end: claim it, run the manager, verify the work, and
 * write the outcome back. Never throws — a failed task is a recorded failure,
 * not a crashed cron.
 */
export async function runTask(task: TaskDoc, company: CompanyDoc): Promise<RunOutcome> {
  const taskCol = await tasks();
  const ctx = buildContext(company, task.taskId);

  // Claim it. The status guard makes a double-trigger a no-op rather than
  // running the same work twice.
  const claimed = await taskCol.findOneAndUpdate(
    { taskId: task.taskId, status: { $in: ["queued", "failed", "blocked"] } },
    {
      $set: { status: "running", startedAt: new Date(), heartbeatAt: new Date() },
      $inc: { attempts: 1 },
    },
    { returnDocument: "after" },
  );
  if (!claimed) {
    return { status: task.status, summary: "Task was already running elsewhere." };
  }

  if (await aiBudgetExhausted(company.userId)) {
    const message =
      "This month's AI allowance is used up. The employee stops here rather than spending beyond the plan.";
    await taskCol.updateOne(
      { taskId: task.taskId },
      { $set: { status: "blocked", error: message, completedAt: new Date() } },
    );
    await ctx.log("warn", message);
    return { status: "blocked", summary: message };
  }

  const manager = getManager(task.kind) || managerForKind(task.kind);
  if (!manager) {
    const message = `No manager can handle a "${task.kind}" task.`;
    await taskCol.updateOne(
      { taskId: task.taskId },
      { $set: { status: "failed", error: message, completedAt: new Date() } },
    );
    return { status: "failed", summary: message };
  }

  if (!managerAvailable(manager)) {
    const missing = (manager.requires || []).join(", ");
    const message = `${manager.title} needs ${missing}, which is not configured on this deployment.`;
    await taskCol.updateOne(
      { taskId: task.taskId },
      { $set: { status: "blocked", error: message, completedAt: new Date() } },
    );
    await ctx.log("warn", message);
    return { status: "blocked", summary: message };
  }

  await ctx.log("info", `Starting: ${task.title}`);

  let result: ManagerResult;
  try {
    result = await manager.run(task.input || {}, ctx);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[runtime] ${manager.id} threw`, e);
    await ctx.log("error", `${task.title} failed: ${message}`);
    await taskCol.updateOne(
      { taskId: task.taskId },
      { $set: { status: "failed", error: message, completedAt: new Date() } },
    );
    return { status: "failed", summary: message };
  }

  if (result.status === "failed") {
    await ctx.log("error", `${task.title} failed: ${result.error || result.summary}`);
    await taskCol.updateOne(
      { taskId: task.taskId },
      {
        $set: {
          status: "failed",
          error: result.error || result.summary,
          result: { summary: result.summary, artifacts: result.artifacts },
          completedAt: new Date(),
        },
      },
    );
    return { status: "failed", summary: result.summary, result };
  }

  // Verify: did the work actually land?
  await taskCol.updateOne({ taskId: task.taskId }, { $set: { status: "verifying" } });
  let verdict = { ok: true, reason: "verification skipped" };
  try {
    verdict = await manager.verify(task.input || {}, result, ctx);
  } catch (e) {
    console.error(`[runtime] ${manager.id}.verify threw`, e);
  }

  const finalStatus: TaskDoc["status"] = verdict.ok ? "done" : "failed";

  await taskCol.updateOne(
    { taskId: task.taskId },
    {
      $set: {
        status: finalStatus,
        result: {
          summary: result.summary,
          artifacts: result.artifacts,
          projectedMrr: result.projectedMrr,
        },
        verify: verdict,
        error: verdict.ok ? undefined : `Verification failed: ${verdict.reason}`,
        completedAt: new Date(),
      },
    },
  );

  await ctx.log(
    verdict.ok ? "success" : "warn",
    verdict.ok ? `Done: ${task.title}` : `${task.title} did not verify — ${verdict.reason}`,
  );

  // Let the company learn from what just happened.
  if (verdict.ok) await appendKnowledge(company, task, result);

  return { status: finalStatus, summary: result.summary, result };
}

/**
 * Fold the outcome of a task into the company's running knowledge, so the next
 * night's planner knows what has already been tried. Capped so the prompt
 * cannot grow without bound.
 */
async function appendKnowledge(
  company: CompanyDoc,
  task: TaskDoc,
  result: ManagerResult,
): Promise<void> {
  try {
    const entry = `- [${new Date().toISOString().slice(0, 10)}] ${task.kind}: ${task.title} → ${result.summary.slice(0, 300)}`;
    const merged = `${company.knowledge || ""}\n${entry}`.trim();
    // Keep the most recent ~12k characters.
    const trimmed = merged.length > 12_000 ? merged.slice(merged.length - 12_000) : merged;
    const col = await companies();
    await col.updateOne(
      { _id: company._id },
      { $set: { knowledge: trimmed, updatedAt: new Date() } },
    );
  } catch (e) {
    console.error("[runtime] appendKnowledge failed", e);
  }
}

/** Create a task row. */
export async function createTask(input: {
  company: CompanyDoc;
  title: string;
  brief: string;
  kind: TaskKind;
  moneyScore?: number;
  rationale?: string;
  createdBy?: "employee" | "user";
  tonight?: boolean;
  costsCredit?: boolean;
  managerInput?: Record<string, unknown>;
  shiftId?: string;
}): Promise<TaskDoc> {
  const col = await tasks();
  const doc: TaskDoc = {
    taskId: newId("task"),
    companyId: input.company._id!.toString(),
    userId: input.company.userId,
    title: input.title.slice(0, 160),
    brief: input.brief,
    kind: input.kind,
    status: "queued",
    tonight: input.tonight ?? false,
    moneyScore: Math.max(0, Math.min(100, input.moneyScore ?? 50)),
    rationale: input.rationale || "",
    createdBy: input.createdBy || "employee",
    costsCredit: input.costsCredit ?? false,
    input: input.managerInput || {},
    attempts: 0,
    shiftId: input.shiftId,
    createdAt: new Date(),
  };
  await col.insertOne(doc);
  return doc;
}
