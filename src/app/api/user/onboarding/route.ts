import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { auth } from "@clerk/nextjs/server";

// POST /api/user/onboarding — Update user onboarding status
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { completed } = body;

    const { db } = await connectToDatabase();
    
    // Use upsert to guarantee the document is created/updated even if
    // the Clerk webhook hasn't fired yet or the user record is missing.
    const result = await db.collection("users").updateOne(
      { clerkId: userId },
      { 
        $set: { 
          onboardingCompleted: completed,
          updatedAt: new Date().toISOString(),
        },
        $setOnInsert: {
          email: "",
          name: "User",
          plan: "free",
          githubConnected: false,
          createdAt: new Date().toISOString(),
        },
      },
      { upsert: true }
    );

    console.log(
      `[Onboarding POST] userId=${userId} completed=${completed} matched=${result.matchedCount} modified=${result.modifiedCount} upserted=${result.upsertedCount}`
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/user/onboarding error:", error);
    return NextResponse.json(
      { error: "Failed to update onboarding status" },
      { status: 500 }
    );
  }
}

// GET /api/user/onboarding — Check user onboarding status
export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { db } = await connectToDatabase();
    
    // Use findOneAndUpdate with upsert so the user document is always
    // initialised when we first check, avoiding a missing-document gap.
    const user = await db.collection("users").findOneAndUpdate(
      { clerkId: userId },
      {
        $setOnInsert: {
          email: "",
          name: "User",
          plan: "free",
          githubConnected: false,
          onboardingCompleted: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
      { upsert: true, returnDocument: "after", projection: { onboardingCompleted: 1 } }
    );

    console.log(
      `[Onboarding GET] userId=${userId} completed=${user?.onboardingCompleted}`
    );

    return NextResponse.json({ 
      completed: user?.onboardingCompleted === true
    });
  } catch (error) {
    console.error("GET /api/user/onboarding error:", error);
    return NextResponse.json(
      { error: "Failed to check onboarding status" },
      { status: 500 }
    );
  }
}
