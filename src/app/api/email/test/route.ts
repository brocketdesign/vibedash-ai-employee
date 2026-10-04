// ============================================================
// VibeDash — Test Email API Endpoint (developer use)
// POST /api/email/test
//
// Body:
//   { "to": "someone@example.com" }
//
// If no "to" is provided, sends to the authenticated user's
// Clerk email + any additional email configured in settings.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import { sendEmail } from "@/lib/email-service";
import { testEmailTemplate } from "@/lib/email-templates";
import { getAppUrl } from "@/lib/utils";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));

    // Get Clerk user info
    const clerkUser = await currentUser();
    const clerkEmail =
      clerkUser?.emailAddresses.find(
        (e) => e.id === clerkUser.primaryEmailAddressId
      )?.emailAddress ||
      clerkUser?.emailAddresses[0]?.emailAddress ||
      "";

    const userName =
      [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ") ||
      "Developer";

    // Determine recipients
    const recipients: string[] = [];

    if (body.to) {
      // Override: send only to the specified address
      recipients.push(body.to);
    } else {
      // Use Clerk email
      if (clerkEmail) recipients.push(clerkEmail);

      // Also check for additional email in notification settings
      const { db } = await connectToDatabase();
      const settings = await db
        .collection("notification_settings")
        .findOne({ userId });

      if (settings?.additionalEmail && settings.additionalEmail.trim() !== "") {
        recipients.push(settings.additionalEmail.trim());
      }
    }

    if (recipients.length === 0) {
      return NextResponse.json(
        { error: "No recipient email addresses found" },
        { status: 400 }
      );
    }

    const appUrl = getAppUrl();
    const timestamp = new Date().toLocaleString("en-US", {
      dateStyle: "full",
      timeStyle: "long",
    });

    const html = testEmailTemplate({
      recipientName: userName,
      recipientEmail: recipients.join(", "),
      dashboardUrl: appUrl,
      timestamp,
    });

    const result = await sendEmail({
      to: recipients,
      subject: "✅ VibeDash — Test Email",
      html,
      tags: [
        { name: "type", value: "test" },
        { name: "userId", value: userId },
      ],
    });

    return NextResponse.json({
      success: true,
      sentTo: recipients,
      messageId: result?.data?.id || null,
      timestamp,
    });
  } catch (error) {
    console.error("POST /api/email/test error:", error);
    return NextResponse.json(
      {
        error: "Failed to send test email",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
