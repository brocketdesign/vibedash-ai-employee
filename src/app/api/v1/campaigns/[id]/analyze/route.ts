import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { authenticateApiKey } from "@/lib/api-auth";
import { ObjectId } from "mongodb";
import { Campaign, CampaignPlatform } from "@/types";
import { analyzeMarketingScreenshots } from "@/lib/ai-service-server";

// POST /api/v1/campaigns/[id]/analyze — trigger AI analysis for a campaign
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
    const { images } = body as { images?: string[] };
    const { db } = await connectToDatabase();

    // Find the campaign
    const projects = await db
      .collection("projects")
      .find({ userId }, { projection: { campaigns: 1, name: 1, _id: 1 } })
      .toArray();

    let targetProject: Record<string, unknown> | null = null;
    let campaignIndex = -1;
    let campaign: Campaign | null = null;

    for (const project of projects) {
      const campaigns = (project.campaigns || []) as Campaign[];
      const idx = campaigns.findIndex((c) => c.id === campaignId);
      if (idx !== -1) {
        targetProject = project;
        campaignIndex = idx;
        campaign = campaigns[idx];
        break;
      }
    }

    if (!targetProject || !campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    if (!images || images.length === 0) {
      return NextResponse.json(
        { error: "At least one screenshot image (base64 data URL) is required" },
        { status: 400 }
      );
    }

    const limitedImages = images.slice(0, 4);
    const projectOid = targetProject._id as ObjectId;

    // Run AI analysis
    const analysis = await analyzeMarketingScreenshots(
      limitedImages,
      campaign.platform as CampaignPlatform,
      campaign.name
    );

    // Store analysis result on campaign
    const setDoc: Record<string, unknown> = {
      [`campaigns.${campaignIndex}.aiAnalysis`]: analysis,
      [`campaigns.${campaignIndex}.screenshotUrls`]: limitedImages.map(
        (_, i) => `screenshot-${i + 1}`
      ),
      updatedAt: new Date().toISOString(),
    };

    await db.collection("projects").updateOne(
      { _id: projectOid, userId },
      { $set: setDoc }
    );

    return NextResponse.json({
      data: {
        campaignId,
        projectId: projectOid.toString(),
        analysis,
      },
      message: "Campaign AI analysis completed",
    });
  } catch (error) {
    console.error("POST /api/v1/campaigns/[id]/analyze error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to analyze campaign";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
