import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { authenticateApiKey } from "@/lib/api-auth";

// GET /api/v1/stats — get dashboard statistics
export async function GET(request: NextRequest) {
  const authResult = await authenticateApiKey(request);
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  try {
    const { db } = await connectToDatabase();

    const projects = await db
      .collection("projects")
      .find({ userId })
      .toArray();

    const totalProjects = projects.length;
    const activeProjects = projects.filter((p) => p.status === "active").length;
    const completedProjects = projects.filter(
      (p) => p.status === "completed"
    ).length;
    const pausedProjects = projects.filter(
      (p) => p.status === "paused"
    ).length;

    const totalRevenue = projects.reduce(
      (sum, p) => sum + (p.revenue || 0),
      0
    );
    const totalCommits = projects.reduce(
      (sum, p) => sum + (p.commits || 0),
      0
    );
    const totalStars = projects.reduce((sum, p) => sum + (p.stars || 0), 0);
    const totalVisitors = projects.reduce(
      (sum, p) => sum + (p.monthlyVisitors || 0),
      0
    );

    const projectsByPhase: Record<string, number> = {};
    for (const p of projects) {
      const phase = p.currentPhase || "idea";
      projectsByPhase[phase] = (projectsByPhase[phase] || 0) + 1;
    }

    const projectsByPriority: Record<string, number> = {};
    for (const p of projects) {
      const priority = p.priority || "medium";
      projectsByPriority[priority] =
        (projectsByPriority[priority] || 0) + 1;
    }

    return NextResponse.json({
      data: {
        totalProjects,
        activeProjects,
        completedProjects,
        pausedProjects,
        totalRevenue,
        totalCommits,
        totalStars,
        totalVisitors,
        projectsByPhase,
        projectsByPriority,
      },
    });
  } catch (error) {
    console.error("GET /api/v1/stats error:", error);
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 }
    );
  }
}
