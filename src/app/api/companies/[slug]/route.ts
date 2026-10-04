import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  deleteCompany,
  getCompanyBySlug,
  mapCompany,
  mapTask,
  updateCompany,
} from "@/lib/employee/companies";
import { activity, documents, shifts, tasks } from "@/lib/employee/db";
import { getPlanState } from "@/lib/employee/plan";
import { capabilities } from "@/lib/employee/managers";
import { recentPosts } from "@/lib/employee/zernio";
import { outreachHistory, outreachCounts } from "@/lib/employee/outreach";

export const runtime = "nodejs";

type Params = { params: Promise<{ slug: string }> };

/** Everything the dashboard needs, in one round trip. */
export async function GET(_request: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const company = await getCompanyBySlug(userId, slug);
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  const companyId = company._id!.toString();
  const [taskCol, docCol, actCol, shiftCol] = await Promise.all([
    tasks(),
    documents(),
    activity(),
    shifts(),
  ]);

  const [taskDocs, docDocs, actDocs, lastShift, plan, posts, emails, emailCounts] =
    await Promise.all([
      taskCol.find({ companyId }).sort({ createdAt: -1 }).limit(40).toArray(),
      docCol.find({ companyId }).sort({ updatedAt: -1 }).limit(20).toArray(),
      actCol.find({ companyId }).sort({ createdAt: -1 }).limit(40).toArray(),
      shiftCol.findOne({ companyId }, { sort: { startedAt: -1 } }),
      getPlanState(userId),
      recentPosts(companyId, 8).catch(() => []),
      outreachHistory(companyId, 10).catch(() => []),
      outreachCounts(companyId).catch(() => ({ sent: 0, replies: 0 })),
    ]);

  return NextResponse.json({
    company: mapCompany(company),
    plan,
    capabilities: capabilities(),
    tasks: taskDocs.map(mapTask),
    documents: docDocs.map((d) => ({
      id: d._id!.toString(),
      title: d.title,
      kind: d.kind,
      updatedAt: d.updatedAt.toISOString(),
    })),
    activity: actDocs
      .map((a) => ({
        id: a._id!.toString(),
        level: a.level,
        message: a.message,
        createdAt: a.createdAt.toISOString(),
      }))
      .reverse(),
    lastShift: lastShift
      ? {
          id: lastShift.shiftId,
          status: lastShift.status,
          report: lastShift.report || "",
          startedAt: lastShift.startedAt.toISOString(),
          finishedAt: lastShift.finishedAt ? lastShift.finishedAt.toISOString() : null,
        }
      : null,
    social: posts,
    email: { recent: emails, ...emailCounts },
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  for (const field of ["name", "mission", "offer", "audience", "pricePoint", "knowledge"]) {
    if (typeof body[field] === "string") patch[field] = (body[field] as string).slice(0, 5000);
  }
  if (typeof body.autoMode === "boolean") patch.autoMode = body.autoMode;
  if (body.status === "live" || body.status === "paused" || body.status === "draft") {
    patch.status = body.status;
  }

  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const updated = await updateCompany(userId, slug, patch);
  if (!updated) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  return NextResponse.json({ company: mapCompany(updated) });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const removed = await deleteCompany(userId, slug);
  if (!removed) return NextResponse.json({ error: "Company not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
