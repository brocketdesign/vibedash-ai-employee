import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import crypto from "crypto";

/**
 * Validate an API key from the request and return the userId.
 * API keys are passed via `Authorization: Bearer vd_...` header
 * or `x-api-key: vd_...` header.
 */
export async function authenticateApiKey(
  request: NextRequest
): Promise<{ userId: string } | NextResponse> {
  const authHeader = request.headers.get("authorization");
  const xApiKey = request.headers.get("x-api-key");

  let apiKey: string | null = null;

  if (authHeader?.startsWith("Bearer vd_")) {
    apiKey = authHeader.slice(7); // Remove "Bearer "
  } else if (xApiKey?.startsWith("vd_")) {
    apiKey = xApiKey;
  }

  if (!apiKey) {
    return NextResponse.json(
      {
        error: "Unauthorized",
        message:
          "Missing or invalid API key. Pass your key via `Authorization: Bearer vd_...` or `x-api-key: vd_...` header.",
      },
      { status: 401 }
    );
  }

  // Hash the key to look it up in DB (we store hashed keys)
  const hashedKey = hashApiKey(apiKey);

  const { db } = await connectToDatabase();
  const keyDoc = await db.collection("apiKeys").findOne({
    hashedKey,
    revoked: { $ne: true },
  });

  if (!keyDoc) {
    return NextResponse.json(
      { error: "Unauthorized", message: "Invalid or revoked API key." },
      { status: 401 }
    );
  }

  // Update last used timestamp
  await db.collection("apiKeys").updateOne(
    { _id: keyDoc._id },
    { $set: { lastUsedAt: new Date().toISOString() }, $inc: { usageCount: 1 } }
  );

  return { userId: keyDoc.userId };
}

/**
 * Generate a new API key with "vd_" prefix
 */
export function generateApiKey(): string {
  const random = crypto.randomBytes(32).toString("hex");
  return `vd_${random}`;
}

/**
 * Hash an API key for storage (we never store raw keys)
 */
export function hashApiKey(key: string): string {
  return crypto.createHash("sha256").update(key).digest("hex");
}
