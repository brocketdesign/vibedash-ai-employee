import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { disconnectGA } from "@/lib/google-analytics";

// POST /api/google-analytics/disconnect
// Body: { projectId }
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = await request.json();
    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    await disconnectGA(projectId, userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Disconnect GA error:", error);
    return NextResponse.json(
      { error: "Failed to disconnect Google Analytics" },
      { status: 500 }
    );
  }
}
