import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { auth } from "@clerk/nextjs/server";
import type { Db } from "mongodb";

const GROK_API_KEY =
  process.env.GROK_API_KEY || process.env.NEXT_PUBLIC_GROK_API_KEY || "";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export const runtime = "nodejs";

interface NextMoneyStepResponse {
  projectName: string;
  projectColor: string;
  currentPhase: string;
  action: string;
  reason: string;
  impact: string;
  urgency: "now" | "this-week" | "this-month";
  category: "monetize" | "grow" | "launch" | "build";
}

// Deterministic fallback when AI is unavailable
function computeFallback(projects: Record<string, unknown>[]): NextMoneyStepResponse | null {
  if (projects.length === 0) return null;

  const phaseOrder = ["idea", "prototype", "free-tier", "premium", "deploy", "live"];
  const active = projects.filter((p) => p.status === "active");
  if (active.length === 0) return null;

  const scored = active.map((p) => {
    const phase = p.currentPhase as string;
    const phaseIdx = phaseOrder.indexOf(phase);
    const revenue = (p.revenue as number) || 0;
    const progress = (p.phaseProgress as Record<string, number>) || {};
    const premium = progress.premium || 0;
    const deploy = progress.deploy || 0;
    const visitors = (p.monthlyVisitors as number) || 0;
    const priority = p.priority as string;

    let score = phaseIdx * 20;
    if (revenue > 0) score += 50;
    score += premium * 0.3;
    score += deploy * 0.2;
    if (priority === "critical") score += 15;
    if (priority === "high") score += 10;
    if (visitors > 0) score += Math.min(visitors / 100, 20);
    return { project: p, score, phaseIdx };
  });

  scored.sort((a, b) => b.score - a.score);
  const p = scored[0].project;
  const name = p.name as string;
  const color = (p.color as string) || "#8B5CF6";
  const phase = p.currentPhase as string;
  const revenue = (p.revenue as number) || 0;
  const visitors = (p.monthlyVisitors as number) || 0;
  const campaigns = (p.campaigns as unknown[]) || [];
  const progress = (p.phaseProgress as Record<string, number>) || {};

  if (revenue > 0 && phase === "live") {
    if (campaigns.length === 0) {
      return {
        projectName: name, projectColor: color, currentPhase: phase,
        action: "Launch a paid ad campaign to scale traffic",
        reason: `${name} is live and making $${revenue.toLocaleString()}/mo but has no active ad campaigns.`,
        impact: `Potential to 2-3x monthly visitors (currently ${visitors.toLocaleString()}) and revenue`,
        urgency: "this-week", category: "grow",
      };
    }
    return {
      projectName: name, projectColor: color, currentPhase: phase,
      action: "A/B test pricing or add an annual plan for higher LTV",
      reason: `${name} is generating $${revenue.toLocaleString()}/mo — optimizing pricing is the fastest way to grow.`,
      impact: "Annual plans typically boost revenue 20-30% with zero extra traffic",
      urgency: "this-week", category: "monetize",
    };
  }

  if (phase === "deploy" || (phase === "live" && revenue === 0)) {
    return {
      projectName: name, projectColor: color, currentPhase: phase,
      action: "Connect Stripe and enable payment collection",
      reason: `${name} is deployed but not collecting payments yet. Monetization is one step away.`,
      impact: "First dollar in — every day without payments is lost revenue",
      urgency: "now", category: "monetize",
    };
  }

  if (phase === "premium") {
    if ((progress.premium || 0) >= 70) {
      return {
        projectName: name, projectColor: color, currentPhase: phase,
        action: "Finish premium features and deploy to start charging",
        reason: `${name} is ${progress.premium}% through premium — you're almost there.`,
        impact: "Complete premium build to unlock recurring revenue",
        urgency: "now", category: "launch",
      };
    }
    return {
      projectName: name, projectColor: color, currentPhase: phase,
      action: "Implement Stripe billing and one premium feature",
      reason: `${name} needs premium features to generate revenue. Start with the highest-value one.`,
      impact: "A single premium feature + billing can unlock your first paying users",
      urgency: "this-week", category: "build",
    };
  }

  if (phase === "free-tier") {
    return {
      projectName: name, projectColor: color, currentPhase: phase,
      action: "Define and start building a premium tier",
      reason: `${name} has a free tier ready — now plan the paid features that users will pay for.`,
      impact: "Adding a paid tier is the bridge between free product and revenue",
      urgency: "this-week", category: "build",
    };
  }

  if (phase === "prototype") {
    return {
      projectName: name, projectColor: color, currentPhase: phase,
      action: "Ship an MVP and get it in front of users",
      reason: `${name} is still in prototyping. Shipping fast → feedback → revenue.`,
      impact: "Validated products reach revenue 3x faster than those stuck in building",
      urgency: "this-month", category: "build",
    };
  }

  return {
    projectName: name, projectColor: color, currentPhase: phase,
    action: "Validate the idea and start building a prototype",
    reason: `${name} is still in the idea stage — move to building to get closer to revenue.`,
    impact: "The sooner you validate, the sooner you can monetize",
    urgency: "this-month", category: "build",
  };
}

// Helper: generate a fresh step (AI or fallback) and persist to DB
async function generateAndCacheStep(
  userId: string,
  db: Db,
): Promise<{ step: NextMoneyStepResponse | null; source: string }> {
  const projects = await db
    .collection("projects")
    .find({ userId })
    .sort({ updatedAt: -1 })
    .toArray();

  if (projects.length === 0) {
    return { step: null, source: "none" };
  }

  const projectSummaries = projects.map((p) => ({
    id: p._id.toString(),
    name: p.name,
    description: p.description,
    currentPhase: p.currentPhase,
    status: p.status,
    priority: p.priority,
    revenue: p.revenue || 0,
    monthlyVisitors: p.monthlyVisitors || 0,
    adSpend: p.adSpend || 0,
    phaseProgress: p.phaseProgress || {},
    domain: p.domain,
    deploymentUrl: p.deploymentUrl,
    openIssues: p.openIssues || 0,
    color: p.color || "#8B5CF6",
    tasks: (p.tasks || []).map((t: Record<string, unknown>) => ({
      title: t.title,
      status: t.status,
      priority: t.priority,
      phase: t.phase,
    })),
    campaigns: (p.campaigns || []).map((c: Record<string, unknown>) => ({
      platform: c.platform,
      name: c.name,
      status: c.status,
      budget: c.budget,
      spent: c.spent,
      conversions: c.conversions,
    })),
  }));

  // If no AI key, use deterministic fallback
  if (!GROK_API_KEY) {
    const fallback = computeFallback(projects as unknown as Record<string, unknown>[]);
    if (fallback) {
      await db.collection("nextMoneyStepCache").updateOne(
        { userId },
        { $set: { userId, step: fallback, source: "fallback", markedDone: false, generatedAt: new Date() } },
        { upsert: true },
      );
    }
    return { step: fallback, source: "fallback" };
  }

  const totalRevenue = projects.reduce((a: number, p: Record<string, unknown>) => a + ((p.revenue as number) || 0), 0);
  const totalVisitors = projects.reduce((a: number, p: Record<string, unknown>) => a + ((p.monthlyVisitors as number) || 0), 0);

  const prompt = `You are a revenue-focused startup advisor. Analyze this user's project portfolio and determine the SINGLE most impactful next action they should take to move closer to generating (or growing) revenue.

## User's Projects
${JSON.stringify(projectSummaries, null, 2)}

## Aggregate Stats
- Total projects: ${projects.length}
- Total monthly revenue: $${totalRevenue}
- Total monthly visitors: ${totalVisitors}

## Your Task
Pick the ONE project and ONE specific action that will have the biggest impact on revenue. Be concrete and specific — reference the actual project name, real numbers, and real data.

## Response Format
Respond with ONLY a valid JSON object (no markdown, no code fences):
{
  "projectName": "<actual project name>",
  "projectColor": "<project color hex>",
  "currentPhase": "<project's current phase>",
  "action": "<specific action to take, 1 sentence, imperative>",
  "reason": "<why this is the #1 money move right now, 1-2 sentences, use real numbers>",
  "impact": "<expected impact, 1 sentence, specific>",
  "urgency": "now" | "this-week" | "this-month",
  "category": "monetize" | "grow" | "launch" | "build"
}

Rules:
- Pick the project that is CLOSEST to generating revenue or growing existing revenue
- "monetize" = start or optimize payments, "grow" = scale existing revenue, "launch" = ship/deploy, "build" = develop features
- Use "now" for actions that should happen today, "this-week" for within 7 days, "this-month" for within 30 days
- Be specific: mention dollar amounts, visitor counts, completion percentages from the real data
- Action should be one clear sentence starting with a verb`;

  let step: NextMoneyStepResponse | null = null;
  let source = "fallback";

  try {
    const grokResponse = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "grok-3-mini-fast",
        messages: [
          {
            role: "system",
            content: "You are a revenue-focused startup advisor. Respond with ONLY valid JSON. No markdown, no code fences, no extra text.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.5,
        max_tokens: 800,
      }),
    });

    if (!grokResponse.ok) {
      console.error("Grok API error for next-money-step:", grokResponse.status);
      step = computeFallback(projects as unknown as Record<string, unknown>[]);
    } else {
      const grokData = await grokResponse.json();
      const rawContent = grokData.choices?.[0]?.message?.content || "";

      try {
        let cleaned = rawContent.trim();
        if (cleaned.startsWith("```")) {
          cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
        }
        const parsed: NextMoneyStepResponse = JSON.parse(cleaned);

        if (!parsed.projectName || !parsed.action || !parsed.reason || !parsed.impact) {
          step = computeFallback(projects as unknown as Record<string, unknown>[]);
        } else {
          // Ensure valid enum values
          const validUrgencies = ["now", "this-week", "this-month"];
          const validCategories = ["monetize", "grow", "launch", "build"];
          if (!validUrgencies.includes(parsed.urgency)) parsed.urgency = "this-week";
          if (!validCategories.includes(parsed.category)) parsed.category = "build";
          step = parsed;
          source = "ai";
        }
      } catch {
        console.error("Failed to parse AI next-money-step:", rawContent);
        step = computeFallback(projects as unknown as Record<string, unknown>[]);
      }
    }
  } catch (aiErr) {
    console.error("AI call failed for next-money-step:", aiErr);
    step = computeFallback(projects as unknown as Record<string, unknown>[]);
  }

  // Persist to cache
  if (step) {
    await db.collection("nextMoneyStepCache").updateOne(
      { userId },
      { $set: { userId, step, source, markedDone: false, generatedAt: new Date() } },
      { upsert: true },
    );
  }

  return { step, source };
}

// POST /api/ai-advisor/next-money-step
// Body: { force?: boolean, markDone?: boolean }
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { force?: boolean; markDone?: boolean } = {};
    try {
      body = await req.json();
    } catch {
      // No body or invalid JSON — defaults are fine
    }

    const { db } = await connectToDatabase();

    // Handle "mark done" action — persist it so it survives refreshes
    if (body.markDone) {
      await db.collection("nextMoneyStepCache").updateOne(
        { userId },
        { $set: { markedDone: true, markedDoneAt: new Date() } },
      );
      return NextResponse.json({ success: true });
    }

    // Check for a valid cached step (< 24 hours old)
    if (!body.force) {
      const cached = await db.collection("nextMoneyStepCache").findOne({ userId });
      if (cached && cached.generatedAt) {
        const age = Date.now() - new Date(cached.generatedAt).getTime();
        if (age < CACHE_TTL_MS) {
          return NextResponse.json({
            step: cached.step,
            source: cached.source || "cached",
            markedDone: cached.markedDone || false,
            generatedAt: cached.generatedAt,
            cached: true,
          });
        }
      }
    }

    // Generate fresh step
    const { step, source } = await generateAndCacheStep(userId, db);

    if (!step) {
      return NextResponse.json({ step: null });
    }

    return NextResponse.json({ step, source, markedDone: false, cached: false });
  } catch (error) {
    console.error("Next money step error:", error);
    return NextResponse.json({ error: "Failed to compute next money step" }, { status: 500 });
  }
}
