import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { authenticateApiKey } from "@/lib/api-auth";
import { ObjectId } from "mongodb";
import { Campaign, CampaignPlatform } from "@/types";

const VALID_PLATFORMS: CampaignPlatform[] = [
  "google", "facebook", "instagram", "twitter", "tiktok",
  "linkedin", "youtube", "pinterest", "snapchat", "reddit", "threads",
];
const VALID_STATUSES = ["draft", "active", "paused", "completed"] as const;

// Helper: find a campaign inside project.campaigns array
function findCampaignInProjects(
  projects: Record<string, unknown>[],
  campaignId: string
): { project: Record<string, unknown>; campaign: Campaign; index: number } | null {
  for (const project of projects) {
    const campaigns = (project.campaigns || []) as Campaign[];
    const index = campaigns.findIndex((c) => c.id === campaignId);
    if (index !== -1) {
      return { project, campaign: campaigns[index], index };
    }
  }
  return null;
}

// GET /api/v1/campaigns/[id] — get a single campaign by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateApiKey(request);
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  try {
    const { id: campaignId } = await params;
    const { db } = await connectToDatabase();

    const projects = await db
      .collection("projects")
      .find({ userId }, { projection: { campaigns: 1, name: 1, _id: 1 } })
      .toArray();

    const found = findCampaignInProjects(projects, campaignId);
    if (!found) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        ...found.campaign,
        projectId: (found.project._id as ObjectId).toString(),
        projectName: found.project.name,
      },
    });
  } catch (error) {
    console.error("GET /api/v1/campaigns/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch campaign" },
      { status: 500 }
    );
  }
}

// PATCH /api/v1/campaigns/[id] — update a campaign
export async function PATCH(
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

    // Find the project containing this campaign
    const projects = await db
      .collection("projects")
      .find({ userId }, { projection: { campaigns: 1, name: 1, _id: 1 } })
      .toArray();

    const found = findCampaignInProjects(projects, campaignId);
    if (!found) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const projectOid = found.project._id as ObjectId;
    const idx = found.index;

    // Allowed fields for update
    const allowedFields: Record<string, (v: unknown) => boolean> = {
      name: (v) => typeof v === "string" && (v as string).length > 0,
      platform: (v) => VALID_PLATFORMS.includes(v as CampaignPlatform),
      status: (v) => VALID_STATUSES.includes(v as typeof VALID_STATUSES[number]),
      budget: (v) => typeof v === "number" && (v as number) >= 0,
      spent: (v) => typeof v === "number" && (v as number) >= 0,
      impressions: (v) => typeof v === "number" && Number.isInteger(v) && (v as number) >= 0,
      clicks: (v) => typeof v === "number" && Number.isInteger(v) && (v as number) >= 0,
      conversions: (v) => typeof v === "number" && Number.isInteger(v) && (v as number) >= 0,
      startDate: (v) => typeof v === "string",
      endDate: (v) => typeof v === "string" || v === null,
    };

    const updateData: Record<string, unknown> = {};
    const errors: string[] = [];

    for (const [key, value] of Object.entries(body)) {
      if (key in allowedFields) {
        if (allowedFields[key](value)) {
          updateData[key] = value;
        } else {
          errors.push(`Invalid value for field '${key}'`);
        }
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { error: "Validation failed", details: errors },
        { status: 400 }
      );
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // Build MongoDB update using positional notation
    const setDoc: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };
    for (const [key, value] of Object.entries(updateData)) {
      setDoc[`campaigns.${idx}.${key}`] = value;
    }

    await db.collection("projects").updateOne(
      { _id: projectOid, userId },
      { $set: setDoc }
    );

    // Re-fetch updated campaign
    const updatedProject = await db
      .collection("projects")
      .findOne({ _id: projectOid, userId }, { projection: { campaigns: 1, name: 1 } });

    const updatedCampaign = (updatedProject?.campaigns || [])[idx];

    return NextResponse.json({
      data: {
        ...updatedCampaign,
        projectId: projectOid.toString(),
        projectName: updatedProject?.name,
      },
      message: "Campaign updated successfully",
    });
  } catch (error) {
    console.error("PATCH /api/v1/campaigns/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update campaign" },
      { status: 500 }
    );
  }
}

// DELETE /api/v1/campaigns/[id] — delete a campaign
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateApiKey(request);
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  try {
    const { id: campaignId } = await params;
    const { db } = await connectToDatabase();

    const projects = await db
      .collection("projects")
      .find({ userId }, { projection: { campaigns: 1, _id: 1 } })
      .toArray();

    const found = findCampaignInProjects(projects, campaignId);
    if (!found) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const projectOid = found.project._id as ObjectId;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.collection("projects").updateOne(
      { _id: projectOid, userId },
      {
        $pull: { campaigns: { id: campaignId } } as any,
        $set: { updatedAt: new Date().toISOString() },
      }
    );

    return NextResponse.json({
      data: { id: campaignId },
      message: "Campaign deleted successfully",
    });
  } catch (error) {
    console.error("DELETE /api/v1/campaigns/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to delete campaign" },
      { status: 500 }
    );
  }
}
