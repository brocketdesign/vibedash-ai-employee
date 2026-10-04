// ============================================================
// Plan constants — safe to import from client components
// ============================================================
//
// Deliberately free of any database or server-only import: the pricing card,
// the landing page and the checkout dialog all render in the browser, and
// pulling `plan.ts` into that bundle would drag the Mongo driver with it.

export const PLAN = {
  priceUsd: 20,
  perDayUsd: 0.67,
  /** Companies included; each extra seat is another $20/mo. */
  includedCompanies: 1,
  extraCompanyUsd: 20,
  /** One task per night, a month at a time. */
  nightShifts: 30,
  /** On-demand tasks the user can fire outside the night shift. */
  taskCredits: 5,
  firstMonthBonusCredits: 10,
  /** AI spend the employee may burn on the company's behalf. */
  aiCreditsUsd: 5,
  features: [
    "1 company",
    "30 night shifts (1 task/day)",
    "5 task credits/month",
    "Unlimited Strategy & Planning Chat",
    "Server, Database, Email, Browser included",
    "$5/mo AI credits for your company",
  ],
} as const;

export const EXTRA_CREDIT_PACKS = [
  { credits: 5, priceUsd: 0, label: "5 (included)" },
  { credits: 15, priceUsd: 10, label: "15 (+$10/mo)" },
  { credits: 30, priceUsd: 20, label: "30 (+$20/mo)" },
  { credits: 60, priceUsd: 35, label: "60 (+$35/mo)" },
] as const;

/** The subscription snapshot the dashboard renders. Mirrors the DB shape. */
export interface PlanState {
  active: boolean;
  status: "none" | "active" | "past_due" | "canceled";
  companySeats: number;
  taskCredits: number;
  nightShifts: number;
  aiCreditsUsd: number;
  aiSpentUsd: number;
  periodEnd: string | null;
}
