// ============================================================
// VibeDash — Notification Settings API
// GET  /api/user/notification-settings — fetch settings
// PUT  /api/user/notification-settings — update settings
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { auth, currentUser } from "@clerk/nextjs/server";

// Default notification preferences
const DEFAULT_SETTINGS = {
  projectUpdates: true,
  githubActivity: true,
  marketingAlerts: true,
  aiInsights: true,
  weeklySummary: true,
  dailySummary: false,
  additionalEmail: "",
  // Today's Top 3 delivery settings
  top3Enabled: true,
  top3Email: true,
  top3InApp: true,
  top3DeliveryTime: "08:00",
};

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clerkUser = await currentUser();
    const clerkEmail =
      clerkUser?.emailAddresses.find(
        (e) => e.id === clerkUser.primaryEmailAddressId
      )?.emailAddress ||
      clerkUser?.emailAddresses[0]?.emailAddress ||
      "";

    const { db } = await connectToDatabase();
    const settings = await db
      .collection("notification_settings")
      .findOne({ userId });

    return NextResponse.json({
      clerkEmail,
      settings: settings
        ? {
            projectUpdates: settings.projectUpdates ?? DEFAULT_SETTINGS.projectUpdates,
            githubActivity: settings.githubActivity ?? DEFAULT_SETTINGS.githubActivity,
            marketingAlerts: settings.marketingAlerts ?? DEFAULT_SETTINGS.marketingAlerts,
            aiInsights: settings.aiInsights ?? DEFAULT_SETTINGS.aiInsights,
            weeklySummary: settings.weeklySummary ?? DEFAULT_SETTINGS.weeklySummary,
            dailySummary: settings.dailySummary ?? DEFAULT_SETTINGS.dailySummary,
            additionalEmail: settings.additionalEmail ?? DEFAULT_SETTINGS.additionalEmail,
            top3Enabled: settings.top3Enabled ?? DEFAULT_SETTINGS.top3Enabled,
            top3Email: settings.top3Email ?? DEFAULT_SETTINGS.top3Email,
            top3InApp: settings.top3InApp ?? DEFAULT_SETTINGS.top3InApp,
            top3DeliveryTime: settings.top3DeliveryTime ?? DEFAULT_SETTINGS.top3DeliveryTime,
          }
        : DEFAULT_SETTINGS,
    });
  } catch (error) {
    console.error("GET /api/user/notification-settings error:", error);
    return NextResponse.json(
      { error: "Failed to fetch notification settings" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      projectUpdates,
      githubActivity,
      marketingAlerts,
      aiInsights,
      weeklySummary,
      dailySummary,
      additionalEmail,
      top3Enabled,
      top3Email,
      top3InApp,
      top3DeliveryTime,
    } = body;

    // Validate additionalEmail format if provided
    if (additionalEmail && additionalEmail.trim() !== "") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(additionalEmail.trim())) {
        return NextResponse.json(
          { error: "Invalid additional email address" },
          { status: 400 }
        );
      }
    }

    const { db } = await connectToDatabase();
    await db.collection("notification_settings").updateOne(
      { userId },
      {
        $set: {
          userId,
          projectUpdates: projectUpdates ?? DEFAULT_SETTINGS.projectUpdates,
          githubActivity: githubActivity ?? DEFAULT_SETTINGS.githubActivity,
          marketingAlerts: marketingAlerts ?? DEFAULT_SETTINGS.marketingAlerts,
          aiInsights: aiInsights ?? DEFAULT_SETTINGS.aiInsights,
          weeklySummary: weeklySummary ?? DEFAULT_SETTINGS.weeklySummary,
          dailySummary: dailySummary ?? DEFAULT_SETTINGS.dailySummary,
          additionalEmail: additionalEmail?.trim() || "",
          top3Enabled: top3Enabled ?? DEFAULT_SETTINGS.top3Enabled,
          top3Email: top3Email ?? DEFAULT_SETTINGS.top3Email,
          top3InApp: top3InApp ?? DEFAULT_SETTINGS.top3InApp,
          top3DeliveryTime: top3DeliveryTime ?? DEFAULT_SETTINGS.top3DeliveryTime,
          updatedAt: new Date().toISOString(),
        },
        $setOnInsert: {
          createdAt: new Date().toISOString(),
        },
      },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT /api/user/notification-settings error:", error);
    return NextResponse.json(
      { error: "Failed to update notification settings" },
      { status: 500 }
    );
  }
}
