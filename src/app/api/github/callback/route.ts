import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { exchangeGitHubCode } from "@/lib/github-service";
import { connectToDatabase } from "@/lib/mongodb";
import { getAppUrl } from "@/lib/utils";

// GET /api/github/callback?code=xxx&state=xxx
// GitHub redirects here after the user authorizes. We exchange the code for an
// access token (with `repo` scope) and store it per-user so every project owned
// by the user can read its private repositories.
export async function GET(request: NextRequest) {
  const appUrl = getAppUrl();

  // Where to send the user back to. Defaults to the projects list.
  const returnTo = (projectId: string, query: string) =>
    projectId
      ? `${appUrl}/dashboard/projects/${projectId}?${query}`
      : `${appUrl}/dashboard/github?${query}`;

  try {
    const code = request.nextUrl.searchParams.get("code");
    const stateParam = request.nextUrl.searchParams.get("state");
    const error = request.nextUrl.searchParams.get("error");

    let projectId = "";
    let stateUserId = "";
    if (stateParam) {
      try {
        const parsed = JSON.parse(stateParam);
        projectId = parsed.projectId || "";
        stateUserId = parsed.userId || "";
      } catch {
        // Malformed state — fall through to the generic error redirect below.
      }
    }

    if (error) {
      // User denied access on GitHub's consent screen.
      return NextResponse.redirect(returnTo(projectId, "github_error=denied"));
    }

    if (!code || !stateParam) {
      return NextResponse.redirect(returnTo(projectId, "github_error=missing_code"));
    }

    // Ensure the person completing the flow is the same signed-in user who
    // started it — prevents binding a token to someone else's account.
    const { userId } = await auth();
    if (!userId || userId !== stateUserId) {
      return NextResponse.redirect(returnTo(projectId, "github_error=auth_mismatch"));
    }

    const accessToken = await exchangeGitHubCode(code);
    if (!accessToken) {
      return NextResponse.redirect(returnTo(projectId, "github_error=token_exchange"));
    }

    // Persist the token per-user (upsert). Used as a fallback for any of the
    // user's projects that don't carry their own githubAccessToken.
    const { db } = await connectToDatabase();
    await db.collection("github_tokens").updateOne(
      { userId },
      {
        $set: {
          userId,
          accessToken,
          scope: "repo",
          updatedAt: new Date().toISOString(),
        },
        $setOnInsert: { createdAt: new Date().toISOString() },
      },
      { upsert: true }
    );

    return NextResponse.redirect(returnTo(projectId, "github_connected=true"));
  } catch (err) {
    console.error("GitHub callback error:", err);
    return NextResponse.redirect(`${appUrl}/dashboard/github?github_error=callback_failed`);
  }
}
