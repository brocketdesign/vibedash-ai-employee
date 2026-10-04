import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import crypto from "crypto";

function generateConnectionToken(): string {
  const random = crypto.randomBytes(32).toString("hex");
  return `vd_${random}`;
}

function maskToken(token: string): string {
  return token.slice(0, 10) + "..." + token.slice(-4);
}

// GET /api/user/connection-token — return masked token info (never raw)
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    const user = await db.collection("users").findOne({ clerkId: userId });

    if (!user?.vibedashConnectionToken) {
      return NextResponse.json({ hasToken: false });
    }

    return NextResponse.json({
      hasToken: true,
      tokenPrefix: user.vibedashConnectionTokenPrefix || maskToken(user.vibedashConnectionToken),
      createdAt: user.vibedashConnectionTokenCreatedAt,
    });
  } catch (error) {
    console.error("GET /api/user/connection-token error:", error);
    return NextResponse.json({ error: "Failed to fetch token info" }, { status: 500 });
  }
}

// POST /api/user/connection-token — generate (or regenerate) the account token
// Returns the raw token ONCE — caller must copy it immediately
export async function POST() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = generateConnectionToken();
    const tokenPrefix = maskToken(token);
    const createdAt = new Date().toISOString();

    const { db } = await connectToDatabase();
    await db.collection("users").updateOne(
      { clerkId: userId },
      {
        $set: {
          vibedashConnectionToken: token,
          vibedashConnectionTokenPrefix: tokenPrefix,
          vibedashConnectionTokenCreatedAt: createdAt,
        },
      },
      { upsert: true }
    );

    // Return raw token only once
    return NextResponse.json({ token, tokenPrefix, createdAt });
  } catch (error) {
    console.error("POST /api/user/connection-token error:", error);
    return NextResponse.json({ error: "Failed to generate token" }, { status: 500 });
  }
}

// DELETE /api/user/connection-token — revoke token
export async function DELETE() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    await db.collection("users").updateOne(
      { clerkId: userId },
      {
        $unset: {
          vibedashConnectionToken: "",
          vibedashConnectionTokenPrefix: "",
          vibedashConnectionTokenCreatedAt: "",
        },
      }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/user/connection-token error:", error);
    return NextResponse.json({ error: "Failed to revoke token" }, { status: 500 });
  }
}
