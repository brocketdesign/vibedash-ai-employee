import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import { fetchAnalyticsData } from "@/lib/google-analytics";
import { ObjectId } from "mongodb";

// POST /api/google-analytics/link
// Body: { projectId, propertyId, propertyName }
// Links a GA4 property to a project and fetches initial data
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId, propertyId, propertyName } = await request.json();
    if (!projectId || !propertyId) {
      return NextResponse.json(
        { error: "projectId and propertyId are required" },
        { status: 400 }
      );
    }

    // Fetch initial analytics data
    const data = await fetchAnalyticsData(projectId, userId, propertyId);

    // Update the project with the linked GA property and initial data
    const { db } = await connectToDatabase();
    const filter = ObjectId.isValid(projectId)
      ? { _id: new ObjectId(projectId), userId }
      : { userId };

    await db.collection("projects").updateOne(filter, {
      $set: {
        googleAnalytics: {
          propertyId,
          propertyName: propertyName || "GA4 Property",
          connectedAt: new Date().toISOString(),
          lastFetchedAt: data.fetchedAt,
          monthlyVisitorsGA: data.monthlyVisitors,
          totalVisitorsGA: data.totalVisitors,
        },
        // Also update the top-level monthlyVisitors for backwards compatibility
        monthlyVisitors: data.monthlyVisitors,
        updatedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      googleAnalytics: {
        propertyId,
        propertyName: propertyName || "GA4 Property",
        connectedAt: new Date().toISOString(),
        lastFetchedAt: data.fetchedAt,
        monthlyVisitorsGA: data.monthlyVisitors,
        totalVisitorsGA: data.totalVisitors,
      },
      analyticsData: data,
    });
  } catch (error) {
    console.error("Link GA property error:", error);
    return NextResponse.json(
      { error: "Failed to link Google Analytics property" },
      { status: 500 }
    );
  }
}
