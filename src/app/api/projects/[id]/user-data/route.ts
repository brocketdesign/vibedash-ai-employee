import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ObjectId } from "mongodb";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/projects/[id]/user-data — connection status + cached data + viewConfig
export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });

    const { db } = await connectToDatabase();

    // Verify project ownership
    const project = await db.collection("projects").findOne({ _id: new ObjectId(id), userId });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const connection = await db.collection("userDataConnections").findOne({ projectId: id, userId });

    if (!connection) {
      return NextResponse.json({ connected: false });
    }

    return NextResponse.json({
      connected: true,
      externalApiUrl: connection.externalApiUrl,
      connectedAt: connection.connectedAt,
      lastFetchedAt: connection.lastFetchedAt,
      cachedData: connection.cachedData || null,
      viewConfig: connection.viewConfig || null,
      viewGeneratedAt: connection.viewGeneratedAt,
    });
  } catch (error) {
    console.error("GET /api/projects/[id]/user-data error:", error);
    return NextResponse.json({ error: "Failed to fetch user data connection" }, { status: 500 });
  }
}

// POST /api/projects/[id]/user-data — connect (store external URL)
export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });

    const body = await req.json();
    const { externalApiUrl } = body;

    if (!externalApiUrl || typeof externalApiUrl !== "string") {
      return NextResponse.json({ error: "externalApiUrl is required" }, { status: 400 });
    }

    // Validate URL format
    try {
      new URL(externalApiUrl);
    } catch {
      return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
    }

    const { db } = await connectToDatabase();

    // Verify project ownership
    const project = await db.collection("projects").findOne({ _id: new ObjectId(id), userId });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const now = new Date().toISOString();

    await db.collection("userDataConnections").updateOne(
      { projectId: id, userId },
      {
        $set: { externalApiUrl, updatedAt: now },
        $setOnInsert: { connectedAt: now },
      },
      { upsert: true }
    );

    // Also mirror connectedAt snapshot onto the project doc for quick UI access
    await db.collection("projects").updateOne(
      { _id: new ObjectId(id), userId },
      {
        $set: {
          "userDataConnection.externalApiUrl": externalApiUrl,
          "userDataConnection.connectedAt": now,
          updatedAt: now,
        },
      }
    );

    return NextResponse.json({ success: true, externalApiUrl, connectedAt: now });
  } catch (error) {
    console.error("POST /api/projects/[id]/user-data error:", error);
    return NextResponse.json({ error: "Failed to connect user data" }, { status: 500 });
  }
}

// DELETE /api/projects/[id]/user-data — disconnect
export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });

    const { db } = await connectToDatabase();

    const project = await db.collection("projects").findOne({ _id: new ObjectId(id), userId });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    await db.collection("userDataConnections").deleteOne({ projectId: id, userId });
    await db.collection("projects").updateOne(
      { _id: new ObjectId(id), userId },
      { $unset: { userDataConnection: "" }, $set: { updatedAt: new Date().toISOString() } }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/projects/[id]/user-data error:", error);
    return NextResponse.json({ error: "Failed to disconnect user data" }, { status: 500 });
  }
}
