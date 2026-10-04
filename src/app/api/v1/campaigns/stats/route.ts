import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { authenticateApiKey } from "@/lib/api-auth";
import { Campaign } from "@/types";

// GET /api/v1/campaigns/stats — get aggregated campaign statistics
export async function GET(request: NextRequest) {
  const authResult = await authenticateApiKey(request);
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  try {
    const { db } = await connectToDatabase();
    const { searchParams } = new URL(request.url);

    // Optional filters
    const platform = searchParams.get("platform");
    const projectId = searchParams.get("projectId");

    const filter: Record<string, unknown> = { userId };
    if (projectId) {
      const { ObjectId } = await import("mongodb");
      if (!ObjectId.isValid(projectId)) {
        return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });
      }
      filter._id = new ObjectId(projectId);
    }

    const projects = await db
      .collection("projects")
      .find(filter, { projection: { campaigns: 1, name: 1, _id: 1 } })
      .toArray();

    // Flatten campaigns
    let allCampaigns: (Campaign & { projectId: string; projectName: string })[] = [];
    for (const project of projects) {
      const campaigns = (project.campaigns || []) as Campaign[];
      for (const c of campaigns) {
        allCampaigns.push({
          ...c,
          projectId: project._id.toString(),
          projectName: project.name,
        });
      }
    }

    // Filter by platform if specified
    if (platform) {
      allCampaigns = allCampaigns.filter((c) => c.platform === platform);
    }

    // Compute aggregated stats
    const totalCampaigns = allCampaigns.length;
    const activeCampaigns = allCampaigns.filter((c) => c.status === "active").length;
    const completedCampaigns = allCampaigns.filter((c) => c.status === "completed").length;
    const pausedCampaigns = allCampaigns.filter((c) => c.status === "paused").length;
    const draftCampaigns = allCampaigns.filter((c) => c.status === "draft").length;

    const totalBudget = allCampaigns.reduce((sum, c) => sum + (c.budget || 0), 0);
    const totalSpent = allCampaigns.reduce((sum, c) => sum + (c.spent || 0), 0);
    const totalImpressions = allCampaigns.reduce((sum, c) => sum + (c.impressions || 0), 0);
    const totalClicks = allCampaigns.reduce((sum, c) => sum + (c.clicks || 0), 0);
    const totalConversions = allCampaigns.reduce((sum, c) => sum + (c.conversions || 0), 0);

    const averageCtr = totalImpressions > 0
      ? parseFloat(((totalClicks / totalImpressions) * 100).toFixed(2))
      : 0;
    const averageConversionRate = totalClicks > 0
      ? parseFloat(((totalConversions / totalClicks) * 100).toFixed(2))
      : 0;
    const averageCostPerClick = totalClicks > 0
      ? parseFloat((totalSpent / totalClicks).toFixed(2))
      : 0;
    const averageCostPerConversion = totalConversions > 0
      ? parseFloat((totalSpent / totalConversions).toFixed(2))
      : 0;

    // By platform breakdown
    const byPlatform: Record<string, { campaigns: number; budget: number; spent: number; impressions: number; clicks: number; conversions: number }> = {};
    for (const c of allCampaigns) {
      if (!byPlatform[c.platform]) {
        byPlatform[c.platform] = { campaigns: 0, budget: 0, spent: 0, impressions: 0, clicks: 0, conversions: 0 };
      }
      byPlatform[c.platform].campaigns++;
      byPlatform[c.platform].budget += c.budget || 0;
      byPlatform[c.platform].spent += c.spent || 0;
      byPlatform[c.platform].impressions += c.impressions || 0;
      byPlatform[c.platform].clicks += c.clicks || 0;
      byPlatform[c.platform].conversions += c.conversions || 0;
    }

    // By status breakdown
    const byStatus: Record<string, number> = {
      draft: draftCampaigns,
      active: activeCampaigns,
      paused: pausedCampaigns,
      completed: completedCampaigns,
    };

    // By project breakdown
    const byProject: Record<string, { projectName: string; campaigns: number; totalSpent: number; totalConversions: number }> = {};
    for (const c of allCampaigns) {
      if (!byProject[c.projectId]) {
        byProject[c.projectId] = { projectName: c.projectName, campaigns: 0, totalSpent: 0, totalConversions: 0 };
      }
      byProject[c.projectId].campaigns++;
      byProject[c.projectId].totalSpent += c.spent || 0;
      byProject[c.projectId].totalConversions += c.conversions || 0;
    }

    // Top performing campaigns (by conversions)
    const topCampaigns = [...allCampaigns]
      .sort((a, b) => (b.conversions || 0) - (a.conversions || 0))
      .slice(0, 5)
      .map((c) => ({
        id: c.id,
        name: c.name,
        platform: c.platform,
        projectName: c.projectName,
        spent: c.spent,
        conversions: c.conversions,
        clicks: c.clicks,
        impressions: c.impressions,
      }));

    return NextResponse.json({
      data: {
        totalCampaigns,
        byStatus,
        totalBudget,
        totalSpent,
        budgetRemaining: totalBudget - totalSpent,
        totalImpressions,
        totalClicks,
        totalConversions,
        averageCtr,
        averageConversionRate,
        averageCostPerClick,
        averageCostPerConversion,
        byPlatform,
        byProject,
        topCampaigns,
      },
    });
  } catch (error) {
    console.error("GET /api/v1/campaigns/stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch campaign stats" },
      { status: 500 }
    );
  }
}
