import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { authenticateApiKey } from "@/lib/api-auth";
import { ObjectId } from "mongodb";
import { Campaign } from "@/types";

// POST /api/v1/campaigns/[id]/results — send/update metrics for a campaign
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateApiKey(request);
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  try {
    const { id: campaignId } = await params;
    const body = await request.json();
    const { db } = await connectToDatabase();

    // Validate input
    const { spent, impressions, clicks, conversions, status, endDate } = body;
    const errors: string[] = [];

    if (spent !== undefined && (typeof spent !== "number" || spent < 0))
      errors.push("spent must be a non-negative number");
    if (impressions !== undefined && (typeof impressions !== "number" || impressions < 0))
      errors.push("impressions must be a non-negative number");
    if (clicks !== undefined && (typeof clicks !== "number" || clicks < 0))
      errors.push("clicks must be a non-negative number");
    if (conversions !== undefined && (typeof conversions !== "number" || conversions < 0))
      errors.push("conversions must be a non-negative number");
    if (status !== undefined && !["draft", "active", "paused", "completed"].includes(status))
      errors.push("status must be one of: draft, active, paused, completed");

    if (errors.length > 0) {
      return NextResponse.json(
        { error: "Validation failed", details: errors },
        { status: 400 }
      );
    }

    // Find project containing this campaign
    const projects = await db
      .collection("projects")
      .find({ userId }, { projection: { campaigns: 1, name: 1, _id: 1 } })
      .toArray();

    let targetProject: Record<string, unknown> | null = null;
    let campaignIndex = -1;
    let existingCampaign: Campaign | null = null;

    for (const project of projects) {
      const campaigns = (project.campaigns || []) as Campaign[];
      const idx = campaigns.findIndex((c) => c.id === campaignId);
      if (idx !== -1) {
        targetProject = project;
        campaignIndex = idx;
        existingCampaign = campaigns[idx];
        break;
      }
    }

    if (!targetProject || !existingCampaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const projectOid = targetProject._id as ObjectId;

    // Build update — results can be additive (add to existing) or absolute (set to value)
    const mode = body.mode === "additive" ? "additive" : "absolute";

    const setDoc: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (mode === "additive") {
      if (spent !== undefined) setDoc[`campaigns.${campaignIndex}.spent`] = (existingCampaign.spent || 0) + spent;
      if (impressions !== undefined) setDoc[`campaigns.${campaignIndex}.impressions`] = (existingCampaign.impressions || 0) + impressions;
      if (clicks !== undefined) setDoc[`campaigns.${campaignIndex}.clicks`] = (existingCampaign.clicks || 0) + clicks;
      if (conversions !== undefined) setDoc[`campaigns.${campaignIndex}.conversions`] = (existingCampaign.conversions || 0) + conversions;
    } else {
      if (spent !== undefined) setDoc[`campaigns.${campaignIndex}.spent`] = spent;
      if (impressions !== undefined) setDoc[`campaigns.${campaignIndex}.impressions`] = impressions;
      if (clicks !== undefined) setDoc[`campaigns.${campaignIndex}.clicks`] = clicks;
      if (conversions !== undefined) setDoc[`campaigns.${campaignIndex}.conversions`] = conversions;
    }

    if (status) setDoc[`campaigns.${campaignIndex}.status`] = status;
    if (endDate) setDoc[`campaigns.${campaignIndex}.endDate`] = endDate;

    await db.collection("projects").updateOne(
      { _id: projectOid, userId },
      { $set: setDoc }
    );

    // Re-fetch
    const updatedProject = await db
      .collection("projects")
      .findOne({ _id: projectOid, userId }, { projection: { campaigns: 1, name: 1 } });
    const updatedCampaign = (updatedProject?.campaigns || [])[campaignIndex];

    // Compute derived metrics
    const ctr = updatedCampaign.impressions > 0
      ? ((updatedCampaign.clicks / updatedCampaign.impressions) * 100).toFixed(2)
      : "0.00";
    const conversionRate = updatedCampaign.clicks > 0
      ? ((updatedCampaign.conversions / updatedCampaign.clicks) * 100).toFixed(2)
      : "0.00";
    const costPerClick = updatedCampaign.clicks > 0
      ? (updatedCampaign.spent / updatedCampaign.clicks).toFixed(2)
      : "0.00";
    const costPerConversion = updatedCampaign.conversions > 0
      ? (updatedCampaign.spent / updatedCampaign.conversions).toFixed(2)
      : "0.00";

    return NextResponse.json({
      data: {
        ...updatedCampaign,
        projectId: projectOid.toString(),
        projectName: updatedProject?.name,
        derivedMetrics: {
          ctr: parseFloat(ctr),
          conversionRate: parseFloat(conversionRate),
          costPerClick: parseFloat(costPerClick),
          costPerConversion: parseFloat(costPerConversion),
        },
      },
      message: `Campaign results updated (${mode} mode)`,
    });
  } catch (error) {
    console.error("POST /api/v1/campaigns/[id]/results error:", error);
    return NextResponse.json(
      { error: "Failed to update campaign results" },
      { status: 500 }
    );
  }
}
