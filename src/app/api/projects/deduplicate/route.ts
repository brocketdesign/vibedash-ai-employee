import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { auth } from "@clerk/nextjs/server";

// POST /api/projects/deduplicate — Remove duplicate projects for current user.
// Keeps the most recently updated copy of each githubRepo.
export async function POST() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { db } = await connectToDatabase();

    // Find all projects for this user that have a githubRepo
    const projects = await db
      .collection("projects")
      .find({ userId, githubRepo: { $ne: "" } })
      .sort({ updatedAt: -1 })
      .toArray();

    // Group by githubRepo
    const grouped = new Map<string, typeof projects>();
    for (const project of projects) {
      const key = project.githubRepo as string;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(project);
    }

    // Collect IDs of duplicates to delete (keep the first = most recent)
    const idsToDelete = [];
    let duplicateCount = 0;

    for (const [, copies] of grouped) {
      if (copies.length > 1) {
        // Keep the first one (most recently updated), delete the rest
        for (let i = 1; i < copies.length; i++) {
          idsToDelete.push(copies[i]._id);
          duplicateCount++;
        }
      }
    }

    if (idsToDelete.length > 0) {
      await db.collection("projects").deleteMany({
        _id: { $in: idsToDelete },
      });
    }

    console.log(
      `[Deduplicate] userId=${userId} removed=${duplicateCount} duplicates across ${grouped.size} repos`
    );

    return NextResponse.json({
      success: true,
      removed: duplicateCount,
      remaining: projects.length - duplicateCount,
    });
  } catch (error) {
    console.error("POST /api/projects/deduplicate error:", error);
    return NextResponse.json(
      { error: "Failed to deduplicate projects" },
      { status: 500 }
    );
  }
}
