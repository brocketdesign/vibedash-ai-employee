import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  activateSubscription,
  findByStripeCustomer,
  setSubscriptionStatus,
} from "@/lib/employee/plan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe subscription lifecycle → the plan state the employee is metered
 * against. Signature verification is mandatory: this endpoint grants paid
 * capability, so an unsigned request must never reach the handlers below.
 */
export async function POST(request: NextRequest) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secretKey || !webhookSecret) {
    return NextResponse.json({ error: "Billing is not configured." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  const stripe = new Stripe(secretKey, { apiVersion: "2026-04-22.dahlia" });
  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (e) {
    console.error("[stripe] signature verification failed", e);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        const clerkId = session.metadata?.clerkId;
        if (!clerkId) break;

        await activateSubscription(clerkId, {
          stripeCustomerId: typeof session.customer === "string" ? session.customer : undefined,
          stripeSubscriptionId:
            typeof session.subscription === "string" ? session.subscription : undefined,
          companySeats: Number(session.metadata?.companySeats) || 1,
          extraCredits: Number(session.metadata?.extraCredits) || 0,
          firstMonth: true,
        });
        console.log(`[stripe] hired: ${clerkId}`);
        break;
      }

      case "invoice.paid": {
        // A renewal: refill credits and shifts for the new period.
        const invoice = event.data.object;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : null;
        if (!customerId) break;

        const subscription = await findByStripeCustomer(customerId);
        if (!subscription) break;

        // Skip the very first invoice — checkout.session.completed already
        // activated it with the first-month bonus credits.
        if (invoice.billing_reason === "subscription_create") break;

        await activateSubscription(subscription.userId, {
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscription.stripeSubscriptionId,
          companySeats: subscription.companySeats,
          firstMonth: false,
        });
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object;
        const customerId = typeof invoice.customer === "string" ? invoice.customer : null;
        if (!customerId) break;
        const subscription = await findByStripeCustomer(customerId);
        if (subscription) await setSubscriptionStatus(subscription.userId, "past_due");
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object;
        const customerId = typeof sub.customer === "string" ? sub.customer : null;
        if (!customerId) break;
        const subscription = await findByStripeCustomer(customerId);
        if (subscription) await setSubscriptionStatus(subscription.userId, "canceled");
        break;
      }

      default:
        break;
    }
  } catch (e) {
    // Return 200 anyway: a retry storm on a handler bug is worse than a missed
    // event, and every case above is idempotent when replayed manually.
    console.error(`[stripe] handler for ${event.type} failed`, e);
  }

  return NextResponse.json({ received: true });
}
