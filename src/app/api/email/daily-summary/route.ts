// ============================================================
// VibeDash — Daily Summary Email API
// POST /api/email/daily-summary
//
// Generates and sends a daily summary email to the user.
// Can be called via cron job or manually.
//
// Body (optional):
//   { "userId": "clerk_user_id" }  — send to specific user
//   {}                              — send to authenticated user
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import { sendToAllRecipients } from "@/lib/email-service";
import { dailySummaryTemplate, type DailySummaryData } from "@/lib/email-templates";
import { getAppUrl } from "@/lib/utils";

export async function POST(request: NextRequest) {
  try {
    const { userId: authUserId } = await auth();
    if (!authUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const targetUserId = body.userId || authUserId;

    const { db } = await connectToDatabase();

    // Get notification settings
    const settings = await db
      .collection("notification_settings")
      .findOne({ userId: targetUserId });

    // Check if daily summary is enabled (default: false)
    if (settings && settings.dailySummary === false) {
      return NextResponse.json({
        success: false,
        message: "Daily summary is disabled for this user",
      });
    }

    // Get user info
    const clerkUser = await currentUser();
    const clerkEmail =
      clerkUser?.emailAddresses.find(
        (e) => e.id === clerkUser.primaryEmailAddressId
      )?.emailAddress ||
      clerkUser?.emailAddresses[0]?.emailAddress ||
      "";

    const userName =
      [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ") ||
      "Vibe Coder";

    if (!clerkEmail) {
      return NextResponse.json(
        { error: "No email address found for user" },
        { status: 400 }
      );
    }

    // Fetch projects
    const projects = await db
      .collection("projects")
      .find({ userId: targetUserId })
      .sort({ updatedAt: -1 })
      .toArray();

    const activeProjects = projects.filter((p) => p.status === "active");

    // Count total commits and tasks
    let totalCommits = 0;
    let newTasks = 0;
    let completedTasks = 0;

    const projectUpdates: DailySummaryData["projectUpdates"] = [];

    for (const project of projects.slice(0, 5)) {
      totalCommits += project.commits || 0;

      const tasks = project.tasks || [];
      newTasks += tasks.filter(
        (t: { status: string }) => t.status === "todo"
      ).length;
      completedTasks += tasks.filter(
        (t: { status: string }) => t.status === "done"
      ).length;

      // Get phase label
      const phaseLabels: Record<string, string> = {
        idea: "💡 Idea",
        prototype: "🗂️ Prototype",
        "free-tier": "🆓 Free Tier",
        premium: "💎 Premium",
        deploy: "🌐 Deploy",
        live: "🚀 Live",
      };

      const phaseProgress = project.phaseProgress || {};
      const currentProgress = phaseProgress[project.currentPhase] || 0;

      projectUpdates.push({
        name: project.name,
        phase: phaseLabels[project.currentPhase] || project.currentPhase,
        progress: currentProgress,
        recentCommits: project.recentCommits?.length || 0,
      });
    }

    // Gather AI insights (latest 3)
    const allInsights: DailySummaryData["aiInsights"] = [];
    for (const project of projects.slice(0, 3)) {
      const latestReview = project.aiReviews?.[project.aiReviews.length - 1];
      if (latestReview) {
        allInsights.push({
          title: `${project.name}: ${latestReview.summary?.substring(0, 60) || "Review available"}`,
          description: latestReview.suggestions?.[0] || "Check the dashboard for details.",
          type: latestReview.bugsFound?.length > 0 ? "warning" : "suggestion",
        });
      }
    }

    // Campaign summary
    let campaignSummary: DailySummaryData["campaignSummary"] | undefined;
    const allCampaigns = projects.flatMap((p) => p.campaigns || []);
    const activeCampaigns = allCampaigns.filter(
      (c: { status: string }) => c.status === "active"
    );
    if (activeCampaigns.length > 0) {
      campaignSummary = {
        activeCampaigns: activeCampaigns.length,
        totalSpend: activeCampaigns.reduce(
          (sum: number, c: { spent: number }) => sum + (c.spent || 0),
          0
        ),
        totalImpressions: activeCampaigns.reduce(
          (sum: number, c: { impressions: number }) => sum + (c.impressions || 0),
          0
        ),
      };
    }

    const appUrl = getAppUrl();

    const today = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const data: DailySummaryData = {
      userName,
      date: today,
      totalProjects: projects.length,
      activeProjects: activeProjects.length,
      totalCommits,
      newTasks,
      completedTasks,
      projectUpdates,
      aiInsights: allInsights,
      campaignSummary,
      dashboardUrl: appUrl,
    };

    const html = dailySummaryTemplate(data);

    const result = await sendToAllRecipients(
      clerkEmail,
      settings?.additionalEmail,
      `📊 VibeDash Daily Summary — ${today}`,
      html,
      [
        { name: "type", value: "daily-summary" },
        { name: "userId", value: targetUserId },
      ]
    );

    return NextResponse.json({
      success: true,
      sentTo: {
        clerkEmail,
        additionalEmail: settings?.additionalEmail || null,
      },
      messageId: result?.data?.id || null,
      summary: {
        projects: projects.length,
        activeProjects: activeProjects.length,
        totalCommits,
        completedTasks,
      },
    });
  } catch (error) {
    console.error("POST /api/email/daily-summary error:", error);
    return NextResponse.json(
      {
        error: "Failed to send daily summary",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
