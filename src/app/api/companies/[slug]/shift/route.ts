import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCompanyBySlug } from "@/lib/employee/companies";
import { consumeTaskCredit } from "@/lib/employee/plan";
import { runNightShift } from "@/lib/employee/shift";

export const runtime = "nodejs";
export const maxDuration = 300;

type Params = { params: Promise<{ slug: string }> };

/**
 * Run tonight's shift right now. Costs a task credit — the founder is buying
 * immediacy, not the work itself, which the plan already covers.
 */
export async function POST(_request: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const company = await getCompanyBySlug(userId, slug);
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  const credit = await consumeTaskCredit(userId);
  if (!credit.ok) {
    return NextResponse.json({ error: credit.reason, needsSubscription: true }, { status: 402 });
  }

  const outcome = await runNightShift(company, { force: true });
  return NextResponse.json({ outcome });
}
