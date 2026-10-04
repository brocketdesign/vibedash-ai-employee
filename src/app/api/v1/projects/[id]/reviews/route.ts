import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { authenticateApiKey } from "@/lib/api-auth";
import { ObjectId } from "mongodb";

// GET /api/v1/projects/[id]/reviews — get AI reviews for a project
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
        { projection: { aiReviews: 1, name: 1 } }
      );

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const reviews = (project.aiReviews || []).map(
      (r: Record<string, unknown>) => ({
        id: r.id,
        type: r.type,
        summary: r.summary,
        completenessScore: r.completenessScore,
        bugsFound: r.bugsFound,
        suggestions: r.suggestions,
        recommendedStage: r.recommendedStage,
        recommendedProgress: r.recommendedProgress,
        stageProgressMap: r.stageProgressMap,
        shouldUpdate: r.shouldUpdate,
        createdAt: r.createdAt,
        commitsAnalyzed: r.commitsAnalyzed,
      })
    );

    return NextResponse.json({
      data: {
        projectId: id,
        projectName: project.name,
        reviews,
        totalReviews: reviews.length,
      },
    });
  } catch (error) {
    console.error("GET /api/v1/projects/[id]/reviews error:", error);
    return NextResponse.json(
      { error: "Failed to fetch reviews" },
      { status: 500 }
    );
  }
}
