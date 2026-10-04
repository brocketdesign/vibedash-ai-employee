import { NextRequest, NextResponse } from "next/server";

// GET /api/demo — set demo_mode cookie and redirect to dashboard
export async function GET(request: NextRequest) {
  const url = new URL("/dashboard", request.url);
  const response = NextResponse.redirect(url);
  response.cookies.set("demo_mode", "true", {
    path: "/",
    maxAge: 60 * 60 * 24, // 24 hours
    httpOnly: false,
    sameSite: "lax",
  });
  return response;
}
