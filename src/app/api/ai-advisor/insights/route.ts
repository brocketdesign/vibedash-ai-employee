import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { auth } from "@clerk/nextjs/server";
import { AIInsight } from "@/types";

const GROK_API_KEY =
  process.env.GROK_API_KEY || process.env.NEXT_PUBLIC_GROK_API_KEY || "";

export const runtime = "nodejs";

// POST /api/ai-advisor/insights — Generate AI insights from user's projects
export async function POST() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!GROK_API_KEY) {
      return NextResponse.json(
        { error: "AI service not configured. Set GROK_API_KEY in environment variables." },
        { status: 503 }
      );
    }

    // Fetch user's projects for context
    const { db } = await connectToDatabase();
    const projects = await db
      .collection("projects")
      .find({ userId })
      .sort({ updatedAt: -1 })
      .toArray();

    if (projects.length === 0) {
      return NextResponse.json({
        insights: [],
        summary: {
          totalInsights: 0,
          highPriority: 0,
          mediumPriority: 0,
          lowPriority: 0,
          projectsAnalyzed: 0,
        },
      });
    }

    // Build project summaries for the AI
    const projectSummaries = projects.map((p) => ({
      id: p._id.toString(),
      name: p.name,
      description: p.description,
      currentPhase: p.currentPhase,
      status: p.status,
      priority: p.priority,
      techStack: p.techStack,
      githubRepo: p.githubRepo,
      domain: p.domain,
      deploymentUrl: p.deploymentUrl,
      openIssues: p.openIssues,
      stars: p.stars,
      commits: p.commits,
      revenue: p.revenue,
      monthlyVisitors: p.monthlyVisitors,
      adSpend: p.adSpend,
      phaseProgress: p.phaseProgress,
      lastCommit: p.lastCommit,
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
        impressions: c.impressions,
        clicks: c.clicks,
        conversions: c.conversions,
      })),
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    // Aggregate stats
    const totalRevenue = projects.reduce((a, p) => a + (p.revenue || 0), 0);
    const totalAdSpend = projects.reduce((a, p) => a + (p.adSpend || 0), 0);
    const totalVisitors = projects.reduce((a, p) => a + (p.monthlyVisitors || 0), 0);

    const prompt = `You are VibeDash AI Advisor. Analyze the user's projects and generate actionable insights.

## User's Projects
${JSON.stringify(projectSummaries, null, 2)}

## Aggregate Stats
- Total projects: ${projects.length}
- Total revenue: $${totalRevenue}/mo
- Total ad spend: $${totalAdSpend}/mo
- Total monthly visitors: ${totalVisitors}

## Your Task
Generate 4-8 specific, actionable insights based on the user's REAL project data. Each insight must reference a specific project by name and use real numbers from the data.

Insight types:
- "suggestion" — Actionable improvement recommendation
- "warning" — Something that needs attention or could go wrong
- "opportunity" — Growth or revenue opportunity
- "milestone" — Celebration of an achievement or progress

Priority levels: "high", "medium", "low"

## Response Format
Respond with ONLY a valid JSON array. No markdown, no code fences, no explanation. Each element:
{
  "projectId": "<project id from data>",
  "projectName": "<project name>",
  "type": "suggestion" | "warning" | "opportunity" | "milestone",
  "title": "<short title, max 60 chars>",
  "description": "<2-3 sentence explanation with specific numbers and advice>",
  "priority": "high" | "medium" | "low",
  "actionable": true | false,
  "action": "<short CTA text if actionable, e.g. 'Set up A/B test'>"
}

Rules:
- Reference ACTUAL project names and numbers
- Be specific, not generic 
- Include at least one warning if there are issues
- Include at least one opportunity
- If a project has high revenue, celebrate it as a milestone
- If a project has stalled progress, suggest next steps
- Consider marketing/campaign data when available`;

    const grokResponse = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "grok-4",
        messages: [
          {
            role: "system",
            content: "You are an expert project advisor. Respond with ONLY valid JSON arrays. No markdown, no code fences, no extra text.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 3000,
      }),
    });

    if (!grokResponse.ok) {
      const errorText = await grokResponse.text();
      console.error("Grok API error:", grokResponse.status, errorText);
      return NextResponse.json(
        { error: `AI service error: ${grokResponse.status}` },
        { status: 502 }
      );
    }

    const grokData = await grokResponse.json();
    const rawContent = grokData.choices?.[0]?.message?.content || "[]";

    // Parse the JSON response (handle potential markdown wrapping)
    let parsedInsights: Omit<AIInsight, "id" | "createdAt">[] = [];
    try {
      // Strip markdown code fences if present
      let cleaned = rawContent.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
      }
      parsedInsights = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("Failed to parse AI insights:", parseErr, rawContent);
      return NextResponse.json(
        { error: "Failed to parse AI response" },
        { status: 502 }
      );
    }

    // Add IDs and timestamps
    const now = new Date().toISOString();
    const insights: AIInsight[] = parsedInsights.map((insight, idx) => ({
      id: `ai-ins-${Date.now()}-${idx}`,
      projectId: insight.projectId || "",
      projectName: insight.projectName || "Unknown",
      type: insight.type || "suggestion",
      title: insight.title || "Insight",
      description: insight.description || "",
      priority: insight.priority || "medium",
      createdAt: now,
      actionable: insight.actionable ?? false,
      action: insight.action,
    }));

    // Compute summary
    const summary = {
      totalInsights: insights.length,
      highPriority: insights.filter((i) => i.priority === "high").length,
      mediumPriority: insights.filter((i) => i.priority === "medium").length,
      lowPriority: insights.filter((i) => i.priority === "low").length,
      projectsAnalyzed: projects.length,
      byType: {
        suggestion: insights.filter((i) => i.type === "suggestion").length,
        warning: insights.filter((i) => i.type === "warning").length,
        opportunity: insights.filter((i) => i.type === "opportunity").length,
        milestone: insights.filter((i) => i.type === "milestone").length,
      },
    };

    // Build analyzed projects list
    const analyzedProjects = projects.map((p) => ({
      id: p._id.toString(),
      name: p.name,
      color: p.color || "#8B5CF6",
      currentPhase: p.currentPhase,
      insightCount: insights.filter((i) => i.projectId === p._id.toString()).length,
    }));

    return NextResponse.json({
      insights,
      summary,
      analyzedProjects,
    });
  } catch (error) {
    console.error("AI Advisor insights error:", error);
    return NextResponse.json(
      { error: "Failed to generate insights" },
      { status: 500 }
    );
  }
}
