// ============================================================
// The night shift — what the user is actually buying
// ============================================================
//
// Every night, for each live company with auto mode on: take the task marked
// for tonight (or plan a fresh one), run it, verify it, refill the backlog, and
// email the founder a report they read over coffee.
//
// The whole thing is defensive by design. It runs unattended at 3am against
// third-party APIs, so every step that can fail is contained: one company's
// failure never stops the next company's shift.

import { companies, logActivity, shifts, tasks } from "./db";
import { consumeNightShift, refundNightShift } from "./plan";
import { planTonight, queueBacklog } from "./planner";
import { createTask, newId, runTask } from "./runtime";
import { complete } from "./model";
import { sendEmail } from "@/lib/email-service";
import type { CompanyDoc, ShiftDoc, TaskDoc } from "./types";

export interface ShiftOutcome {
  companyId: string;
  companyName: string;
  status: ShiftDoc["status"];
  taskTitle?: string;
  summary: string;
}

/**
 * Run one company's night shift. Returns an outcome rather than throwing so the
 * cron can report on every company even when several fail.
 */
export async function runNightShift(
  company: CompanyDoc,
  opts?: { force?: boolean },
): Promise<ShiftOutcome> {
  const companyId = company._id!.toString();
  const base = {
    companyId,
    companyName: company.name,
  };

  if (!opts?.force && !company.autoMode) {
    return { ...base, status: "skipped", summary: "Auto mode is off." };
  }
  if (!opts?.force && company.status === "paused") {
    return { ...base, status: "skipped", summary: "Company is paused." };
  }

  const allowance = await consumeNightShift(company.userId);
  if (!allowance.ok && !opts?.force) {
    await recordSkip(company, allowance.reason);
    return { ...base, status: "skipped", summary: allowance.reason };
  }

  const shiftId = newId("shift");
  const shiftCol = await shifts();
  await shiftCol.insertOne({
    shiftId,
    companyId,
    userId: company.userId,
    status: "running",
    taskIds: [],
    startedAt: new Date(),
  });

  await logActivity(companyId, company.userId, "info", "Night shift started", { shiftId });

  try {
    const task = await pickTonightsTask(company, shiftId);

    if (!task) {
      // Nothing was run, so give the shift back rather than charging for silence.
      if (allowance.ok) await refundNightShift(company.userId);
      const summary = "No task could be justified tonight — nothing was run.";
      await finishShift(shiftId, "skipped", summary);
      await logActivity(companyId, company.userId, "warn", summary, { shiftId });
      return { ...base, status: "skipped", summary };
    }

    await shiftCol.updateOne({ shiftId }, { $set: { taskIds: [task.taskId] } });

    const outcome = await runTask(task, company);

    // Keep the backlog stocked so the dashboard always shows what is next.
    await topUpBacklog(company);

    const report = await writeMorningReport(company, task, outcome.summary, outcome.status);
    await finishShift(shiftId, outcome.status === "done" ? "done" : "failed", report);
    await emailReport(company, task, report).catch((e) =>
      console.error("[shift] report email failed", e),
    );

    await logActivity(
      companyId,
      company.userId,
      outcome.status === "done" ? "success" : "warn",
      `Night shift finished: ${task.title}`,
      { shiftId },
    );

    return {
      ...base,
      status: outcome.status === "done" ? "done" : "failed",
      taskTitle: task.title,
      summary: outcome.summary,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`[shift] ${company.name} shift crashed`, e);
    await finishShift(shiftId, "failed", `The shift failed: ${message}`);
    await logActivity(companyId, company.userId, "error", `Night shift failed: ${message}`, {
      shiftId,
    });
    return { ...base, status: "failed", summary: message };
  }
}

/**
 * Tonight's work: the task the user (or last night's planner) flagged, else a
 * freshly planned one, else the highest-scoring queued task.
 */
async function pickTonightsTask(
  company: CompanyDoc,
  shiftId: string,
): Promise<TaskDoc | null> {
  const taskCol = await tasks();
  const companyId = company._id!.toString();

  const flagged = await taskCol.findOne(
    { companyId, tonight: true, status: "queued" },
    { sort: { moneyScore: -1, createdAt: 1 } },
  );
  if (flagged) {
    await taskCol.updateOne({ taskId: flagged.taskId }, { $set: { shiftId } });
    return { ...flagged, shiftId };
  }

  const history = await taskCol
    .find({ companyId })
    .sort({ createdAt: -1 })
    .limit(12)
    .toArray();

  const planned = await planTonight(company, history);
  if (planned) {
    return createTask({
      company,
      title: planned.title,
      brief: planned.brief,
      kind: planned.kind,
      moneyScore: planned.moneyScore,
      rationale: planned.rationale,
      createdBy: "employee",
      tonight: true,
      managerInput: planned.input,
      shiftId,
    });
  }

  const queued = await taskCol.findOne(
    { companyId, status: "queued" },
    { sort: { moneyScore: -1, createdAt: 1 } },
  );
  if (queued) {
    await taskCol.updateOne({ taskId: queued.taskId }, { $set: { shiftId } });
    return { ...queued, shiftId };
  }

  return null;
}

/** Keep at least three queued tasks visible, one of them flagged for tonight. */
async function topUpBacklog(company: CompanyDoc): Promise<void> {
  try {
    const taskCol = await tasks();
    const companyId = company._id!.toString();
    const queued = await taskCol.countDocuments({ companyId, status: "queued" });
    if (queued >= 3) {
      // Make sure exactly one is flagged for the next night.
      const flagged = await taskCol.countDocuments({ companyId, tonight: true, status: "queued" });
      if (flagged === 0) {
        const next = await taskCol.findOne(
          { companyId, status: "queued" },
          { sort: { moneyScore: -1, createdAt: 1 } },
        );
        if (next) await taskCol.updateOne({ taskId: next.taskId }, { $set: { tonight: true } });
      }
      return;
    }
    // Re-read the company so the planner sees whatever tonight's task changed.
    const col = await companies();
    const fresh = (await col.findOne({ _id: company._id })) || company;
    await queueBacklog(fresh, 3 - queued);
  } catch (e) {
    console.error("[shift] topUpBacklog failed", e);
  }
}

/** The thing the user wakes up to. Written to be read in thirty seconds. */
async function writeMorningReport(
  company: CompanyDoc,
  task: TaskDoc,
  summary: string,
  status: string,
): Promise<string> {
  try {
    const { text } = await complete({
      maxTokens: 700,
      temperature: 0.5,
      messages: [
        {
          role: "system",
          content:
            "You are an AI employee writing the short note your founder reads with their coffee. " +
            "Plain language, no corporate register, no bullet-point padding. Be straight about what " +
            "did not work. Never inflate a result or claim revenue that did not arrive.",
        },
        {
          role: "user",
          content: `Company: ${company.name}
Last night's task: ${task.title} (${task.kind})
Outcome: ${status}
What happened: ${summary}

Write the morning note. Three short paragraphs at most:
1. What you did last night and how it went.
2. What it means for the company's money — honestly, including "nothing yet, but it unblocks X".
3. What you intend to do tonight, and the one thing you need from the founder if you need anything.

No greeting, no sign-off, no subject line.`,
        },
      ],
    });
    return text || summary;
  } catch (e) {
    console.error("[shift] writeMorningReport failed", e);
    return summary;
  }
}

async function emailReport(
  company: CompanyDoc,
  task: TaskDoc,
  report: string,
): Promise<void> {
  if (!process.env.RESEND_API_KEY) return;

  const { users } = await import("./users");
  const email = await users.emailFor(company.userId);
  if (!email) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const paragraphs = report
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;">${escapeHtml(p)}</p>`)
    .join("");

  await sendEmail({
    to: email,
    subject: `${company.name} — last night: ${task.title}`,
    html: `<div style="font-family:Georgia,'Times New Roman',serif;font-size:16px;line-height:1.65;color:#111;max-width:580px;margin:0 auto;padding:32px 24px;">
  <div style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#ea580c;margin-bottom:24px;">
    Night shift report
  </div>
  <h1 style="font-size:26px;font-weight:normal;margin:0 0 4px;">${escapeHtml(company.name)}</h1>
  <p style="font-family:ui-monospace,monospace;font-size:12px;color:#888;margin:0 0 28px;">${escapeHtml(task.title)}</p>
  ${paragraphs}
  <p style="margin:32px 0 0;">
    <a href="${appUrl}/dashboard/${company.slug}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:12px 22px;font-family:ui-monospace,monospace;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;">
      Open dashboard
    </a>
  </p>
  <p style="font-size:12px;color:#999;margin-top:32px;font-family:ui-monospace,monospace;">
    Your AI employee works every night while you sleep. $20/mo · cancel anytime.
  </p>
</div>`,
    tags: [{ name: "kind", value: "night-shift" }],
  });
}

async function finishShift(
  shiftId: string,
  status: ShiftDoc["status"],
  report: string,
): Promise<void> {
  const col = await shifts();
  await col.updateOne(
    { shiftId },
    { $set: { status, report, finishedAt: new Date() } },
  );
}

async function recordSkip(company: CompanyDoc, reason: string): Promise<void> {
  const col = await shifts();
  await col.insertOne({
    shiftId: newId("shift"),
    companyId: company._id!.toString(),
    userId: company.userId,
    status: "skipped",
    skipReason: reason,
    taskIds: [],
    startedAt: new Date(),
    finishedAt: new Date(),
  });
}

/**
 * Run every eligible company's shift, one at a time. Sequential on purpose: a
 * serverless cron with a wall-clock limit that fans out to twenty sandboxes at
 * once will be killed halfway through and leave them running.
 */
export async function runAllShifts(limit = 25): Promise<ShiftOutcome[]> {
  const col = await companies();
  const eligible = await col
    .find({ autoMode: true, status: { $in: ["live", "draft"] } })
    .sort({ updatedAt: 1 })
    .limit(limit)
    .toArray();

  const outcomes: ShiftOutcome[] = [];
  for (const company of eligible) {
    outcomes.push(await runNightShift(company));
  }
  return outcomes;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
