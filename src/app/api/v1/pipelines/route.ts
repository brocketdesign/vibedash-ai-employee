import { NextRequest, NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-auth";
import { PHASES } from "@/lib/constants";

// GET /api/v1/pipelines — get all pipeline phases
export async function GET(request: NextRequest) {
  const authResult = await authenticateApiKey(request);
  if (authResult instanceof NextResponse) return authResult;

  const pipelines = PHASES.map((p) => ({
    id: p.id,
    label: p.label,
    icon: p.icon,
    color: p.color,
    description: p.description,
    order: p.order,
    defaultSubTasks: p.subTasks,
  }));

  return NextResponse.json({
    data: pipelines,
    total: pipelines.length,
  });
}
