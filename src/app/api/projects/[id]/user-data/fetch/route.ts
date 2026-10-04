import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

// POST /api/projects/[id]/user-data/fetch
// Calls the external project URL with the account Bearer token, caches the response
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });

    const { db } = await connectToDatabase();

    // Verify project ownership
    const project = await db.collection("projects").findOne({ _id: new ObjectId(id), userId });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    // Get connection
    const connection = await db.collection("userDataConnections").findOne({ projectId: id, userId });
    if (!connection) {
      return NextResponse.json({ error: "No user data connection found for this project" }, { status: 404 });
    }

    // Get account-level token
    const user = await db.collection("users").findOne({ clerkId: userId });
    if (!user?.vibedashConnectionToken) {
      return NextResponse.json(
        { error: "No connection token found. Generate one in Settings → User Data." },
        { status: 400 }
      );
    }

    // Call external API with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    let externalData: Record<string, unknown>;
    try {
      const response = await fetch(connection.externalApiUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${user.vibedashConnectionToken}`,
          "Content-Type": "application/json",
          "X-VibeDash-ProjectId": id,
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        return NextResponse.json(
          { error: `External API returned ${response.status}`, detail: text.slice(0, 300) },
          { status: 502 }
        );
      }

      externalData = await response.json();
    } catch (fetchErr) {
      clearTimeout(timeout);
      if ((fetchErr as Error).name === "AbortError") {
        return NextResponse.json({ error: "External API timed out (15s)" }, { status: 504 });
      }
      return NextResponse.json(
        { error: "Failed to reach external API", detail: String(fetchErr) },
        { status: 502 }
      );
    }

    const now = new Date().toISOString();

    // Cache the response
    await db.collection("userDataConnections").updateOne(
      { projectId: id, userId },
      { $set: { cachedData: externalData, lastFetchedAt: now } }
    );

    // Mirror lastFetchedAt on project doc
    await db.collection("projects").updateOne(
      { _id: new ObjectId(id), userId },
      { $set: { "userDataConnection.lastFetchedAt": now, updatedAt: now } }
    );

    return NextResponse.json({ success: true, data: externalData, fetchedAt: now });
  } catch (error) {
    console.error("POST /api/projects/[id]/user-data/fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch user data" }, { status: 500 });
  }
}
