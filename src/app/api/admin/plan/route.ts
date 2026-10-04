import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import { NextRequest, NextResponse } from "next/server";

// GET current user plan
export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { db } = await connectToDatabase();
  const user = await db
    .collection("users")
    .findOne({ clerkId: userId }, { projection: { plan: 1, trialStartedAt: 1, trialEndsAt: 1 } });

  const plan = user?.plan ?? "free";
  const trialEndsAt = user?.trialEndsAt ?? null;

  // Automatically downgrade an expired trial to free
  if (plan === "trial" && trialEndsAt && new Date(trialEndsAt) < new Date()) {
    await db
      .collection("users")
      .updateOne({ clerkId: userId }, { $set: { plan: "free", updatedAt: new Date().toISOString() } });
    return NextResponse.json({ plan: "free", trialEndsAt: null });
  }

  return NextResponse.json({ plan, trialEndsAt });
}

// POST set plan (free | trial | pro)
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const newPlan = body.plan;

  if (!["free", "trial", "pro"].includes(newPlan)) {
    return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
  }

  const { db } = await connectToDatabase();

  const update: Record<string, string> = {
    plan: newPlan,
    updatedAt: new Date().toISOString(),
  };

  if (newPlan === "trial") {
    const now = new Date();
    const trialEnd = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days
    update.trialStartedAt = now.toISOString();
    update.trialEndsAt = trialEnd.toISOString();
  }

  await db
    .collection("users")
    .updateOne({ clerkId: userId }, { $set: update });

  return NextResponse.json({ plan: newPlan });
}

