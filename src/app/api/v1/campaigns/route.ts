import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { authenticateApiKey } from "@/lib/api-auth";
import { ObjectId } from "mongodb";
import { CampaignPlatform } from "@/types";

const VALID_PLATFORMS: CampaignPlatform[] = [
  "google", "facebook", "instagram", "twitter", "tiktok",
  "linkedin", "youtube", "pinterest", "snapchat", "reddit", "threads",
];

const VALID_STATUSES = ["draft", "active", "paused", "completed"] as const;

// GET /api/v1/campaigns — list all campaigns across all projects
export async function GET(request: NextRequest) {
  const authResult = await authenticateApiKey(request);
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  try {
    const { db } = await connectToDatabase();
    const { searchParams } = new URL(request.url);

    // Filters
    const projectId = searchParams.get("projectId");
    const platform = searchParams.get("platform");
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const sortBy = searchParams.get("sortBy") || "startDate"; // startDate, budget, spent, impressions, clicks, conversions
    const sortOrder = searchParams.get("sortOrder") === "asc" ? 1 : -1;
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    const filter: Record<string, unknown> = { userId };
    if (projectId) {
      if (!ObjectId.isValid(projectId)) {
        return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });
      }
      filter._id = new ObjectId(projectId);
    }

    const projects = await db
      .collection("projects")
      .find(filter, { projection: { campaigns: 1, name: 1, _id: 1 } })
      .toArray();

    // Flatten all campaigns and attach project info
    let allCampaigns: Record<string, unknown>[] = [];
    for (const project of projects) {
      const campaigns = project.campaigns || [];
      for (const c of campaigns) {
        allCampaigns.push({
          ...c,
          projectId: project._id.toString(),
          projectName: project.name,
        });
      }
    }

    // Apply filters
    if (platform) {
      allCampaigns = allCampaigns.filter((c) => c.platform === platform);
    }
    if (status) {
      allCampaigns = allCampaigns.filter((c) => c.status === status);
    }
    if (search) {
      const q = search.toLowerCase();
      allCampaigns = allCampaigns.filter(
        (c) =>
          (c.name as string)?.toLowerCase().includes(q) ||
          (c.platform as string)?.toLowerCase().includes(q) ||
          (c.projectName as string)?.toLowerCase().includes(q)
      );
    }

    // Sort
    const validSortFields = ["startDate", "budget", "spent", "impressions", "clicks", "conversions", "name"];
    const sortField = validSortFields.includes(sortBy) ? sortBy : "startDate";
    allCampaigns.sort((a, b) => {
      const aVal = a[sortField] as number | string;
      const bVal = b[sortField] as number | string;
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortOrder * aVal.localeCompare(bVal);
      }
      return sortOrder * ((aVal as number) - (bVal as number));
    });

    const total = allCampaigns.length;
    const paginated = allCampaigns.slice(offset, offset + limit);

    return NextResponse.json({
      data: paginated,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error("GET /api/v1/campaigns error:", error);
    return NextResponse.json(
      { error: "Failed to fetch campaigns" },
      { status: 500 }
    );
  }
}

// POST /api/v1/campaigns — create a new campaign on a project
export async function POST(request: NextRequest) {
  const authResult = await authenticateApiKey(request);
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  try {
    const body = await request.json();
    const { projectId, name, platform, budget, status, startDate, endDate } = body;

    // Validation
    const errors: string[] = [];
    if (!projectId || !ObjectId.isValid(projectId)) errors.push("Valid projectId is required");
    if (!name || typeof name !== "string") errors.push("name is required");
    if (!platform || !VALID_PLATFORMS.includes(platform)) {
      errors.push(`platform must be one of: ${VALID_PLATFORMS.join(", ")}`);
    }
    if (budget !== undefined && (typeof budget !== "number" || budget < 0)) {
      errors.push("budget must be a non-negative number");
    }
    if (status && !VALID_STATUSES.includes(status)) {
      errors.push(`status must be one of: ${VALID_STATUSES.join(", ")}`);
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { error: "Validation failed", details: errors },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    // Verify project ownership
    const project = await db
      .collection("projects")
      .findOne({ _id: new ObjectId(projectId), userId });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const campaign = {
      id: `camp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      projectId,
      platform,
      name,
      status: status || "draft",
      budget: budget || 0,
      spent: 0,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      startDate: startDate || new Date().toISOString(),
      endDate: endDate || undefined,
      screenshotUrls: [],
      aiAnalysis: undefined,
    };

    // Push campaign into project's campaigns array
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.collection("projects").updateOne(
      { _id: new ObjectId(projectId), userId },
      {
        $push: { campaigns: campaign } as any,
        $set: { updatedAt: new Date().toISOString() },
      }
    );

    // Also add timeline event
    const timelineEvent = {
      id: `evt-${Date.now()}`,
      projectId,
      type: "milestone",
      title: `Campaign "${name}" created (via API)`,
      description: `New ${platform} campaign "${name}" created with budget $${budget || 0}`,
      date: new Date().toISOString(),
      metadata: { campaignId: campaign.id, platform, source: "api" },
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.collection("projects").updateOne(
      { _id: new ObjectId(projectId), userId },
      { $push: { timeline: timelineEvent } as any }
    );

    return NextResponse.json({
      data: campaign,
      message: "Campaign created successfully",
    }, { status: 201 });
  } catch (error) {
    console.error("POST /api/v1/campaigns error:", error);
    return NextResponse.json(
      { error: "Failed to create campaign" },
      { status: 500 }
    );
  }
}
