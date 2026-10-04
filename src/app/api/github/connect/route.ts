import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getGitHubAuthUrl } from "@/lib/github-service";

// GET /api/github/connect?projectId=xxx
// Redirects the user to GitHub's OAuth consent screen so VibeDash can read
// their PRIVATE repositories. `projectId` is optional and only used to return
// the user to the right page afterwards.
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
      return NextResponse.json(
        { error: "GitHub OAuth is not configured (missing GITHUB_CLIENT_ID/SECRET)" },
        { status: 503 }
      );
    }

    const projectId = request.nextUrl.searchParams.get("projectId") || "";

    // `state` carries who authorized + where to send them back. The callback
    // validates the userId against the signed-in session.
    const state = JSON.stringify({ userId, projectId });

    return NextResponse.redirect(getGitHubAuthUrl(state));
  } catch (error) {
    console.error("GitHub connect error:", error);
    return NextResponse.json(
      { error: "Failed to initiate GitHub connection" },
      { status: 500 }
    );
  }
}
