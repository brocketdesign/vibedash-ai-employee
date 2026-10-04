import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { authenticateApiKey } from "@/lib/api-auth";
import { ObjectId } from "mongodb";
import { analyzeCode, createAIReview, getAIConfigStatus } from "@/lib/ai-service-server";
import { fetchKeyFiles, parseGitHubUrl, resolveGitHubToken } from "@/lib/github-service";
import { Project, TimelineEvent } from "@/types";

// POST /api/v1/projects/[id]/trigger-review — trigger an AI code review via API
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await authenticateApiKey(request);
  if (authResult instanceof NextResponse) return authResult;
  const { userId } = authResult;

  try {
    // Check AI configuration
    const aiStatus = getAIConfigStatus();
    if (!aiStatus.provider) {
      return NextResponse.json(
        {
          error: "AI service not configured",
          details: "Set GROK_API_KEY or OPENAI_API_KEY environment variable",
        },
        { status: 503 }
      );
    }

    const { id } = await params;
    const { db } = await connectToDatabase();

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    }

    const projectDoc = await db
      .collection("projects")
      .findOne({ _id: new ObjectId(id), userId });

    if (!projectDoc) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const project = projectDoc as unknown as Project;

    if (!project.githubUrl) {
      return NextResponse.json(
        { error: "No GitHub repository linked to this project" },
        { status: 400 }
      );
    }

    const parsed = parseGitHubUrl(project.githubUrl);
    if (!parsed) {
      return NextResponse.json(
        { error: "Invalid GitHub URL on project" },
        { status: 400 }
      );
    }

    // Fetch code (per-project token, else the user's GitHub OAuth token)
    const { owner, repo } = parsed;
    const accessToken = await resolveGitHubToken(userId, project.githubAccessToken);
    const code = await fetchKeyFiles(owner, repo, accessToken);

    if (!code || code.length < 100) {
      return NextResponse.json(
        {
          error:
            "Could not fetch sufficient code from repository. If it is private, connect GitHub from the dashboard.",
          code: "repo_inaccessible",
        },
        { status: 400 }
      );
    }

    // Analyze
    const analysis = await analyzeCode(code, project);

    // Create review record
    const review = createAIReview(id, "code-review", analysis, undefined);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.collection("projects").updateOne(
      { _id: new ObjectId(id), userId },
      {
        $push: { aiReviews: review } as any,
        $set: { updatedAt: new Date().toISOString() },
      }
    );

    // Timeline event
    const timelineEvent: TimelineEvent = {
      id: `evt-${Date.now()}`,
      projectId: id,
      type: "ai-review",
      title: "AI Code Review Completed (via API)",
      description: `AI analysis: ${analysis.summary.substring(0, 120)}...`,
      date: new Date().toISOString(),
      metadata: {
        reviewId: review.id,
        completenessScore: analysis.completenessScore,
        bugsFound: analysis.bugsFound.length,
        source: "api",
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.collection("projects").updateOne(
      { _id: new ObjectId(id), userId },
      { $push: { timeline: timelineEvent } as any }
    );

    // Optionally auto-apply stage recommendation
    const body = await request.json().catch(() => ({}));
    if (body.autoApply && analysis.shouldUpdate && analysis.recommendedStage) {
      const oldPhase = project.currentPhase;
      const newPhase = analysis.recommendedStage;
      if (oldPhase !== newPhase) {
        const stageEvent: TimelineEvent = {
          id: `evt-${Date.now() + 1}`,
          projectId: id,
          type: "stage-change",
          title: `Auto-moved to ${newPhase} (AI review via API)`,
          description: `AI recommended moving from "${oldPhase}" to "${newPhase}"`,
          date: new Date().toISOString(),
          metadata: {
            fromStage: oldPhase,
            toStage: newPhase,
            source: "ai-review-api",
            reviewId: review.id,
          },
        };

        const phaseProgress = analysis.stageProgressMap || project.phaseProgress;

        await db.collection("projects").updateOne(
          { _id: new ObjectId(id), userId },
          {
            $set: {
              currentPhase: newPhase,
              phaseProgress,
              updatedAt: new Date().toISOString(),
            },
            $push: { timeline: stageEvent } as any,
          }
        );
      }
    }

    return NextResponse.json({
      data: {
        review: {
          id: review.id,
          type: review.type,
          summary: review.summary,
          completenessScore: review.completenessScore,
          bugsFound: review.bugsFound,
          suggestions: review.suggestions,
          recommendedStage: review.recommendedStage,
          recommendedProgress: review.recommendedProgress,
          stageProgressMap: review.stageProgressMap,
          shouldUpdate: review.shouldUpdate,
          createdAt: review.createdAt,
        },
        projectId: id,
        projectName: project.name,
        aiProvider: aiStatus.provider,
      },
      message: "AI code review completed successfully",
    });
  } catch (error) {
    console.error("POST /api/v1/projects/[id]/trigger-review error:", error);
    return NextResponse.json(
      { error: "Failed to trigger AI review" },
      { status: 500 }
    );
  }
}
