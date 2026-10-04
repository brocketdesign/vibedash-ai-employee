import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createCompany, listCompanies, mapCompany } from "@/lib/employee/companies";
import { getPlanState, PLAN } from "@/lib/employee/plan";
import { queueBacklog } from "@/lib/employee/planner";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [docs, plan] = await Promise.all([listCompanies(userId), getPlanState(userId)]);
  return NextResponse.json({ companies: docs.map(mapCompany), plan });
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { name?: string; pitch?: string; origin?: string; existingUrl?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = (body.name || "").trim();
  const pitch = (body.pitch || "").trim();
  if (!name) return NextResponse.json({ error: "A company name is required." }, { status: 400 });
  if (pitch.length < 10) {
    return NextResponse.json(
      { error: "Tell your employee a little more about the business — one sentence at least." },
      { status: 400 },
    );
  }

  // Seat check: the plan includes one company, extra seats cost $20/mo each.
  const [existing, plan] = await Promise.all([listCompanies(userId), getPlanState(userId)]);
  const allowed = plan.active ? Math.max(1, plan.companySeats) : PLAN.includedCompanies;
  if (existing.length >= allowed) {
    return NextResponse.json(
      {
        error: plan.active
          ? `Your plan covers ${allowed} ${allowed === 1 ? "company" : "companies"}. Add another seat for $${PLAN.extraCompanyUsd}/mo to run more.`
          : "Create your first company free, then hire your employee for $20/mo to put it to work.",
        needsSeat: true,
      },
      { status: 402 },
    );
  }

  try {
    const company = await createCompany({
      userId,
      name,
      pitch,
      origin: body.origin === "existing" ? "existing" : "new",
      existingUrl: body.existingUrl,
    });

    // Give the founder a visible plan straight away rather than an empty board.
    queueBacklog(company, 3).catch((e) =>
      console.error("[companies] initial backlog failed", e),
    );

    return NextResponse.json({ company: mapCompany(company) }, { status: 201 });
  } catch (e) {
    console.error("[companies] create failed", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not create the company." },
      { status: 500 },
    );
  }
}
