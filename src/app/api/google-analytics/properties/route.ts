import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { listGA4Properties } from "@/lib/google-analytics";

// GET /api/google-analytics/properties?projectId=xxx
// List the user's GA4 properties so they can pick one to link
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectId = request.nextUrl.searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 }
      );
    }

    const properties = await listGA4Properties(projectId, userId);
    return NextResponse.json(properties);
  } catch (error: unknown) {
    console.error("List GA properties error:", error);

    // Surface useful error details to the client
    let message = "Failed to list Google Analytics properties.";
    let status = 500;

    if (error instanceof Error) {
      if (error.message.includes("not connected")) {
        message = "Google Analytics is not connected for this project. Please connect your Google account first.";
        status = 404;
      } else if (error.message.includes("API has not been used") || error.message.includes("API has not been enabled") || error.message.includes("accessNotConfigured")) {
        message = "The Google Analytics Admin API is not enabled in the Google Cloud project. Please enable it in the Google Cloud Console.";
      } else if (error.message.includes("invalid_grant") || error.message.includes("Token has been expired or revoked")) {
        message = "Your Google connection has expired. Please disconnect and reconnect Google Analytics.";
        status = 401;
      } else {
        message += " " + error.message;
      }
    }

    return NextResponse.json({ error: message }, { status });
  }
}
