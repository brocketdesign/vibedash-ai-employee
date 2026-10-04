import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { analyzeCommits, createAIReview, getAIConfigStatus } from "@/lib/ai-service-server";
import { syncWithGitHub, parseGitHubUrl } from "@/lib/github-service";
import { Project, ProjectPhase, TimelineEvent } from "@/types";

// POST /api/projects/[id]/sync-commits — Sync with GitHub and analyze commits
export async function POST(
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

    // Check AI API configuration
    const aiStatus = getAIConfigStatus();
    if (!aiStatus.provider) {
      return NextResponse.json(
        { 
          error: "AI service not configured", 
          details: "Please set GROK_API_KEY or OPENAI_API_KEY environment variable" 
        },
        { status: 503 }
      );
    }
    console.log(`🤖 Using AI provider: ${aiStatus.provider} (Grok: ${aiStatus.grokConfigured}, OpenAI: ${aiStatus.openaiConfigured})`);

    const { id } = await params;
    const body = await request.json();
    const { autoApply = false } = body;
    
    const { db } = await connectToDatabase();

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    }

    // Get project
    const projectDoc = await db
      .collection("projects")
      .findOne({ _id: new ObjectId(id), userId });

    if (!projectDoc) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const project = projectDoc as unknown as Project;

    // Check if GitHub URL exists
    if (!project.githubUrl) {
      return NextResponse.json(
        { error: "No GitHub repository linked to this project" },
        { status: 400 }
      );
    }

    // Sync with GitHub
    const syncResult = await syncWithGitHub(project.githubUrl, project.githubAccessToken);

    if (!syncResult) {
      return NextResponse.json(
        { error: "Failed to sync with GitHub" },
        { status: 500 }
      );
    }

    const { commits, repo } = syncResult;

    if (commits.length === 0) {
      return NextResponse.json({
        message: "No new commits found",
        commits: [],
        analysis: null,
      });
    }

    // Filter out already synced commits
    const lastSyncedSha = project.lastCommit?.sha;
    const newCommits = lastSyncedSha
      ? commits.filter((c) => c.sha !== lastSyncedSha)
      : commits;

    if (newCommits.length === 0) {
      return NextResponse.json({
        message: "No new commits since last sync",
        commits: [],
        analysis: null,
      });
    }

    // Analyze commits with AI
    const analysis = await analyzeCommits(newCommits, project);

    // Create AI review from commit analysis
    const review = createAIReview(
      id,
      "commit-analysis",
      analysis,
      newCommits.map((c) => c.sha)
    );

    // Build update data
    const updateData: Record<string, unknown> = {
      lastSyncedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      recentCommits: newCommits,
      commits: (project.commits || 0) + newCommits.length,
    };

    // Update last commit
    if (newCommits.length > 0) {
      const latest = newCommits[0];
      updateData.lastCommit = {
        sha: latest.sha,
        message: latest.message,
        author: latest.author,
        date: latest.date,
      };
    }

    // Update repo stats if available
    if (repo) {
      updateData.stars = repo.stargazers_count;
      updateData.openIssues = repo.open_issues_count;
    }

    // Auto-apply AI suggestions if enabled
    let stageChanged = false;
    if (autoApply && project.autoUpdateEnabled && analysis.shouldUpdate) {
      const currentOrder = getStageOrder(project.currentPhase);
      const recommendedOrder = getStageOrder(analysis.recommendedStage);

      if (recommendedOrder > currentOrder || 
          (recommendedOrder === currentOrder && analysis.recommendedProgress > project.phaseProgress[project.currentPhase])) {
        
        updateData.currentPhase = analysis.recommendedStage;
        updateData[`phaseProgress.${analysis.recommendedStage}`] = analysis.recommendedProgress;
        stageChanged = true;

        // Add stage change timeline event
        const stageChangeEvent: TimelineEvent = {
          id: `evt-${Date.now()}-stage`,
          projectId: id,
          type: "stage-change",
          title: `Advanced to ${analysis.recommendedStage}`,
          description: `AI recommended stage update based on commit analysis. Progress: ${analysis.recommendedProgress}%`,
          date: new Date().toISOString(),
          metadata: {
            fromStage: project.currentPhase,
            toStage: analysis.recommendedStage,
            autoApplied: true,
          },
        };

        const stageChangeUpdate: Record<string, unknown> = { $push: { timeline: stageChangeEvent } };
        await db.collection("projects").updateOne(
          { _id: new ObjectId(id), userId },
          stageChangeUpdate
        );
      }
    }

    // Add commit sync timeline event
    const commitSyncEvent: TimelineEvent = {
      id: `evt-${Date.now()}`,
      projectId: id,
      type: "commit-sync",
      title: `Synced ${newCommits.length} New Commit${newCommits.length > 1 ? 's' : ''}`,
      description: `Analyzed commits for progress toward ${project.currentPhase} stage`,
      date: new Date().toISOString(),
      metadata: {
        commitCount: newCommits.length,
        featuresAdded: analysis.featuresAdded?.length || 0,
        bugsFixed: analysis.bugsFixed?.length || 0,
      },
    };

    // Update project with all changes
    const finalUpdate: Record<string, unknown> = {
      $set: updateData,
      $push: { 
        aiReviews: review,
        timeline: commitSyncEvent,
      },
    };
    await db.collection("projects").updateOne(
      { _id: new ObjectId(id), userId },
      finalUpdate
    );

    // Get updated project
    const updatedProject = await db
      .collection("projects")
      .findOne({ _id: new ObjectId(id), userId });

    return NextResponse.json({
      commits: newCommits,
      analysis,
      review,
      stageChanged,
      autoApplied: autoApply && project.autoUpdateEnabled && stageChanged,
      project: {
        ...updatedProject,
        id: updatedProject?._id.toString(),
        _id: undefined,
      },
    });
  } catch (error) {
    console.error("POST /api/projects/[id]/sync-commits error:", error);
    return NextResponse.json(
      { error: "Failed to sync commits" },
      { status: 500 }
    );
  }
}

// GET /api/projects/[id]/sync-commits — Get recent commits
export async function GET(
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
      recentCommits: project.recentCommits || [],
      lastSyncedAt: project.lastSyncedAt,
      lastCommit: project.lastCommit,
    });
  } catch (error) {
    console.error("GET /api/projects/[id]/sync-commits error:", error);
    return NextResponse.json(
      { error: "Failed to fetch commits" },
      { status: 500 }
    );
  }
}

// Helper function to get stage order
function getStageOrder(stage: ProjectPhase): number {
  const order: Record<ProjectPhase, number> = {
    idea: 0,
    prototype: 1,
    "free-tier": 2,
    premium: 3,
    deploy: 4,
    live: 5,
  };
  return order[stage] ?? 0;
}
