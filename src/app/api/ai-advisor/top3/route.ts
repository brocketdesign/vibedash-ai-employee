// ============================================================
// VibeDash — Today's Top 3 API
// GET  /api/ai-advisor/top3   — get today's top 3 (cached)
// POST /api/ai-advisor/top3   — force-regenerate
// PUT  /api/ai-advisor/top3   — pin/unpin an action
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import { generateTop3Actions } from "@/lib/ai-service-server";
import { Top3Action } from "@/types";
import { ObjectId } from "mongodb";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

// GET — return today's cached actions (or generate if missing)
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    const date = todayKey();

    // Fetch cached entry for today
    const entry = await db
      .collection("top3_actions")
      .findOne({ userId, date });

    if (entry) {
      return NextResponse.json({
        date: entry.date,
        actions: entry.actions,
        generatedAt: entry.generatedAt,
      });
    }

    // No cached entry — auto-generate
    const projects = await db
      .collection("projects")
      .find({ userId })
      .sort({ updatedAt: -1 })
      .toArray();

    const formatted = projects.map((p) => ({
      ...p,
      id: p._id.toString(),
      _id: undefined,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const actions = await generateTop3Actions(formatted as any);

    const now = new Date().toISOString();
    await db.collection("top3_actions").insertOne({
      userId,
      date,
      actions,
      generatedAt: now,
    });

    return NextResponse.json({ date, actions, generatedAt: now });
  } catch (error) {
    console.error("GET /api/ai-advisor/top3 error:", error);
    return NextResponse.json(
      { error: "Failed to fetch top 3 actions", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 },
    );
  }
}

// POST — force regenerate (replaces today's entry, preserves pinned)
export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    const date = todayKey();

    // Keep existing pinned actions
    const existing = await db
      .collection("top3_actions")
      .findOne({ userId, date });
    const pinned: Top3Action[] = (existing?.actions || []).filter(
      (a: Top3Action) => a.pinned,
    );

    const projects = await db
      .collection("projects")
      .find({ userId })
      .sort({ updatedAt: -1 })
      .toArray();

    const formatted = projects.map((p) => ({
      ...p,
      id: p._id.toString(),
      _id: undefined,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let freshActions = await generateTop3Actions(formatted as any);

    // Merge: pinned first, fill remaining slots with fresh actions
    const pinnedIds = new Set(pinned.map((a) => a.projectId + a.nextStep));
    freshActions = freshActions.filter(
      (a) => !pinnedIds.has(a.projectId + a.nextStep),
    );
    const merged = [...pinned, ...freshActions].slice(0, 3);

    const now = new Date().toISOString();
    await db.collection("top3_actions").updateOne(
      { userId, date },
      { $set: { actions: merged, generatedAt: now } },
      { upsert: true },
    );

    return NextResponse.json({ date, actions: merged, generatedAt: now });
  } catch (error) {
    console.error("POST /api/ai-advisor/top3 error:", error);
    return NextResponse.json(
      { error: "Failed to regenerate top 3 actions" },
      { status: 500 },
    );
  }
}

// PUT — update an action (pin/unpin, mark complete)
export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { actionId, pinned, completed } = body as {
      actionId: string;
      pinned?: boolean;
      completed?: boolean;
    };

    if (!actionId) {
      return NextResponse.json({ error: "actionId required" }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    const date = todayKey();

    const entry = await db
      .collection("top3_actions")
      .findOne({ userId, date });

    if (!entry) {
      return NextResponse.json({ error: "No actions for today" }, { status: 404 });
    }

    const actions: Top3Action[] = entry.actions.map((a: Top3Action) => {
      if (a.id !== actionId) return a;
      return {
        ...a,
        pinned: pinned !== undefined ? pinned : a.pinned,
        completedAt: completed ? new Date().toISOString() : a.completedAt,
      };
    });

    await db.collection("top3_actions").updateOne(
      { userId, date },
      { $set: { actions } },
    );

    // If marking complete, also update the project's pipeline task statuses
    if (completed) {
      const action = actions.find((a) => a.id === actionId);
      if (action && !action.completedAt) {
        // Advance: find outstanding todo tasks for this project in the current stage
        let projectFilter: Record<string, unknown> = { userId };
        try {
          projectFilter._id = new ObjectId(action.projectId);
        } catch {
          // If projectId is not a valid ObjectId, skip
        }
        const project = await db
          .collection("projects")
          .findOne(projectFilter);

        if (project) {
          const tasks = (project.tasks || []).map(
            (t: { status: string; phase: string; id: string }) => {
              if (
                t.status === "todo" &&
                t.phase === action.pipelineStage
              ) {
                return { ...t, status: "done" };
              }
              return t;
            },
          );
          await db
            .collection("projects")
            .updateOne(
              { _id: project._id },
              { $set: { tasks, updatedAt: new Date().toISOString() } },
            );
        }
      }
    }

    return NextResponse.json({ date, actions });
  } catch (error) {
    console.error("PUT /api/ai-advisor/top3 error:", error);
    return NextResponse.json(
      { error: "Failed to update action" },
      { status: 500 },
    );
  }
}
