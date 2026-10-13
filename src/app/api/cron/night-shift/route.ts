import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { runAllShifts } from "@/lib/employee/shift";
import { ensureIndexes } from "@/lib/employee/db";

export const runtime = "nodejs";
export const maxDuration = 800;
export const dynamic = "force-dynamic";

/**
 * The night shift cron. Vercel calls this on the schedule in vercel.json and,
 * when CRON_SECRET is set in the project, sends it as a bearer token. It can
 * also be triggered by hand with the same token. Without the secret the
 * endpoint refuses to run, so it is never open to the internet.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured; refusing to run unauthenticated." },
      { status: 503 },
    );
  }
  if (!bearerMatches(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

/** Constant-time comparison of an Authorization header against `Bearer <secret>`. */
function bearerMatches(header: string | null, secret: string): boolean {
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
