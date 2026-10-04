import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCompanyBySlug, mapTask } from "@/lib/employee/companies";
import { tasks } from "@/lib/employee/db";
import { queueBacklog, taskFromRequest } from "@/lib/employee/planner";
import { createTask } from "@/lib/employee/runtime";
import { TASK_KINDS, type TaskKind } from "@/lib/employee/types";

export const runtime = "nodejs";
export const maxDuration = 120;

type Params = { params: Promise<{ slug: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const company = await getCompanyBySlug(userId, slug);
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  const col = await tasks();
  const docs = await col
    .find({ companyId: company._id!.toString() })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();

  return NextResponse.json({ tasks: docs.map(mapTask) });
}

/**
 * Queue work. Two modes:
 *   { request: "..." }  → the employee shapes the founder's words into a task
 *   { autoPlan: true }  → the employee decides what is worth doing next
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const company = await getCompanyBySlug(userId, slug);
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  let body: { request?: string; autoPlan?: boolean; kind?: string; tonight?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    if (body.autoPlan) {
      const created = await queueBacklog(company, 3);
      if (!created.length) {
        return NextResponse.json(
          { error: "The employee could not plan any work — check that NOVITA_API_KEY is set." },
          { status: 502 },
        );
      }
      return NextResponse.json({ tasks: created.map(mapTask) }, { status: 201 });
    }

    const text = (body.request || "").trim();
    if (text.length < 5) {
      return NextResponse.json({ error: "Describe what you want done." }, { status: 400 });
    }

    const planned = await taskFromRequest(company, text);
    if (!planned) {
      // Fall back to a plain task rather than losing the founder's request.
      const kind: TaskKind = TASK_KINDS.includes(body.kind as TaskKind)
        ? (body.kind as TaskKind)
        : "research";
      const fallback = await createTask({
        company,
        title: text.slice(0, 120),
        brief: text,
        kind,
        createdBy: "user",
        tonight: body.tonight ?? false,
      });
      return NextResponse.json({ tasks: [mapTask(fallback)] }, { status: 201 });
    }

    const created = await createTask({
      company,
      title: planned.title,
      brief: planned.brief,
      kind: planned.kind,
      moneyScore: planned.moneyScore,
      rationale: planned.rationale,
      createdBy: "user",
      tonight: body.tonight ?? false,
      managerInput: planned.input,
    });

    return NextResponse.json({ tasks: [mapTask(created)] }, { status: 201 });
  } catch (e) {
    console.error("[tasks] create failed", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not queue the task." },
      { status: 500 },
    );
  }
}
