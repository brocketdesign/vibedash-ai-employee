"use client";

import { useState } from "react";
import { EXTRA_CREDIT_PACKS, PLAN } from "@/lib/employee/plan-constants";
import type { PlanState } from "./api-types";

/**
 * The hire card. Two states: not hired (the pitch and the price) and hired
 * (what is left in the period). Deliberately shows the daily price — $0.67 is
 * a different decision from $20.
 */
export function SubscribeCard({ plan, returnTo }: { plan: PlanState; returnTo: string }) {
  const [open, setOpen] = useState(false);

  if (plan.active) {
    return (
      <div className="card p-6">
        <p className="label">Your AI employee</p>
        <p className="display mt-2 text-3xl">Hired</p>
        <dl className="mt-5 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt style={{ color: "var(--muted-ink)" }}>Night shifts left</dt>
            <dd className="mono">{plan.nightShifts}</dd>
          </div>
          <div className="flex justify-between">
            <dt style={{ color: "var(--muted-ink)" }}>Task credits</dt>
            <dd className="mono">{plan.taskCredits}</dd>
          </div>
          <div className="flex justify-between">
            <dt style={{ color: "var(--muted-ink)" }}>AI credits</dt>
            <dd className="mono">
              ${Math.max(0, plan.aiCreditsUsd - plan.aiSpentUsd).toFixed(2)} left
            </dd>
          </div>
        </dl>
        {plan.periodEnd && (
          <p className="label mt-4">
            Renews {new Date(plan.periodEnd).toLocaleDateString()}
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="card p-8 text-center">
        <h2 className="display text-4xl leading-tight">
          Hire Your AI
          <br />
          Employee
        </h2>
        <p className="label mt-3">
          ${PLAN.perDayUsd.toFixed(2)}/day · Works while you sleep
        </p>

        <button className="btn btn-solid mt-6 w-full" onClick={() => setOpen(true)}>
          Subscribe
        </button>
        <p className="label mt-3">${PLAN.priceUsd}/mo · Cancel anytime</p>
      </div>

      {open && <PlanDialog onClose={() => setOpen(false)} returnTo={returnTo} />}
    </>
  );
}

function PlanDialog({ onClose, returnTo }: { onClose: () => void; returnTo: string }) {
  const [extraCompanies, setExtraCompanies] = useState(0);
  const [credits, setCredits] = useState<number>(PLAN.taskCredits);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pack = EXTRA_CREDIT_PACKS.find((p) => p.credits === credits) ?? EXTRA_CREDIT_PACKS[0];
  const total = PLAN.priceUsd + extraCompanies * PLAN.extraCompanyUsd + pack.priceUsd;

  async function checkout() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extraCompanies, extraCredits: credits, returnTo }),
      });
      const body = await res.json();
      if (!res.ok || !body.url) {
        setError(body.error || "Could not start checkout.");
        return;
      }
      window.location.href = body.url;
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Hire your AI employee"
      onClick={onClose}
    >
      <div
        className="employee w-full max-w-lg bg-white p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between">
          <h2 className="display text-3xl">Your AI Employee</h2>
          <button className="btn btn-sm" onClick={onClose}>
            Close
          </button>
        </div>

        <p style={{ color: "var(--muted-ink)" }}>Works every night while you sleep.</p>

        <div className="card mt-6 p-6">
          <div className="flex items-baseline gap-1">
            <span className="display text-6xl">${PLAN.priceUsd}</span>
            <span className="text-lg" style={{ color: "var(--muted-ink)" }}>
              /month
            </span>
          </div>
          <p className="label mt-1" style={{ color: "var(--accent)" }}>
            Cancel anytime
          </p>

          <p className="label mt-6">Includes:</p>
          <ul className="mt-3 space-y-2 text-[15px]">
            {PLAN.features.map((feature, i) => (
              <li key={feature} className="flex gap-3">
                <span style={{ color: "var(--accent)" }}>✓</span>
                <span>
                  {feature}
                  {i === 2 && (
                    <span className="mono text-xs" style={{ color: "var(--accent)" }}>
                      {" "}
                      (+{PLAN.firstMonthBonusCredits} first month)
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex items-center justify-between border-t pt-5 rule">
            <div>
              <p className="text-[15px]">Extra companies</p>
              <p className="text-sm italic" style={{ color: "var(--muted-ink)" }}>
                Run your own fund
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="label">+${PLAN.extraCompanyUsd}/mo each</span>
              <button
                className="btn btn-sm"
                onClick={() => setExtraCompanies((n) => Math.max(0, n - 1))}
                aria-label="One fewer company"
              >
                −
              </button>
              <span className="mono w-4 text-center">{extraCompanies}</span>
              <button
                className="btn btn-sm"
                onClick={() => setExtraCompanies((n) => Math.min(20, n + 1))}
                aria-label="One more company"
              >
                +
              </button>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between border-t pt-5 rule">
            <div>
              <p className="text-[15px]">Extra task credits</p>
              <p className="text-sm italic" style={{ color: "var(--muted-ink)" }}>
                Instant or recurring tasks
              </p>
            </div>
            <select
              className="field w-auto"
              value={credits}
              onChange={(e) => setCredits(Number(e.target.value))}
              aria-label="Task credits per month"
            >
              {EXTRA_CREDIT_PACKS.map((p) => (
                <option key={p.credits} value={p.credits}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <p className="mono mt-4 text-xs" style={{ color: "#dc2626" }} role="alert">
            {error}
          </p>
        )}

        <button className="btn btn-solid mt-6 w-full" onClick={checkout} disabled={busy}>
          {busy ? "Opening checkout…" : `Subscribe · $${total}/mo`}
        </button>
      </div>
    </div>
  );
}
