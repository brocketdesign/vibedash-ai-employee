import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ProjectPhase } from "@/types";
import { auth } from "@clerk/nextjs/server";
import { generateDefaultPhaseSubTasks, generateDefaultPhaseProgress } from "@/lib/constants";

const DEFAULT_PHASE_PROGRESS = generateDefaultPhaseProgress();
const DEFAULT_PHASE_SUBTASKS = generateDefaultPhaseSubTasks();

// GET /api/projects — list all projects for the current user
export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { db } = await connectToDatabase();
    const projects = await db
      .collection("projects")
      .find({ userId })
      .sort({ updatedAt: -1 })
      .toArray();

    const formatted = projects.map((p) => ({
      ...p,
      id: p._id.toString(),
      _id: undefined,
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("GET /api/projects error:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}

// POST /api/projects — create a new project
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { db } = await connectToDatabase();

    const now = new Date().toISOString();

    const project = {
      userId,
      name: body.name,
      description: body.description || "",
      currentPhase: (body.currentPhase || "idea") as ProjectPhase,
      phaseProgress: body.phaseProgress || { ...DEFAULT_PHASE_PROGRESS },
      phaseSubTasks: body.phaseSubTasks || { ...DEFAULT_PHASE_SUBTASKS },
      githubRepo: body.githubRepo || "",
      githubUrl: body.githubUrl || "",
      githubAccessToken: body.githubAccessToken || null,
      techStack: body.techStack || [],
      domain: body.domain || "",
      deploymentUrl: body.deploymentUrl || "",
      lastCommit: body.lastCommit || null,
      recentCommits: body.recentCommits || [],
      lastSyncedAt: body.lastSyncedAt || null,
      openIssues: body.openIssues || 0,
      stars: body.stars || 0,
      commits: body.commits || 0,
      revenue: body.revenue || 0,
      monthlyVisitors: body.monthlyVisitors || 0,
      adSpend: body.adSpend || 0,
      status: body.status || "active",
      priority: body.priority || "medium",
      color: body.color || "#8B5CF6",
      deadline: body.deadline || null,
      tasks: body.tasks || [],
      campaigns: body.campaigns || [],
      timeline: body.timeline || [],
      aiReviews: body.aiReviews || [],
      autoUpdateEnabled: body.autoUpdateEnabled ?? true,
    };

    // If this project is linked to a GitHub repo, upsert by userId + githubRepo
    // to prevent duplicates from repeated onboarding or re-imports.
    if (project.githubRepo) {
      const result = await db.collection("projects").findOneAndUpdate(
        { userId, githubRepo: project.githubRepo },
        {
          $set: {
            ...project,
            updatedAt: now,
          },
          $setOnInsert: {
            createdAt: now,
          },
        },
        { upsert: true, returnDocument: "after" }
      );

      return NextResponse.json(
        { ...result, id: result!._id.toString(), _id: undefined },
        { status: 200 }
      );
    }

    // For projects without a GitHub repo, just insert normally
    const result = await db.collection("projects").insertOne({
      ...project,
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json(
      { ...project, id: result.insertedId.toString() },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/projects error:", error);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}
