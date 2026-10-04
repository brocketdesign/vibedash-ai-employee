import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { analyzeMarketingScreenshots } from "@/lib/ai-service-server";
import { CampaignPlatform } from "@/types";

// POST /api/campaigns/analyze — Analyze uploaded campaign screenshots with Grok Vision
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { images, platform, campaignName } = body as {
      images: string[]; // base64 data URLs
      platform: CampaignPlatform;
      campaignName: string;
    };

    if (!images || images.length === 0) {
      return NextResponse.json(
        { error: "At least one screenshot is required" },
        { status: 400 },
      );
    }

    if (!platform || !campaignName) {
      return NextResponse.json(
        { error: "Platform and campaign name are required" },
        { status: 400 },
      );
    }

    // Cap at 4 images to stay within API limits
    const limitedImages = images.slice(0, 4);

    const analysis = await analyzeMarketingScreenshots(
      limitedImages,
      platform,
      campaignName,
    );

    return NextResponse.json({ analysis });
  } catch (error) {
    console.error("POST /api/campaigns/analyze error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to analyze screenshots";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
