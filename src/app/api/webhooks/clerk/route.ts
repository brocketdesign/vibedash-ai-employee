import { NextRequest, NextResponse } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { connectToDatabase } from "@/lib/mongodb";

/**
 * POST /api/webhooks/clerk — keeps the `users` collection in step with Clerk.
 *
 * The night-shift cron has no request context, so it reads the founder's email
 * and name from this collection (lib/employee/users.ts) to send the morning
 * report. Every request is signature-checked with CLERK_WEBHOOK_SIGNING_SECRET
 * before anything is written; an unsigned or forged event is rejected.
 */
export async function POST(request: NextRequest) {
  let event;
  try {
    event = await verifyWebhook(request);
  } catch (error) {
    console.error("[Clerk Webhook] Signature verification failed:", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    const { db } = await connectToDatabase();

    switch (event.type) {
      case "user.created":
      case "user.updated": {
        const data = event.data;
        const email =
          data.email_addresses.find((e) => e.id === data.primary_email_address_id)
            ?.email_address ||
          data.email_addresses[0]?.email_address ||
          "";
        const name = [data.first_name, data.last_name].filter(Boolean).join(" ") || "User";

        await db.collection("users").updateOne(
          { clerkId: data.id },
          {
            $set: { clerkId: data.id, email, name, updatedAt: new Date().toISOString() },
            $setOnInsert: { createdAt: new Date().toISOString() },
          },
          { upsert: true },
        );
        break;
      }

      case "user.deleted": {
        if (event.data.id) {
          await db.collection("users").deleteOne({ clerkId: event.data.id });
        }
        break;
      }

      default:
        // Other event types are not subscribed to; acknowledge and ignore.
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[Clerk Webhook] Handler failed:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
