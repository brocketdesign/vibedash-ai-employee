import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";

// POST /api/seed — seed the database with initial mock data
export async function POST() {
  try {
    const { db } = await connectToDatabase();

    const existing = await db.collection("projects").countDocuments();
    if (existing > 0) {
      return NextResponse.json({
        message: `Database already has ${existing} projects. Skipping seed.`,
        seeded: false,
      });
    }

    const { mockProjects } = await import("@/lib/mock-data");

    const projectsToInsert = mockProjects.map((p) => {
      const { id, ...rest } = p;
      return rest;
    });

    await db.collection("projects").insertMany(projectsToInsert);

    return NextResponse.json({
      message: `Seeded ${projectsToInsert.length} projects`,
      seeded: true,
    });
  } catch (error) {
    console.error("POST /api/seed error:", error);
    return NextResponse.json(
      { error: "Failed to seed database" },
      { status: 500 }
    );
  }
}
