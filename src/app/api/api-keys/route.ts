import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { generateApiKey, hashApiKey } from "@/lib/api-auth";
import { auth } from "@clerk/nextjs/server";
import { ObjectId } from "mongodb";

// GET /api/api-keys — list all API keys for the current user
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { db } = await connectToDatabase();
    const keys = await db
      .collection("apiKeys")
      .find({ userId })
      .sort({ createdAt: -1 })
      .toArray();

    // Never return the hashed key — return masked info only
    const formatted = keys.map((k) => ({
      id: k._id.toString(),
      name: k.name,
      prefix: k.prefix, // e.g. "vd_a3b2...c4d1"
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt || null,
      usageCount: k.usageCount || 0,
      revoked: k.revoked || false,
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("GET /api/api-keys error:", error);
    return NextResponse.json(
      { error: "Failed to fetch API keys" },
      { status: 500 }
    );
  }
}

// POST /api/api-keys — create a new API key
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const name = body.name?.trim() || "Unnamed Key";

    const rawKey = generateApiKey();
    const hashedKey = hashApiKey(rawKey);
    const prefix = rawKey.slice(0, 10) + "..." + rawKey.slice(-4);

    const { db } = await connectToDatabase();

    const keyDoc = {
      userId,
      name,
      hashedKey,
      prefix,
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
      usageCount: 0,
      revoked: false,
    };

    const result = await db.collection("apiKeys").insertOne(keyDoc);

    // Return the raw key ONLY on creation (this is the only time the user can see it)
    return NextResponse.json({
      id: result.insertedId.toString(),
      name,
      key: rawKey,
      prefix,
      createdAt: keyDoc.createdAt,
      message:
        "Save this API key now. You will not be able to see it again.",
    });
  } catch (error) {
    console.error("POST /api/api-keys error:", error);
    return NextResponse.json(
      { error: "Failed to create API key" },
      { status: 500 }
    );
  }
}

// DELETE /api/api-keys — revoke an API key
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const keyId = searchParams.get("id");

    if (!keyId || !ObjectId.isValid(keyId)) {
      return NextResponse.json({ error: "Invalid key ID" }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    const result = await db.collection("apiKeys").findOneAndUpdate(
      { _id: new ObjectId(keyId), userId },
      { $set: { revoked: true, revokedAt: new Date().toISOString() } },
      { returnDocument: "after" }
    );

    if (!result) {
      return NextResponse.json({ error: "API key not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: "API key revoked" });
  } catch (error) {
    console.error("DELETE /api/api-keys error:", error);
    return NextResponse.json(
      { error: "Failed to revoke API key" },
      { status: 500 }
    );
  }
}
