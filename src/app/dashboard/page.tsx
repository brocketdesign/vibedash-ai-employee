import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { listCompanies, mapCompany } from "@/lib/employee/companies";
import { getPlanState, PLAN } from "@/lib/employee/plan";
import { Terminal } from "@/components/employee/terminal";

export const dynamic = "force-dynamic";

/** The roster: every company this user's employee runs. */
export default async function CompaniesPage() {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const [docs, plan] = await Promise.all([listCompanies(userId), getPlanState(userId)]);
  const companies = docs.map(mapCompany);

  if (companies.length === 0) redirect("/new");

  return (
    <div className="employee min-h-screen">
      <Terminal
        lines={[
          {
            message: plan.active
              ? `${plan.nightShifts} night shifts left this period.`
              : "Not hired yet — your employee is standing by.",
          },
        ]}
        rows={3}
      />

      <header className="border-b rule">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-6 sm:px-6">
          <Link href="/" className="display text-2xl">
            VibeDash
          </Link>
          <Link href="/new" className="btn btn-sm">
            + New company
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <h1 className="display text-5xl">Your companies</h1>
        <p className="mt-3 text-lg" style={{ color: "var(--muted-ink)" }}>
          {plan.active
            ? `${plan.taskCredits} task credits and ${plan.nightShifts} night shifts left this period.`
            : `Your employee works for $${PLAN.priceUsd}/month. Open a company to hire it.`}
        </p>

        <ul className="mt-12 space-y-px" style={{ background: "var(--rule)" }}>
          {companies.map((company) => (
            <li key={company.id} className="bg-white">
              <Link
                href={`/dashboard/${company.slug}`}
                className="flex items-baseline justify-between gap-4 p-6 hover:bg-neutral-50"
              >
                <div className="min-w-0">
                  <h2 className="display text-2xl">{company.name}</h2>
                  <p
                    className="mt-1 line-clamp-2 text-[15px]"
                    style={{ color: "var(--muted-ink)" }}
                  >
                    {company.mission}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="label">{company.status}</p>
                  <p className="mono mt-1 text-sm">${company.metrics.mrr.toFixed(2)} MRR</p>
                  {!company.autoMode && <p className="label mt-1">auto off</p>}
                </div>
              </Link>
            </li>
          ))}
        </ul>

        <p className="label mt-10">
          <Link href="/workspace" className="underline underline-offset-4 hover:text-black">
            Project workspace →
          </Link>
        </p>
      </main>
    </div>
  );
}
