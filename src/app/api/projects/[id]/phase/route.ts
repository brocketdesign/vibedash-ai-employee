import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { ProjectPhase, TimelineEvent } from "@/types";
import { auth } from "@clerk/nextjs/server";

// PUT /api/projects/[id]/phase — move project to a different phase
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { db } = await connectToDatabase();

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    }

    const { phase, phaseProgress, phaseProgressMap, source, sourceId, reviewId } = body as {
      phase: ProjectPhase;
      phaseProgress?: number;
      phaseProgressMap?: Record<ProjectPhase, number>;
      source?: "ai-review" | "manual";
      sourceId?: string; // AI review ID if applicable
      reviewId?: string; // AI review to mark as applied
    };

    // Get current project to check if phase is changing
    const currentProject = await db
      .collection("projects")
      .findOne({ _id: new ObjectId(id), userId });
    
    if (!currentProject) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const fromPhase = currentProject.currentPhase;
    const isPhaseChange = fromPhase !== phase;

    const updateData: Record<string, unknown> = {
      currentPhase: phase,
      updatedAt: new Date().toISOString(),
    };

    // If we have a full phaseProgressMap from AI review, use it
    if (phaseProgressMap) {
      updateData["phaseProgress"] = {
        ...currentProject.phaseProgress,
        ...phaseProgressMap,
      };
    } else if (phaseProgress !== undefined) {
      // Otherwise just update the single phase
      updateData[`phaseProgress.${phase}`] = phaseProgress;
    }

    // Update project
    await db.collection("projects").updateOne(
      { _id: new ObjectId(id), userId },
      { $set: updateData }
    );

    // Add timeline event if phase changed or AI review applied
    if (isPhaseChange || source === "ai-review") {
      const timelineEvent: TimelineEvent = {
        id: `evt-${Date.now()}`,
        projectId: id,
        type: "stage-change",
        title: isPhaseChange 
          ? `Advanced to ${phase}` 
          : `Progress updated in ${phase}`,
        description: source === "ai-review" 
          ? `AI review ${isPhaseChange ? 'recommended stage change' : 'suggested progress update'}: ${phaseProgress || 0}% complete`
          : `Manual update: ${phaseProgress || 0}% complete`,
        date: new Date().toISOString(),
        metadata: { 
          fromStage: fromPhase, 
          toStage: phase,
          phaseProgress,
          source: source || "manual",
          sourceId: sourceId || undefined,
        },
      };

      const timelineUpdate: Record<string, unknown> = { $push: { timeline: timelineEvent } };
      await db.collection("projects").updateOne(
        { _id: new ObjectId(id), userId },
        timelineUpdate
      );
    }

    // Mark the applied AI review as no longer needing update
    if (reviewId && source === "ai-review") {
      await db.collection("projects").updateOne(
        { _id: new ObjectId(id), userId, "aiReviews.id": reviewId },
        {
          $set: {
            "aiReviews.$.shouldUpdate": false,
            "aiReviews.$.appliedAt": new Date().toISOString(),
          },
        }
      );
    }

    // Get updated project
    const result = await db
      .collection("projects")
      .findOne({ _id: new ObjectId(id), userId });

    return NextResponse.json({
      ...result,
      id: result!._id.toString(),
      _id: undefined,
    });
  } catch (error) {
    console.error("PUT /api/projects/[id]/phase error:", error);
    return NextResponse.json(
      { error: "Failed to update phase" },
      { status: 500 }
    );
  }
}
