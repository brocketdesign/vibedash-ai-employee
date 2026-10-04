// ============================================================
// The planner — decides what the employee works on tonight
// ============================================================
//
// One instruction governs everything below: the employee is paid to make the
// company money, and it has one task per night to do it with. That scarcity is
// the whole design. A planner that queues "improve the README" has wasted a
// night the user paid for.
//
// The planner is explicitly told the sequencing that actually works for a small
// company, because left to itself an LLM will happily research forever:
//
//   1. Somewhere to land        (no page → nothing converts)
//   2. Something to buy         (no checkout → nothing earns)
//   3. Someone who knows        (no traffic → no one converts)
//   4. Better words / better price (compound what already works)
//   5. Paid acquisition         (only once 1-4 are proven)

import { managerMenu, MANAGERS, managerAvailable } from "./managers";
import { completeJson } from "./model";
import { recordAiSpend } from "./plan";
import { tasks } from "./db";
import { companyBrief } from "./managers/types";
import type { CompanyDoc, TaskKind } from "./types";
import { createTask } from "./runtime";
import type { TaskDoc } from "./types";

export interface PlannedTask {
  title: string;
  kind: TaskKind;
  brief: string;
  moneyScore: number;
  rationale: string;
  input: Record<string, unknown>;
}

const PLANNER_SYSTEM = `You are the operating brain of an AI employee hired for $20/month to make one small company money.

You get ONE task per night. Not a backlog, not a strategy deck — one thing that happens while the founder sleeps.

How to choose, in order. Do not skip a step because a later one is more interesting:

1. Can a stranger land somewhere and understand what this is? If not: build the page. Nothing else matters yet.
2. Can that stranger give the company money? If not: build or fix the checkout / pricing.
3. Does anyone know it exists? If not: distribution — social, outreach, content.
4. Is what already works being wasted? Better copy, better price, better packaging on existing traffic beats new traffic.
5. Only once 1-4 hold: paid acquisition.

Rules:
- Research is a means, never an end. Only queue research when the NEXT money task is blocked on not knowing something specific, and name that task in the rationale.
- Never queue outreach without real email addresses already in hand. Inventing prospects is a firing offence.
- Never repeat work that is already in the history below. If the last three nights were all research, stop researching and ship something.
- Be honest in moneyScore. Most single tasks for a pre-revenue company are worth 0 directly; score them on how much they unblock.
- The rationale is read by the founder in the morning. Write it to them, in one or two plain sentences, saying what you are doing and why it is the highest-value use of tonight.`;

/**
 * Choose tonight's task. Returns null when the planner cannot justify any work,
 * which is a legitimate outcome — a wasted night is worse than a skipped one.
 */
export async function planTonight(
  company: CompanyDoc,
  history: TaskDoc[],
): Promise<PlannedTask | null> {
  const available = Object.values(MANAGERS).filter(managerAvailable);
  if (!available.length) return null;

  const historyText = history.length
    ? history
        .slice(0, 12)
        .map(
          (t) =>
            `- ${new Date(t.createdAt).toISOString().slice(0, 10)} [${t.kind}] ${t.title} → ${t.status}${
              t.result?.summary ? `: ${t.result.summary.slice(0, 160)}` : ""
            }`,
        )
        .join("\n")
    : "Nothing yet — this is the first night.";

  const plan = await completeJson<PlannedTask>({
    deep: true,
    maxTokens: 1200,
    temperature: 0.5,
    messages: [
      { role: "system", content: PLANNER_SYSTEM },
      {
        role: "user",
        content: `${companyBrief(company)}

## What I have already done
${historyText}

## What I can do tonight
${managerMenu()}

Pick exactly ONE task for tonight. Reply with JSON only:

{
  "kind": "one of: ${Object.values(MANAGERS).map((m) => m.kind).join(" | ")}",
  "title": "short imperative title the founder will see",
  "brief": "what specifically to do",
  "moneyScore": 0-100,
  "rationale": "one or two sentences to the founder: what you are doing tonight and why it is the best use of it",
  "input": { "...": "the exact parameters that manager's schema requires" }
}

Do not pick a kind marked UNAVAILABLE.`,
      },
    ],
  });

  await recordAiSpend(company.userId, 0.01);

  if (!plan?.kind || !plan?.title) return null;

  const manager = available.find((m) => m.kind === plan.kind);
  if (!manager) return null;

  return {
    title: String(plan.title).slice(0, 160),
    kind: manager.kind,
    brief: String(plan.brief || plan.title),
    moneyScore: Math.max(0, Math.min(100, Number(plan.moneyScore) || 50)),
    rationale: String(plan.rationale || ""),
    input: (plan.input && typeof plan.input === "object" ? plan.input : {}) as Record<string, unknown>,
  };
}

/**
 * Fill the visible backlog. The dashboard shows a handful of queued tasks so the
 * user can see what their employee intends to do next and reorder it — the
 * night shift then takes whichever is marked for tonight, or plans fresh.
 */
export async function proposeBacklog(
  company: CompanyDoc,
  history: TaskDoc[],
  count = 3,
): Promise<PlannedTask[]> {
  const available = Object.values(MANAGERS).filter(managerAvailable);
  if (!available.length) return [];

  const result = await completeJson<{ tasks: PlannedTask[] }>({
    deep: true,
    maxTokens: 2500,
    temperature: 0.6,
    messages: [
      { role: "system", content: PLANNER_SYSTEM },
      {
        role: "user",
        content: `${companyBrief(company)}

## Already done
${history.slice(0, 10).map((t) => `- [${t.kind}] ${t.title} → ${t.status}`).join("\n") || "Nothing yet."}

## Available capabilities
${managerMenu()}

Propose the next ${count} tasks, in the order you would run them on consecutive nights.
They must build on each other — night 2 should depend on what night 1 produced.

Reply with JSON only:
{"tasks": [{"kind": "...", "title": "...", "brief": "...", "moneyScore": 0-100, "rationale": "...", "input": {...}}]}`,
      },
    ],
  });

  await recordAiSpend(company.userId, 0.02);

  return (result?.tasks || [])
    .filter((t) => t && available.some((m) => m.kind === t.kind))
    .slice(0, count)
    .map((t) => ({
      title: String(t.title).slice(0, 160),
      kind: t.kind,
      brief: String(t.brief || t.title),
      moneyScore: Math.max(0, Math.min(100, Number(t.moneyScore) || 50)),
      rationale: String(t.rationale || ""),
      input: (t.input && typeof t.input === "object" ? t.input : {}) as Record<string, unknown>,
    }));
}

/** Plan a backlog and persist it as queued tasks. */
export async function queueBacklog(
  company: CompanyDoc,
  count = 3,
): Promise<TaskDoc[]> {
  const taskCol = await tasks();
  const history = await taskCol
    .find({ companyId: company._id!.toString() })
    .sort({ createdAt: -1 })
    .limit(12)
    .toArray();

  const planned = await proposeBacklog(company, history, count);
  const created: TaskDoc[] = [];

  for (const [index, plan] of planned.entries()) {
    created.push(
      await createTask({
        company,
        title: plan.title,
        brief: plan.brief,
        kind: plan.kind,
        moneyScore: plan.moneyScore,
        rationale: plan.rationale,
        createdBy: "employee",
        tonight: index === 0,
        managerInput: plan.input,
      }),
    );
  }

  return created;
}

/**
 * Turn a free-text request from the user into a properly-shaped task. Used by
 * the "+ New task" box and by the chat when the user asks for something
 * directly rather than through a tool call.
 */
export async function taskFromRequest(
  company: CompanyDoc,
  request: string,
): Promise<PlannedTask | null> {
  const available = Object.values(MANAGERS).filter(managerAvailable);
  if (!available.length) return null;

  const plan = await completeJson<PlannedTask>({
    maxTokens: 900,
    messages: [
      {
        role: "system",
        content:
          "You convert a founder's request into one structured task for an AI employee. " +
          "Pick the capability that genuinely fits — do not force a request into the wrong one. " +
          "Fill the manager's input schema as completely as the request allows.",
      },
      {
        role: "user",
        content: `${companyBrief(company)}

The founder asked for: "${request}"

Available capabilities:
${managerMenu()}

Reply with JSON only:
{"kind": "...", "title": "...", "brief": "...", "moneyScore": 0-100, "rationale": "why this serves the request", "input": {...}}`,
      },
    ],
  });

  await recordAiSpend(company.userId, 0.005);

  if (!plan?.kind) return null;
  const manager = available.find((m) => m.kind === plan.kind);
  if (!manager) return null;

  return {
    title: String(plan.title || request).slice(0, 160),
    kind: manager.kind,
    brief: String(plan.brief || request),
    moneyScore: Math.max(0, Math.min(100, Number(plan.moneyScore) || 50)),
    rationale: String(plan.rationale || ""),
    input: (plan.input && typeof plan.input === "object" ? plan.input : {}) as Record<string, unknown>,
  };
}
