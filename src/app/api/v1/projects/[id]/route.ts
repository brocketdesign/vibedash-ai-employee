import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { authenticateApiKey } from "@/lib/api-auth";
import { ObjectId } from "mongodb";
import { ProjectPhase } from "@/types";

const VALID_PHASES: ProjectPhase[] = [
  "idea",
  "prototype",
  "free-tier",
  "premium",
  "deploy",
  "live",
];

// GET /api/v1/projects/[id] — get a single project
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
      .findOne({ _id: new ObjectId(id), userId });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        id: project._id.toString(),
        name: project.name,
        description: project.description,
        currentPhase: project.currentPhase,
        phaseProgress: project.phaseProgress,
        phaseSubTasks: project.phaseSubTasks,
        githubRepo: project.githubRepo,
        githubUrl: project.githubUrl,
        techStack: project.techStack,
        domain: project.domain,
        deploymentUrl: project.deploymentUrl,
        lastCommit: project.lastCommit,
        status: project.status,
        priority: project.priority,
        color: project.color,
        revenue: project.revenue,
        monthlyVisitors: project.monthlyVisitors,
        adSpend: project.adSpend,
        openIssues: project.openIssues,
        stars: project.stars,
        commits: project.commits,
        deadline: project.deadline,
        tasks: project.tasks,
        campaigns: project.campaigns,
        autoUpdateEnabled: project.autoUpdateEnabled,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
    });
  } catch (error) {
    console.error("GET /api/v1/projects/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch project" },
      { status: 500 }
    );
  }
}

// PATCH /api/v1/projects/[id] — update a project
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateApiKey(request);
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  try {
    const { id } = await params;
    const body = await request.json();
    const { db } = await connectToDatabase();

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    }

    // Allowlisted fields that can be updated via API
    const allowedFields: Record<string, (v: unknown) => boolean> = {
      name: (v) => typeof v === "string" && v.length > 0,
      description: (v) => typeof v === "string",
      currentPhase: (v) => VALID_PHASES.includes(v as ProjectPhase),
      status: (v) => ["active", "paused", "completed"].includes(v as string),
      priority: (v) =>
        ["low", "medium", "high", "critical"].includes(v as string),
      domain: (v) => typeof v === "string",
      deploymentUrl: (v) => typeof v === "string",
      deadline: (v) => typeof v === "string" || v === null,
      autoUpdateEnabled: (v) => typeof v === "boolean",
    };

    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

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

    // If the phase is being changed, also add a timeline event
    if (updateData.currentPhase) {
      const currentProject = await db
        .collection("projects")
        .findOne({ _id: new ObjectId(id), userId });

      if (!currentProject) {
        return NextResponse.json(
          { error: "Project not found" },
          { status: 404 }
        );
      }

      if (currentProject.currentPhase !== updateData.currentPhase) {
        const timelineEvent = {
          id: `evt-${Date.now()}`,
          projectId: id,
          type: "stage-change",
          title: `Moved to ${updateData.currentPhase} (via API)`,
          description: `Pipeline changed from "${currentProject.currentPhase}" to "${updateData.currentPhase}" via external API`,
          date: new Date().toISOString(),
          metadata: {
            fromStage: currentProject.currentPhase,
            toStage: updateData.currentPhase,
            source: "api",
          },
        };

        await db.collection("projects").updateOne(
          { _id: new ObjectId(id), userId },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          { $push: { timeline: timelineEvent } } as any
        );
      }
    }

    const result = await db.collection("projects").findOneAndUpdate(
      { _id: new ObjectId(id), userId },
      { $set: updateData },
      { returnDocument: "after" }
    );

    if (!result) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        id: result._id.toString(),
        name: result.name,
        description: result.description,
        currentPhase: result.currentPhase,
        phaseProgress: result.phaseProgress,
        status: result.status,
        priority: result.priority,
        updatedAt: result.updatedAt,
      },
      message: "Project updated successfully",
    });
  } catch (error) {
    console.error("PATCH /api/v1/projects/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 }
    );
  }
}
