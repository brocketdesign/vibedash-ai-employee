import { NextRequest, NextResponse } from "next/server";
import { runAllShifts } from "@/lib/employee/shift";
import { ensureIndexes } from "@/lib/employee/db";

export const runtime = "nodejs";
export const maxDuration = 800;
export const dynamic = "force-dynamic";

/**
 * The night shift cron. Vercel calls this on the schedule in vercel.json; it is
 * also safe to call manually with the CRON_SECRET.
 *
 * Authorisation accepts either Vercel's own cron header or an explicit bearer
 * secret, so the endpoint is never open to the internet.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const isVercelCron = request.headers.get("x-vercel-cron") !== null;

  if (!isVercelCron) {
    if (!secret) {
      return NextResponse.json(
        { error: "CRON_SECRET is not configured; refusing to run unauthenticated." },
        { status: 503 },
      );
    }
    if (authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const startedAt = Date.now();
  try {
    await ensureIndexes();
    const outcomes = await runAllShifts();

    const summary = {
      ran: outcomes.length,
      done: outcomes.filter((o) => o.status === "done").length,
      failed: outcomes.filter((o) => o.status === "failed").length,
      skipped: outcomes.filter((o) => o.status === "skipped").length,
      durationMs: Date.now() - startedAt,
    };

    console.log("[cron/night-shift]", JSON.stringify(summary));
    return NextResponse.json({ ...summary, outcomes });
  } catch (e) {
    console.error("[cron/night-shift] crashed", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Night shift failed" },
      { status: 500 },
    );
  }
}
