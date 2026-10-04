import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/login(.*)",
  "/signup(.*)",
  // Linked from the public landing page, so they must be reachable logged out.
  "/terms",
  "/privacy",
  "/api/seed(.*)",
  "/api/webhooks(.*)",
  "/api/demo(.*)",
  "/api/v1(.*)",
  "/docs(.*)",
]);

const isOnboardingRoute = createRouteMatcher(["/onboarding(.*)"]);
const isDashboardRoute = createRouteMatcher(["/dashboard(.*)", "/workspace(.*)"]);
const isAuthRoute = createRouteMatcher(["/login(.*)", "/signup(.*)"]);

export default clerkMiddleware(async (auth, request) => {
  const isDemoMode = request.cookies.get("demo_mode")?.value === "true";
  const { userId } = await auth();

  // If user is authenticated, clear the stale demo cookie
  if (userId && isDemoMode) {
    const response = NextResponse.next();
    response.cookies.delete("demo_mode");
    return response;
  }

  // Clear demo cookie when user navigates to login/signup so the auth flow
  // starts cleanly without any lingering demo state
  if (isDemoMode && isAuthRoute(request)) {
    const response = NextResponse.next();
    response.cookies.delete("demo_mode");
    return response;
  }

  // Allow demo users to access dashboard without authentication
  if (isDemoMode && isDashboardRoute(request)) {
    return;
  }

  if (!isPublicRoute(request) && !isOnboardingRoute(request)) {
    await auth.protect();
  }
  
  // Onboarding routes need auth but will be handled by the layout
  if (isOnboardingRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
