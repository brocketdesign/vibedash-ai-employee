import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import {
  syncGitHubStats,
  resolveGitHubToken,
  getRepoAccessStatus,
  parseGitHubUrl,
} from "@/lib/github-service";

// POST /api/projects/[id]/sync-github — Lightweight sync of GitHub stats (no AI required)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    const githubUrl = project.githubUrl as string;
    if (!githubUrl) {
      return NextResponse.json(
        { error: "No GitHub repository linked to this project" },
        { status: 400 }
      );
    }

    const accessToken = await resolveGitHubToken(
      userId,
      project.githubAccessToken as string | undefined
    );

    // Detect a private repo we can't read and ask the user to (re)connect.
    const parsed = parseGitHubUrl(githubUrl);
    if (parsed) {
      const access = await getRepoAccessStatus(parsed.owner, parsed.repo, accessToken);
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
    }

    const stats = await syncGitHubStats(githubUrl, accessToken);

    if (!stats) {
      return NextResponse.json(
        { error: "Failed to fetch GitHub stats" },
        { status: 502 }
      );
    }

    const updateData: Record<string, unknown> = {
      lastSyncedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (stats.repo) {
      updateData.stars = stats.repo.stargazers_count;
      updateData.openIssues = stats.repo.open_issues_count;

      // Sync repo name & URL in case the repository was renamed on GitHub
      if (stats.repo.full_name) {
        updateData.githubRepo = stats.repo.full_name;
        updateData.githubUrl = stats.repo.html_url;
        updateData.name = stats.repo.name; // keep project name in sync
      }

      // Sync tech stack from repo language if available
      if (stats.repo.language) {
        const existingStack = (project.techStack as string[]) || [];
        if (!existingStack.includes(stats.repo.language)) {
          updateData.techStack = [...existingStack, stats.repo.language];
        }
      }
    }

    if (stats.totalCommits > 0) {
      updateData.commits = stats.totalCommits;
    }

    if (stats.lastCommit) {
      updateData.lastCommit = {
        sha: stats.lastCommit.sha,
        message: stats.lastCommit.message,
        author: stats.lastCommit.author,
        date: stats.lastCommit.date,
      };
    }

    const result = await db.collection("projects").findOneAndUpdate(
      { _id: new ObjectId(id), userId },
      { $set: updateData },
      { returnDocument: "after" }
    );

    if (!result) {
      return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
    }

    return NextResponse.json({
      ...result,
      id: result._id.toString(),
      _id: undefined,
    });
  } catch (error) {
    console.error("POST /api/projects/[id]/sync-github error:", error);
    return NextResponse.json(
      { error: "Failed to sync GitHub stats" },
      { status: 500 }
    );
  }
}
