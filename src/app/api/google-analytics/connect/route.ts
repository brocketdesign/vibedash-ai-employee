import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getAuthUrl } from "@/lib/google-analytics";

// GET /api/google-analytics/connect?projectId=xxx
// Redirects the user to Google's OAuth consent screen
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = request.nextUrl.searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    const authUrl = getAuthUrl(projectId, userId);
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error("Google Analytics connect error:", error);
    return NextResponse.json(
      { error: "Failed to initiate Google Analytics connection" },
      { status: 500 }
    );
  }
}
