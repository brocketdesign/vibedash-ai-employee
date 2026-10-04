import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { auth } from "@clerk/nextjs/server";
import { ObjectId } from "mongodb";

export const runtime = "nodejs";

// GET /api/ai-advisor/chat/sessions — list all chat sessions for the user
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    const sessions = await db
      .collection("chat_sessions")
      .find({ userId })
      .sort({ updatedAt: -1 })
      .project({ messages: 0 }) // Don't send messages in list view for performance
      .toArray();

    const mapped = sessions.map((s) => ({
      id: s._id.toString(),
      summary: s.summary,
      messageCount: s.messageCount || 0,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));

    return NextResponse.json({ sessions: mapped });
  } catch (error) {
    console.error("Failed to fetch chat sessions:", error);
    return NextResponse.json(
      { error: "Failed to fetch chat sessions" },
      { status: 500 }
    );
  }
}

// POST /api/ai-advisor/chat/sessions — create or update a chat session
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { sessionId, messages, summary } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const now = new Date().toISOString();

    // Generate summary from first user message if not provided
    const sessionSummary =
      summary ||
      (() => {
        const firstUser = messages.find(
          (m: { role: string }) => m.role === "user"
        );
        if (!firstUser) return "New conversation";
        const text = firstUser.content.trim();
        return text.length > 60 ? text.slice(0, 57) + "..." : text;
      })();

    if (sessionId) {
      // Update existing session
      const result = await db.collection("chat_sessions").findOneAndUpdate(
        { _id: new ObjectId(sessionId), userId },
        {
          $set: {
            messages,
            summary: sessionSummary,
            messageCount: messages.length,
            updatedAt: now,
          },
        },
        { returnDocument: "after" }
      );

      if (!result) {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        session: {
          id: result._id.toString(),
          summary: result.summary,
          messageCount: result.messageCount,
          createdAt: result.createdAt,
          updatedAt: result.updatedAt,
        },
      });
    } else {
      // Create new session
      const newSession = {
        userId,
        messages,
        summary: sessionSummary,
        messageCount: messages.length,
        createdAt: now,
        updatedAt: now,
      };

      const result = await db
        .collection("chat_sessions")
        .insertOne(newSession);

      return NextResponse.json({
        session: {
          id: result.insertedId.toString(),
          summary: sessionSummary,
          messageCount: messages.length,
          createdAt: now,
          updatedAt: now,
        },
      });
    }
  } catch (error) {
    console.error("Failed to save chat session:", error);
    return NextResponse.json(
      { error: "Failed to save chat session" },
      { status: 500 }
    );
  }
}

// DELETE /api/ai-advisor/chat/sessions — delete a session (by sessionId in body)
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("id");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();
    const result = await db
      .collection("chat_sessions")
      .deleteOne({ _id: new ObjectId(sessionId), userId });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete chat session:", error);
    return NextResponse.json(
      { error: "Failed to delete chat session" },
      { status: 500 }
    );
  }
}
