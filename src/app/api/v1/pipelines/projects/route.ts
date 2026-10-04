import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { authenticateApiKey } from "@/lib/api-auth";
import { PHASES } from "@/lib/constants";

// GET /api/v1/pipelines/projects — list all pipeline phases with their projects
export async function GET(request: NextRequest) {
  const authResult = await authenticateApiKey(request);
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  try {
    const { db } = await connectToDatabase();
    const { searchParams } = new URL(request.url);

    // Optional filters on the projects
    const status = searchParams.get("status"); // active, paused, completed
    const priority = searchParams.get("priority"); // low, medium, high, critical
    const phase = searchParams.get("phase"); // filter to a specific phase only
    const search = searchParams.get("search"); // search by name

    const projectFilter: Record<string, unknown> = { userId };
    if (status) projectFilter.status = status;
    if (priority) projectFilter.priority = priority;

    const projects = await db
      .collection("projects")
      .find(projectFilter)
      .sort({ updatedAt: -1 })
      .toArray();

    let filteredProjects = projects;
    if (search) {
      const q = search.toLowerCase();
      filteredProjects = projects.filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q)
      );
    }

    // Group projects by phase
    const pipelineMap: Record<string, Record<string, unknown>[]> = {};
    for (const p of PHASES) {
      pipelineMap[p.id] = [];
    }

    for (const p of filteredProjects) {
      const projectPhase = p.currentPhase || "idea";
      if (!pipelineMap[projectPhase]) {
        pipelineMap[projectPhase] = [];
      }
      pipelineMap[projectPhase].push({
        id: p._id.toString(),
        name: p.name,
        description: p.description,
        status: p.status,
        priority: p.priority,
        phaseProgress: p.phaseProgress,
        githubRepo: p.githubRepo,
        revenue: p.revenue,
        updatedAt: p.updatedAt,
      });
    }

    // Build response
    let pipelineData = PHASES.map((p) => ({
      phase: {
        id: p.id,
        label: p.label,
        icon: p.icon,
        color: p.color,
        description: p.description,
        order: p.order,
      },
      projects: pipelineMap[p.id] || [],
      projectCount: (pipelineMap[p.id] || []).length,
    }));

    // If a specific phase was requested, filter to just that one
    if (phase) {
      pipelineData = pipelineData.filter((p) => p.phase.id === phase);
      if (pipelineData.length === 0) {
        return NextResponse.json(
          { error: `Unknown phase: ${phase}. Valid phases: ${PHASES.map((p) => p.id).join(", ")}` },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({
      data: pipelineData,
      summary: {
        totalProjects: filteredProjects.length,
        phaseCounts: Object.fromEntries(
          PHASES.map((p) => [p.id, (pipelineMap[p.id] || []).length])
        ),
      },
    });
  } catch (error) {
    console.error("GET /api/v1/pipelines/projects error:", error);
    return NextResponse.json(
      { error: "Failed to fetch pipeline projects" },
      { status: 500 }
    );
  }
}
