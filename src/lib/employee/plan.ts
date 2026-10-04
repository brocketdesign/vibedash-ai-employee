// ============================================================
// The plan — $20/month to hire an AI employee
// ============================================================
//
// One price, one employee, one company. Everything the employee needs to do its
// job (server, database, email, browser, AI credits) is inside the $20 so the
// user never gets a surprise infrastructure bill.

import type { SubscriptionDoc } from "./types";
import { subscriptions } from "./db";
import { EXTRA_CREDIT_PACKS, PLAN, type PlanState } from "./plan-constants";

// Re-exported for server callers; client components must import these from
// `./plan-constants` directly so the Mongo driver stays out of their bundle.
export { PLAN, EXTRA_CREDIT_PACKS };
export type { PlanState };

function periodBounds(from = new Date()): { start: Date; end: Date } {
  const start = new Date(from);
  const end = new Date(from);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { start, end };
}

/**
 * Read a user's subscription, creating an inactive placeholder on first call
 * and rolling the period over when it has expired. Never throws — an unpaid
 * user still gets a valid (empty) state so the dashboard renders.
 */
export async function getPlanState(userId: string): Promise<PlanState> {
  const doc = await ensureSubscription(userId);
  return {
    active: doc.status === "active",
    status: doc.status,
    companySeats: doc.companySeats,
    taskCredits: doc.taskCredits,
    nightShifts: doc.nightShifts,
    aiCreditsUsd: doc.aiCreditsUsd,
    aiSpentUsd: doc.aiSpentUsd,
    periodEnd: doc.periodEnd ? doc.periodEnd.toISOString() : null,
  };
}

export async function ensureSubscription(userId: string): Promise<SubscriptionDoc> {
  const col = await subscriptions();
  const existing = await col.findOne({ userId });

  if (!existing) {
    const { start, end } = periodBounds();
    const fresh: SubscriptionDoc = {
      userId,
      status: "none",
      companySeats: 0,
      taskCredits: 0,
      nightShifts: 0,
      aiCreditsUsd: 0,
      aiSpentUsd: 0,
      periodStart: start,
      periodEnd: end,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await col.insertOne(fresh);
    return fresh;
  }

  // Roll the period over for an active subscriber whose month has elapsed.
  if (existing.status === "active" && existing.periodEnd < new Date()) {
    const { start, end } = periodBounds();
    const renewed: Partial<SubscriptionDoc> = {
      taskCredits: PLAN.taskCredits,
      nightShifts: PLAN.nightShifts,
      aiCreditsUsd: PLAN.aiCreditsUsd * Math.max(1, existing.companySeats),
      aiSpentUsd: 0,
      periodStart: start,
      periodEnd: end,
      updatedAt: new Date(),
    };
    await col.updateOne({ userId }, { $set: renewed });
    return { ...existing, ...renewed } as SubscriptionDoc;
  }

  return existing;
}

/** Activate (or re-activate) after a successful Stripe checkout / renewal. */
export async function activateSubscription(
  userId: string,
  opts: {
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
    companySeats?: number;
    extraCredits?: number;
    firstMonth?: boolean;
  },
): Promise<void> {
  const col = await subscriptions();
  const { start, end } = periodBounds();
  const seats = Math.max(1, opts.companySeats ?? 1);
  const credits =
    PLAN.taskCredits +
    (opts.extraCredits ?? 0) +
    (opts.firstMonth ? PLAN.firstMonthBonusCredits : 0);

  await col.updateOne(
    { userId },
    {
      $set: {
        status: "active",
        stripeCustomerId: opts.stripeCustomerId,
        stripeSubscriptionId: opts.stripeSubscriptionId,
        companySeats: seats,
        taskCredits: credits,
        nightShifts: PLAN.nightShifts * seats,
        aiCreditsUsd: PLAN.aiCreditsUsd * seats,
        aiSpentUsd: 0,
        periodStart: start,
        periodEnd: end,
        updatedAt: new Date(),
      },
      $setOnInsert: { userId, createdAt: new Date() },
    },
    { upsert: true },
  );
}

export async function setSubscriptionStatus(
  userId: string,
  status: SubscriptionDoc["status"],
): Promise<void> {
  const col = await subscriptions();
  await col.updateOne(
    { userId },
    { $set: { status, updatedAt: new Date() } },
  );
}

export async function findByStripeCustomer(customerId: string) {
  const col = await subscriptions();
  return col.findOne({ stripeCustomerId: customerId });
}

// ─── Metering ───────────────────────────────────────────────────────────────

export type ConsumeResult = { ok: true } | { ok: false; reason: string };

/** Spend one on-demand task credit. */
export async function consumeTaskCredit(userId: string): Promise<ConsumeResult> {
  const col = await subscriptions();
  const result = await col.findOneAndUpdate(
    { userId, status: "active", taskCredits: { $gt: 0 } },
    { $inc: { taskCredits: -1 }, $set: { updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!result) {
    const doc = await col.findOne({ userId });
    return {
      ok: false,
      reason:
        doc?.status !== "active"
          ? "No active subscription — hire your AI employee for $20/mo to run tasks."
          : "Out of task credits for this month. They reset when your period renews.",
    };
  }
  return { ok: true };
}

/** Spend one night shift. Called by the cron before it starts working. */
export async function consumeNightShift(userId: string): Promise<ConsumeResult> {
  const col = await subscriptions();
  const result = await col.findOneAndUpdate(
    { userId, status: "active", nightShifts: { $gt: 0 } },
    { $inc: { nightShifts: -1 }, $set: { updatedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!result) {
    const doc = await col.findOne({ userId });
    return {
      ok: false,
      reason:
        doc?.status !== "active"
          ? "No active subscription"
          : "No night shifts left this period",
    };
  }
  return { ok: true };
}

/**
 * Give a night shift back when it produced nothing. Capped at the plan maximum
 * so a repeated refund can never mint shifts the user did not pay for.
 */
export async function refundNightShift(userId: string): Promise<void> {
  const col = await subscriptions();
  const doc = await col.findOne({ userId });
  if (!doc || doc.status !== "active") return;

  const cap = PLAN.nightShifts * Math.max(1, doc.companySeats);
  if (doc.nightShifts >= cap) return;

  await col.updateOne(
    { userId },
    { $inc: { nightShifts: 1 }, $set: { updatedAt: new Date() } },
  );
}

/** Record AI spend against the included allowance. */
export async function recordAiSpend(userId: string, usd: number): Promise<void> {
  if (!usd || usd <= 0) return;
  const col = await subscriptions();
  await col.updateOne(
    { userId },
    { $inc: { aiSpentUsd: usd }, $set: { updatedAt: new Date() } },
  );
}

/** True when the employee has burned through the month's AI allowance. */
export async function aiBudgetExhausted(userId: string): Promise<boolean> {
  const col = await subscriptions();
  const doc = await col.findOne({ userId });
  if (!doc || doc.status !== "active") return false;
  return doc.aiSpentUsd >= doc.aiCreditsUsd;
}
