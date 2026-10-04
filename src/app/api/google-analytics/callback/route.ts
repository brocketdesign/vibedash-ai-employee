import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/google-analytics";
import { getAppUrl } from "@/lib/utils";

// GET /api/google-analytics/callback?code=xxx&state=xxx
// Google redirects here after the user grants consent
export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get("code");
    const stateParam = request.nextUrl.searchParams.get("state");
    const error = request.nextUrl.searchParams.get("error");

    if (error) {
      // User denied access
      return NextResponse.redirect(
        `${getAppUrl()}/dashboard/projects?ga_error=denied`
      );
    }

    if (!code || !stateParam) {
      return NextResponse.json(
        { error: "Missing code or state parameter" },
        { status: 400 }
      );
    }

    const { projectId, userId } = JSON.parse(stateParam);
    if (!projectId || !userId) {
      return NextResponse.json(
        { error: "Invalid state parameter" },
        { status: 400 }
      );
    }

    // Exchange code for tokens and store them
    await exchangeCodeForTokens(code, projectId, userId);

    // Redirect back to the project page with a success flag
    // so the UI can prompt the user to pick a GA property
    return NextResponse.redirect(
      `${getAppUrl()}/dashboard/projects/${projectId}?ga_connected=true`
    );
  } catch (err) {
    console.error("Google Analytics callback error:", err);
    return NextResponse.redirect(
      `${getAppUrl()}/dashboard/projects?ga_error=callback_failed`
    );
  }
}
