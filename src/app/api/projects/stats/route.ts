import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { auth } from "@clerk/nextjs/server";

// GET /api/projects/stats
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
    const projects = await db.collection("projects").find({ userId }).toArray();

    const totalProjects = projects.length;
    const activeProjects = projects.filter((p) => p.status === "active").length;
    const totalRevenue = projects.reduce((a, p) => a + (p.revenue || 0), 0);
    const totalAdSpend = projects.reduce((a, p) => a + (p.adSpend || 0), 0);
    const totalVisitors = projects.reduce(
      (a, p) => a + (p.monthlyVisitors || 0),
      0
    );
    const totalCommits = projects.reduce((a, p) => a + (p.commits || 0), 0);

    const phases = [
      "idea",
      "prototype",
      "free-tier",
      "premium",
      "deploy",
      "live",
    ];

    const projectsByPhase: Record<string, number> = {};
    for (const phase of phases) {
      projectsByPhase[phase] = projects.filter(
        (p) => p.currentPhase === phase
      ).length;
    }

    return NextResponse.json({
      totalProjects,
      activeProjects,
      totalRevenue,
      totalAdSpend,
      totalVisitors,
      totalCommits,
      projectsByPhase,
    });
  } catch (error) {
    console.error("GET /api/projects/stats error:", error);
    return NextResponse.json(
      { error: "Failed to compute stats" },
      { status: 500 }
    );
  }
}
