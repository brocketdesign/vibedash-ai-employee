import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { auth } from "@clerk/nextjs/server";
import { ObjectId } from "mongodb";

export const runtime = "nodejs";

// GET /api/ai-advisor/chat/sessions/[id] — get full session with messages
export async function GET(
  request: NextRequest,
  context: { params: Promise<Record<string, string>> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    const { db } = await connectToDatabase();
    const session = await db
      .collection("chat_sessions")
      .findOne({ _id: new ObjectId(id), userId });

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      session: {
        id: session._id.toString(),
        messages: session.messages,
        summary: session.summary,
        messageCount: session.messageCount,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
    });
  } catch (error) {
    console.error("Failed to fetch chat session:", error);
    return NextResponse.json(
      { error: "Failed to fetch chat session" },
      { status: 500 }
    );
  }
}
