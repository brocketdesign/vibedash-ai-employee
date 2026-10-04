import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { connectToDatabase } from "@/lib/mongodb";
import { getAppUrl } from "@/lib/utils";
import { EXTRA_CREDIT_PACKS, PLAN } from "@/lib/employee/plan";

export const runtime = "nodejs";

/**
 * Checkout for the AI employee: $20/month for one company, plus optional extra
 * company seats and extra task credits. Everything is priced inline so there is
 * no Stripe dashboard configuration to keep in sync with the code.
 */
export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Billing is not configured on this deployment." },
      { status: 503 },
    );
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2026-04-22.dahlia",
  });

  let body: { extraCompanies?: number; extraCredits?: number; returnTo?: string } = {};
  try {
    body = await request.json();
  } catch {
    // An empty body is the common case: just the base plan.
  }

  const extraCompanies = Math.max(0, Math.min(20, Number(body.extraCompanies) || 0));
  const requestedCredits = Number(body.extraCredits) || 0;
  const creditPack =
    EXTRA_CREDIT_PACKS.find((p) => p.credits === requestedCredits) ?? EXTRA_CREDIT_PACKS[0];

  const { db } = await connectToDatabase();
  const user = await db
    .collection("users")
    .findOne({ clerkId: userId }, { projection: { email: 1, stripeCustomerId: 1 } });

  const baseUrl = getAppUrl();

  let customerId: string | undefined = user?.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user?.email || undefined,
      metadata: { clerkId: userId },
    });
    customerId = customer.id;
    await db
      .collection("users")
      .updateOne(
        { clerkId: userId },
        { $set: { stripeCustomerId: customerId, updatedAt: new Date().toISOString() } },
      );
  }

  // Derived from the SDK's own signature so it survives Stripe type reshuffles.
  type LineItem = NonNullable<
    NonNullable<Parameters<typeof stripe.checkout.sessions.create>[0]>["line_items"]
  >[number];

  const lineItems: LineItem[] = [
    {
      price_data: {
        currency: "usd",
        recurring: { interval: "month" },
        product_data: {
          name: "AI Employee",
          description: PLAN.features.join(" · "),
        },
        unit_amount: PLAN.priceUsd * 100,
      },
      quantity: 1,
    },
  ];

  if (extraCompanies > 0) {
    lineItems.push({
      price_data: {
        currency: "usd",
        recurring: { interval: "month" },
        product_data: {
          name: "Extra company",
          description: "One more company for your employee to run.",
        },
        unit_amount: PLAN.extraCompanyUsd * 100,
      },
      quantity: extraCompanies,
    });
  }

  if (creditPack.priceUsd > 0) {
    lineItems.push({
      price_data: {
        currency: "usd",
        recurring: { interval: "month" },
        product_data: {
          name: `${creditPack.credits} task credits`,
          description: "Instant or recurring tasks, on top of the nightly shift.",
        },
        unit_amount: creditPack.priceUsd * 100,
      },
      quantity: 1,
    });
  }

  const returnTo = typeof body.returnTo === "string" && body.returnTo.startsWith("/")
    ? body.returnTo
    : "/dashboard";

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: lineItems,
    subscription_data: {
      metadata: {
        clerkId: userId,
        companySeats: String(1 + extraCompanies),
        extraCredits: String(creditPack.credits - PLAN.taskCredits),
      },
    },
    metadata: {
      clerkId: userId,
      companySeats: String(1 + extraCompanies),
      extraCredits: String(creditPack.credits - PLAN.taskCredits),
    },
    success_url: `${baseUrl}${returnTo}?hired=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}${returnTo}?hired=0`,
    allow_promotion_codes: true,
  });

  return NextResponse.json({ url: session.url });
}
