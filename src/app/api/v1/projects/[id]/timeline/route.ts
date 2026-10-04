import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { authenticateApiKey } from "@/lib/api-auth";
import { ObjectId } from "mongodb";

// GET /api/v1/projects/[id]/timeline — get timeline events for a project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateApiKey(request);
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  try {
    const { id } = await params;
    const { db } = await connectToDatabase();

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    }

    const project = await db
      .collection("projects")
      .findOne(
        { _id: new ObjectId(id), userId },
        { projection: { timeline: 1, name: 1 } }
      );

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // filter by event type
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);

    let events = project.timeline || [];

    if (type) {
      events = events.filter(
        (e: Record<string, unknown>) => e.type === type
      );
    }

    // Sort by date descending and limit
    events = events
      .sort(
        (a: Record<string, unknown>, b: Record<string, unknown>) =>
          new Date(b.date as string).getTime() -
          new Date(a.date as string).getTime()
      )
      .slice(0, limit);

    return NextResponse.json({
      data: {
        projectId: id,
        projectName: project.name,
        events,
        totalEvents: events.length,
      },
    });
  } catch (error) {
    console.error("GET /api/v1/projects/[id]/timeline error:", error);
    return NextResponse.json(
      { error: "Failed to fetch timeline" },
      { status: 500 }
    );
  }
}
