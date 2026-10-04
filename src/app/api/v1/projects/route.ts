import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { authenticateApiKey } from "@/lib/api-auth";

// GET /api/v1/projects — list all projects for the API key owner
export async function GET(request: NextRequest) {
  const authResult = await authenticateApiKey(request);
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  try {
    const { db } = await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // active, paused, completed
    const phase = searchParams.get("phase"); // idea, prototype, etc.
    const priority = searchParams.get("priority"); // low, medium, high, critical
    const search = searchParams.get("search"); // search by name or description
    const sortBy = searchParams.get("sortBy") || "updatedAt"; // updatedAt, createdAt, name, revenue, stars, commits
    const sortOrder = searchParams.get("sortOrder") === "asc" ? 1 : -1;
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");

    const filter: Record<string, unknown> = { userId };
    if (status) filter.status = status;
    if (phase) filter.currentPhase = phase;
    if (priority) filter.priority = priority;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { githubRepo: { $regex: search, $options: "i" } },
      ];
    }

    const validSortFields = ["updatedAt", "createdAt", "name", "revenue", "stars", "commits", "monthlyVisitors"];
    const sortField = validSortFields.includes(sortBy) ? sortBy : "updatedAt";

    const [projects, total] = await Promise.all([
      db
        .collection("projects")
        .find(filter)
        .sort({ [sortField]: sortOrder })
        .skip(offset)
        .limit(limit)
        .toArray(),
      db.collection("projects").countDocuments(filter),
    ]);

    const formatted = projects.map((p) => ({
      id: p._id.toString(),
      name: p.name,
      description: p.description,
      currentPhase: p.currentPhase,
      phaseProgress: p.phaseProgress,
      githubRepo: p.githubRepo,
      githubUrl: p.githubUrl,
      techStack: p.techStack,
      domain: p.domain,
      deploymentUrl: p.deploymentUrl,
      status: p.status,
      priority: p.priority,
      revenue: p.revenue,
      monthlyVisitors: p.monthlyVisitors,
      openIssues: p.openIssues,
      stars: p.stars,
      commits: p.commits,
      deadline: p.deadline,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    return NextResponse.json({
      data: formatted,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error("GET /api/v1/projects error:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
      { status: 500 }
    );
  }
}
