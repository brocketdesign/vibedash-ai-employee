import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { analyzeCode, createAIReview, getAIConfigStatus } from "@/lib/ai-service-server";
import {
  fetchKeyFiles,
  fetchReadme,
  parseGitHubUrl,
  getRepoAccessStatus,
  resolveGitHubToken,
} from "@/lib/github-service";
import { AIReview, Project, TimelineEvent, Task } from "@/types";

// POST /api/projects/[id]/ai-review — Perform AI code review
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

    // Cast to Project type
    const project = projectDoc as unknown as Project;

    // Check if GitHub URL exists
    if (!project.githubUrl) {
      return NextResponse.json(
        { error: "No GitHub repository linked to this project" },
        { status: 400 }
      );
    }

    // Parse GitHub URL
    const parsed = parseGitHubUrl(project.githubUrl);
    if (!parsed) {
      return NextResponse.json(
        { error: "Invalid GitHub URL" },
        { status: 400 }
      );
    }

    // Resolve the token: a per-project token wins, otherwise fall back to the
    // user's GitHub OAuth token (set via "Connect GitHub").
    const { owner, repo } = parsed;
    const accessToken = await resolveGitHubToken(userId, project.githubAccessToken);

    // Probe access first so we can give a precise, actionable error when the
    // repo is private and we lack (or no longer have) permission to read it.
    const access = await getRepoAccessStatus(owner, repo, accessToken);
    if (!access.accessible && (access.status === 404 || access.status === 403 || access.status === 401)) {
      return NextResponse.json(
        {
          error: accessToken
            ? "This repository is private and your GitHub connection no longer has access. Reconnect GitHub to continue."
            : "This repository is private. Connect GitHub to grant VibeDash read access.",
          code: "repo_inaccessible",
          needsReconnect: true,
        },
        { status: 403 }
      );
    }

    // Fetch code and README from GitHub
    const [code, readmeContent] = await Promise.all([
      fetchKeyFiles(owner, repo, accessToken),
      fetchReadme(owner, repo, accessToken),
    ]);

    if (!code || code.length < 100) {
      return NextResponse.json(
        { error: "Could not fetch sufficient code from repository" },
        { status: 400 }
      );
    }

    if (readmeContent) {
      console.log(`📄 README.md found (${readmeContent.length} chars) — using as primary source for review`);
    } else {
      console.log(`⚠️  No README.md found in repository`);
    }

    // Analyze code with AI (README is passed separately for prominence in the prompt)
    const analysis = await analyzeCode(code, project, readmeContent);

    // Create AI review record
    const review = createAIReview(
      id,
      "code-review",
      analysis,
      undefined
    );

    // Add review to project's aiReviews array and update project
    const updateDoc1: Record<string, unknown> = {
      $push: { aiReviews: review },
      $set: { updatedAt: new Date().toISOString() }
    };
    await db.collection("projects").updateOne(
      { _id: new ObjectId(id), userId },
      updateDoc1
    );

    // Auto-add AI-suggested tasks to the project (skip duplicates of existing tasks)
    const existingTasks: Task[] = project.tasks || [];
    const existingTitlesNormalized = new Set(
      existingTasks.map(t => t.title.replace(/^🤖 /, "").toLowerCase().trim())
    );

    const aiTasks: Task[] = (review.suggestedTasks || [])
      .filter(st => {
        const normalizedTitle = st.title.toLowerCase().trim();
        // Skip if a task with a similar title already exists (done, in-progress, or todo)
        return !existingTitlesNormalized.has(normalizedTitle);
      })
      .map((st, idx) => ({
        id: `ai-task-${Date.now()}-${idx}`,
        projectId: id,
        title: `🤖 ${st.title}`,
        description: st.description,
        phase: st.phase,
        status: "todo" as const,
        priority: st.priority,
        createdAt: new Date().toISOString(),
      }));

    if (aiTasks.length > 0) {
      const taskUpdate: Record<string, unknown> = {
        $push: { tasks: { $each: aiTasks } },
      };
      await db.collection("projects").updateOne(
        { _id: new ObjectId(id), userId },
        taskUpdate
      );
    }

    // Add timeline event
    const timelineEvent: TimelineEvent = {
      id: `evt-${Date.now()}`,
      projectId: id,
      type: "ai-review",
      title: "AI Code Review Completed",
      description: `AI analysis: ${analysis.summary.substring(0, 100)}...`,
      date: new Date().toISOString(),
      metadata: { 
        reviewId: review.id,
        completenessScore: analysis.completenessScore,
        bugsFound: analysis.bugsFound.length
      },
    };

    const updateDoc2: Record<string, unknown> = { $push: { timeline: timelineEvent } };
    await db.collection("projects").updateOne(
      { _id: new ObjectId(id), userId },
      updateDoc2
    );

    // Get updated project
    const updatedProject = await db
      .collection("projects")
      .findOne({ _id: new ObjectId(id), userId });

    return NextResponse.json({
      review,
      analysis,
      project: {
        ...updatedProject,
        id: updatedProject?._id.toString(),
        _id: undefined,
      },
    });
  } catch (error) {
    console.error("POST /api/projects/[id]/ai-review error:", error);
    return NextResponse.json(
      { error: "Failed to perform AI code review" },
      { status: 500 }
    );
  }
}

// GET /api/projects/[id]/ai-review — Get all AI reviews for project
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

    const reviews: AIReview[] = project.aiReviews || [];

    return NextResponse.json({
      reviews: reviews.sort((a: AIReview, b: AIReview) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    });
  } catch (error) {
    console.error("GET /api/projects/[id]/ai-review error:", error);
    return NextResponse.json(
      { error: "Failed to fetch AI reviews" },
      { status: 500 }
    );
  }
}
