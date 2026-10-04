import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { auth } from "@clerk/nextjs/server";

const GROK_API_KEY =
  process.env.GROK_API_KEY || process.env.NEXT_PUBLIC_GROK_API_KEY || "";

export const runtime = "nodejs";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// POST /api/ai-advisor/chat — streaming chat with project context
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const messages: ChatMessage[] = body.messages || [];

    if (!messages.length) {
      return NextResponse.json(
        { error: "No messages provided" },
        { status: 400 }
      );
    }

    // Fetch user's projects for context
    const { db } = await connectToDatabase();
    const projects = await db
      .collection("projects")
      .find({ userId })
      .sort({ updatedAt: -1 })
      .toArray();

    // Build a concise project context summary
    const projectSummaries = projects.map((p) => ({
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

    // Fetch dashboard-level stats
    const totalProjects = projects.length;
    const activeProjects = projects.filter((p) => p.status === "active").length;
    const totalRevenue = projects.reduce((a, p) => a + (p.revenue || 0), 0);
    const totalAdSpend = projects.reduce((a, p) => a + (p.adSpend || 0), 0);

    const systemPrompt = `You are VibeDash AI Advisor — a smart, friendly, and knowledgeable project management assistant for indie hackers and vibe coders.

You have full context on the user's projects and dashboard. Use this data to give specific, actionable advice. Reference project names and real numbers. Be concise but thorough.

## User's Dashboard Summary
- Total projects: ${totalProjects}
- Active projects: ${activeProjects}
- Total revenue: $${totalRevenue}
- Total ad spend: $${totalAdSpend}

## User's Projects
${JSON.stringify(projectSummaries, null, 2)}

## VibeDash Pipeline Phases
1. 💡 idea — Planning, brainstorming, vibe lock
2. 🗂️ prototype — MVP build, basic UI
3. 🆓 free-tier — Core features, auth, user flows
4. 💎 premium — Payment integration, feature gating
5. 🌐 deploy — Production configs, CI/CD, hosting
6. 🚀 live — Analytics, marketing, user acquisition

## Guidelines
- Always reference the user's ACTUAL project data when relevant
- Give specific, actionable recommendations (not generic advice)
- If the user asks about priorities, look at project status, deadlines, and progress
- If asked about revenue or marketing, use their campaign and visitor data
- Be encouraging but honest about areas that need work
- Use markdown formatting for readability (bold, lists, etc.)
- Keep responses focused and practical — the user is a builder, not a reader
- If the user has no projects, suggest they create one and offer guidance on getting started`;

    // Build messages array for Grok
    const apiMessages = [
      { role: "system", content: systemPrompt },
      ...messages.map((m) => ({ role: m.role, content: m.content })),
    ];

    // Call Grok 4 with streaming
    const grokResponse = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "grok-4",
        messages: apiMessages,
        temperature: 0.7,
        max_tokens: 2000,
        stream: true,
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

    // Stream the response back to the client
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        const reader = grokResponse.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || !trimmed.startsWith("data: ")) continue;

              const data = trimmed.slice(6);
              if (data === "[DONE]") {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                continue;
              }

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
                  );
                }
              } catch {
                // Skip malformed chunks
              }
            }
          }
        } catch (err) {
          console.error("Stream error:", err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("AI Advisor chat error:", error);
    return NextResponse.json(
      { error: "Failed to process chat request" },
      { status: 500 }
    );
  }
}
