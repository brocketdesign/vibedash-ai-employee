import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";

// POST /api/webhooks/clerk — Clerk webhook for user sync
// Configure this URL in your Clerk Dashboard → Webhooks
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const { type, data } = payload;

    const { db } = await connectToDatabase();

    switch (type) {
      case "user.created":
      case "user.updated": {
        const user = {
          clerkId: data.id,
          email:
            data.email_addresses?.find(
              (e: { id: string }) => e.id === data.primary_email_address_id
            )?.email_address || data.email_addresses?.[0]?.email_address || "",
          name: [data.first_name, data.last_name].filter(Boolean).join(" ") || "User",
          avatar: data.image_url || "",
          plan: "free" as const,
          githubConnected: data.external_accounts?.some(
            (a: { provider: string }) => a.provider === "oauth_github"
          ) ?? false,
          updatedAt: new Date().toISOString(),
        };

        await db.collection("users").updateOne(
          { clerkId: data.id },
          {
            $set: user,
            $setOnInsert: {
              plan: "free",
              onboardingCompleted: false,
              createdAt: new Date().toISOString(),
            },
          },
          { upsert: true }
        );

        console.log(
          `[Clerk Webhook] ${type}: ${user.email} (${data.id})`
        );
        break;
      }

      case "user.deleted": {
        await db.collection("users").deleteOne({ clerkId: data.id });
        console.log(`[Clerk Webhook] user.deleted: ${data.id}`);
        break;
      }

      default:
        console.log(`[Clerk Webhook] Unhandled event: ${type}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Clerk Webhook] Error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
