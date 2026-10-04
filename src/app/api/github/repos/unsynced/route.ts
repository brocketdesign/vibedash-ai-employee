import { NextRequest, NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";

// GET /api/github/repos/unsynced — Fetch GitHub repos not yet added as projects
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get the user's GitHub OAuth access token from Clerk
    const clerk = await clerkClient();
    const tokenResponse = await clerk.users.getUserOauthAccessToken(userId, "oauth_github");
    const tokens = tokenResponse.data;

    if (!tokens || tokens.length === 0) {
      return NextResponse.json(
        { error: "GitHub account not connected. Please connect your GitHub account in settings." },
        { status: 400 }
      );
    }

    const accessToken = tokens[0].token;

    // Fetch repos from GitHub
    const response = await fetch(
      "https://api.github.com/user/repos?sort=updated&per_page=100&type=owner",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "VibeDash-App",
        },
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("GitHub API error:", errorData);
      return NextResponse.json(
        { error: "Failed to fetch repositories from GitHub" },
        { status: response.status }
      );
    }

    const repos = await response.json();

    // Get existing projects for this user to filter out already-synced repos
    const { db } = await connectToDatabase();
    const existingProjects = await db
      .collection("projects")
      .find({ userId })
      .project({ githubRepo: 1 })
      .toArray();

    const syncedRepoNames = new Set(
      existingProjects
        .map((p) => p.githubRepo?.toLowerCase())
        .filter(Boolean)
    );

    // Filter out repos that are already synced as projects
    const unsyncedRepos = repos
      .filter((repo: { full_name: string }) => !syncedRepoNames.has(repo.full_name.toLowerCase()))
      .map(
        (repo: {
          id: number;
          name: string;
          full_name: string;
          description: string | null;
          html_url: string;
          language: string | null;
          stargazers_count: number;
          forks_count: number;
          open_issues_count: number;
          created_at: string;
          updated_at: string;
          topics: string[];
        }) => ({
          id: repo.id,
          name: repo.name,
          full_name: repo.full_name,
          description: repo.description,
          html_url: repo.html_url,
          language: repo.language,
          stargazers_count: repo.stargazers_count,
          forks_count: repo.forks_count,
          open_issues_count: repo.open_issues_count,
          created_at: repo.created_at,
          updated_at: repo.updated_at,
          topics: repo.topics || [],
        })
      );

    return NextResponse.json(unsyncedRepos);
  } catch (error) {
    console.error("GET /api/github/repos/unsynced error:", error);
    return NextResponse.json(
      { error: "Failed to fetch repositories" },
      { status: 500 }
    );
  }
}
