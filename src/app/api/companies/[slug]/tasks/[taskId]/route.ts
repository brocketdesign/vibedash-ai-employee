import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCompanyBySlug, mapTask } from "@/lib/employee/companies";
import { tasks } from "@/lib/employee/db";
import { consumeTaskCredit } from "@/lib/employee/plan";
import { runTask } from "@/lib/employee/runtime";

export const runtime = "nodejs";
export const maxDuration = 300;

type Params = { params: Promise<{ slug: string; taskId: string }> };

/**
 * Run a task now rather than waiting for tonight. This is what a task credit
 * buys — the night shift is included, immediacy is metered.
 */
export async function POST(_request: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, taskId } = await params;
  const company = await getCompanyBySlug(userId, slug);
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  const col = await tasks();
  const task = await col.findOne({ taskId, companyId: company._id!.toString() });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  if (task.status === "running" || task.status === "verifying") {
    return NextResponse.json({ error: "That task is already running." }, { status: 409 });
  }

  const credit = await consumeTaskCredit(userId);
  if (!credit.ok) {
    return NextResponse.json({ error: credit.reason, needsSubscription: true }, { status: 402 });
  }

  try {
    const outcome = await runTask(task, company);
    const updated = await col.findOne({ taskId });
    return NextResponse.json({
      task: updated ? mapTask(updated) : null,
      outcome: { status: outcome.status, summary: outcome.summary },
    });
  } catch (e) {
    console.error("[tasks] run failed", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "The task failed to run." },
      { status: 500 },
    );
  }
}

/** Flag or unflag a task for tonight, or drop it from the backlog. */
export async function PATCH(request: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, taskId } = await params;
  const company = await getCompanyBySlug(userId, slug);
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  let body: { tonight?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const col = await tasks();
  const companyId = company._id!.toString();

  if (typeof body.tonight === "boolean") {
    // Only one task can hold tonight's slot — there is only one night.
    if (body.tonight) {
      await col.updateMany({ companyId, tonight: true }, { $set: { tonight: false } });
    }
    await col.updateOne({ taskId, companyId }, { $set: { tonight: body.tonight } });
  }

  const updated = await col.findOne({ taskId, companyId });
  if (!updated) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  return NextResponse.json({ task: mapTask(updated) });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug, taskId } = await params;
  const company = await getCompanyBySlug(userId, slug);
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  const col = await tasks();
  const result = await col.deleteOne({
    taskId,
    companyId: company._id!.toString(),
    status: { $nin: ["running", "verifying"] },
  });

  if (!result.deletedCount) {
    return NextResponse.json(
      { error: "That task is running and cannot be removed." },
      { status: 409 },
    );
  }
  return NextResponse.json({ ok: true });
}
