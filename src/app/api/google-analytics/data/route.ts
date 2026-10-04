import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import { fetchAnalyticsData } from "@/lib/google-analytics";
import { ObjectId } from "mongodb";

// GET /api/google-analytics/data?projectId=xxx
// Fetch fresh analytics data for a connected project
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = request.nextUrl.searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    // Get the project to find the linked GA property
    const { db } = await connectToDatabase();
    let project;
    if (ObjectId.isValid(projectId)) {
      project = await db
        .collection("projects")
        .findOne({ _id: new ObjectId(projectId), userId });
    }

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (!project.googleAnalytics?.propertyId) {
      return NextResponse.json(
        { error: "Google Analytics not connected for this project" },
        { status: 400 }
      );
    }

    const data = await fetchAnalyticsData(
      projectId,
      userId,
      project.googleAnalytics.propertyId
    );

    // Update cached values in the project
    await db.collection("projects").updateOne(
      { _id: new ObjectId(projectId), userId },
      {
        $set: {
          "googleAnalytics.lastFetchedAt": data.fetchedAt,
          "googleAnalytics.monthlyVisitorsGA": data.monthlyVisitors,
          "googleAnalytics.totalVisitorsGA": data.totalVisitors,
          monthlyVisitors: data.monthlyVisitors,
          updatedAt: new Date().toISOString(),
        },
      }
    );

    return NextResponse.json(data);
  } catch (error) {
    console.error("Fetch GA data error:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics data" },
      { status: 500 }
    );
  }
}
