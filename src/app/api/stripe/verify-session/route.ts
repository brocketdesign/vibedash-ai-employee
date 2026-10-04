import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { connectToDatabase } from "@/lib/mongodb";

// Constructed per request, not at import: the Stripe constructor throws without
// a key, which would fail the build rather than this one endpoint.
function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  return key ? new Stripe(key, { apiVersion: "2026-04-22.dahlia" }) : null;
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Billing is not configured on this deployment." },
      { status: 503 },
    );
  }

  const { sessionId } = await req.json();
  if (!sessionId || typeof sessionId !== "string") {
    return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  }

  // Retrieve the session from Stripe (expand subscription so we get trial dates)
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["subscription"],
  });

  // Verify the session belongs to this user's customer or metadata
  const sub = session.subscription as Stripe.Subscription | null;
  const sessionClerkId = sub?.metadata?.clerkId;

  if (
    session.status !== "complete" ||
    (sessionClerkId && sessionClerkId !== userId)
  ) {
    return NextResponse.json({ error: "Session not valid" }, { status: 400 });
  }

  // Derive trial end from subscription (most accurate) or fall back to +3 days
  const trialEndsAt =
    sub?.trial_end
      ? new Date(sub.trial_end * 1000).toISOString()
      : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

  const plan = sub?.status === "active" ? "pro" : "trial";

  const { db } = await connectToDatabase();
  await db.collection("users").updateOne(
    { clerkId: userId },
    {
      $set: {
        plan,
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id ?? null,
        trialStartedAt: sub?.trial_start
          ? new Date(sub.trial_start * 1000).toISOString()
          : new Date().toISOString(),
        trialEndsAt,
        updatedAt: new Date().toISOString(),
      },
    }
  );

  return NextResponse.json({ plan, trialEndsAt });
}
