import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { DashboardClient } from "@/components/employee/dashboard-client";
import { getCompanyBySlug, mapCompany, mapTask } from "@/lib/employee/companies";
import { activity, documents, shifts, tasks } from "@/lib/employee/db";
import { getPlanState } from "@/lib/employee/plan";
import { capabilities } from "@/lib/employee/managers";
import { recentPosts } from "@/lib/employee/zernio";
import { outreachCounts, outreachHistory } from "@/lib/employee/outreach";
import type { DashboardData } from "@/components/employee/api-types";

export const dynamic = "force-dynamic";

/**
 * Server-rendered first paint so the founder sees last night's work instantly;
 * the client takes over polling from there.
 */
export default async function CompanyDashboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/login");

  const { slug } = await params;
  const company = await getCompanyBySlug(userId, slug);
  if (!company) notFound();

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

  const initial: DashboardData = {
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
  };

  return <DashboardClient slug={slug} initial={initial} />;
}
