import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { auth } from "@clerk/nextjs/server";
import { RevenueAction } from "@/types";

export const runtime = "nodejs";

// Helpers
function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

function yesterdayKey(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// Compute current streak from an ordered array of date strings (DESC)
function computeStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const today = todayKey();
  const yesterday = yesterdayKey();

  // Streak must include today or yesterday to be "active"
  const latest = dates[0];
  if (latest !== today && latest !== yesterday) return 0;

  let streak = 1;
  for (let i = 1; i < dates.length; i++) {
    const prev = new Date(dates[i - 1] + "T00:00:00Z");
    const curr = new Date(dates[i] + "T00:00:00Z");
    const diff = (prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24);
    if (diff === 1) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

// GET /api/ai-advisor/streak — get current streak data
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    const doc = await db.collection("revenue_streaks").findOne({ userId });

    if (!doc) {
      return NextResponse.json({
        currentStreak: 0,
        longestStreak: 0,
        lastActionAt: null,
        todayActions: [],
        doneToday: false,
      });
    }

    const today = todayKey();
    const todayActions: RevenueAction[] = (doc.actions || []).filter(
      (a: RevenueAction) => a.completedAt.slice(0, 10) === today
    );

    // Recompute streak from stored dates
    const streakDates: string[] = (doc.streakDates || []).sort(
      (a: string, b: string) => (a > b ? -1 : 1)
    );
    const currentStreak = computeStreak(streakDates);
    const longestStreak = Math.max(doc.longestStreak || 0, currentStreak);

    return NextResponse.json({
      currentStreak,
      longestStreak,
      lastActionAt: doc.lastActionAt || null,
      todayActions,
      doneToday: todayActions.length > 0,
    });
  } catch (error) {
    console.error("GET /api/ai-advisor/streak error:", error);
    return NextResponse.json({ error: "Failed to fetch streak" }, { status: 500 });
  }
}

// POST /api/ai-advisor/streak — record a revenue action
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { type, label, projectName } = body as {
      type: "money-step" | "revenue-task";
      label: string;
      projectName?: string;
    };

    if (!type || !label) {
      return NextResponse.json(
        { error: "type and label are required" },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const today = todayKey();

    const action: RevenueAction = {
      id: `ra-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      label,
      projectName,
      completedAt: now,
    };

    const { db } = await connectToDatabase();
    const doc = await db.collection("revenue_streaks").findOne({ userId });

    if (!doc) {
      // First ever revenue action
      await db.collection("revenue_streaks").insertOne({
        userId,
        actions: [action],
        streakDates: [today],
        lastActionAt: now,
        longestStreak: 1,
        updatedAt: now,
      });
      return NextResponse.json({
        currentStreak: 1,
        longestStreak: 1,
        lastActionAt: now,
        todayActions: [action],
        doneToday: true,
        isNewStreak: true,
      });
    }

    // Append action
    const existingDates: string[] = doc.streakDates || [];
    const alreadyHasToday = existingDates.includes(today);

    const updatedDates = alreadyHasToday
      ? existingDates
      : [today, ...existingDates];

    // Keep only last 365 days of dates and last 100 actions
    const trimmedDates = updatedDates.slice(0, 365);
    const existingActions: RevenueAction[] = doc.actions || [];
    const trimmedActions = [action, ...existingActions].slice(0, 100);

    // Compute new streak
    const sortedDates = [...trimmedDates].sort((a, b) => (a > b ? -1 : 1));
    const currentStreak = computeStreak(sortedDates);
    const longestStreak = Math.max(doc.longestStreak || 0, currentStreak);

    await db.collection("revenue_streaks").updateOne(
      { userId },
      {
        $set: {
          actions: trimmedActions,
          streakDates: trimmedDates,
          lastActionAt: now,
          longestStreak,
          updatedAt: now,
        },
      }
    );

    // Today's actions
    const todayActions = trimmedActions.filter(
      (a) => a.completedAt.slice(0, 10) === today
    );

    // Detect if this is a new day being added (first action today)
    const isNewStreak = !alreadyHasToday;

    return NextResponse.json({
      currentStreak,
      longestStreak,
      lastActionAt: now,
      todayActions,
      doneToday: true,
      isNewStreak,
    });
  } catch (error) {
    console.error("POST /api/ai-advisor/streak error:", error);
    return NextResponse.json(
      { error: "Failed to record revenue action" },
      { status: 500 }
    );
  }
}
