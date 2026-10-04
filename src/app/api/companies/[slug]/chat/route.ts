import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getCompanyBySlug } from "@/lib/employee/companies";
import { chatMessages, tasks } from "@/lib/employee/db";
import { complete, modelConfigured, REASONING_MODEL, type ChatMessage } from "@/lib/employee/model";
import { managerMenu, MANAGERS, managerAvailable, managerTools } from "@/lib/employee/managers";
import { companyBrief } from "@/lib/employee/managers/types";
import { createTask } from "@/lib/employee/runtime";
import { recordAiSpend } from "@/lib/employee/plan";
import type { TaskKind } from "@/lib/employee/types";

export const runtime = "nodejs";
export const maxDuration = 120;

type Params = { params: Promise<{ slug: string }> };

const SYSTEM = `You are the AI employee hired to run this company. You are talking to the founder — the person who pays you $20/month.

You are not a chatbot and not a consultant. You are the one who will actually do the work tonight, so speak like someone accountable for the outcome:

- Have an opinion. When the founder asks "what should I do", answer with one thing, not five options.
- Argue when they are wrong about their own business, and say why in terms of money.
- Never invent traction, customers, revenue or research findings. If you do not know, say what you would do to find out.
- When something is worth doing, queue it with a tool rather than describing it. Queue at most one or two tasks per reply — you only work one task per night.
- Keep replies short. Two or three paragraphs. The founder is on a phone.

Strategy and planning chat is unlimited on their plan; running tasks on demand costs a task credit, and the night shift is free. Say so when it is relevant, without upselling.`;

export async function GET(_request: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const company = await getCompanyBySlug(userId, slug);
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  const col = await chatMessages();
  const docs = await col
    .find({ companyId: company._id!.toString() })
    .sort({ createdAt: 1 })
    .limit(60)
    .toArray();

  return NextResponse.json({
    messages: docs.map((m) => ({
      id: m._id!.toString(),
      role: m.role,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { slug } = await params;
  const company = await getCompanyBySlug(userId, slug);
  if (!company) return NextResponse.json({ error: "Company not found" }, { status: 404 });

  if (!modelConfigured()) {
    return NextResponse.json(
      { error: "NOVITA_API_KEY is not configured — your employee cannot think yet." },
      { status: 503 },
    );
  }

  let body: { message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const message = (body.message || "").trim();
  if (!message) return NextResponse.json({ error: "Empty message" }, { status: 400 });

  const companyId = company._id!.toString();
  const chatCol = await chatMessages();
  const taskCol = await tasks();

  await chatCol.insertOne({
    companyId,
    userId,
    role: "user",
    content: message.slice(0, 8000),
    createdAt: new Date(),
  });

  const [history, recentTasks] = await Promise.all([
    chatCol.find({ companyId }).sort({ createdAt: -1 }).limit(20).toArray(),
    taskCol.find({ companyId }).sort({ createdAt: -1 }).limit(8).toArray(),
  ]);

  const context = `${companyBrief(company)}

## Recent work
${
  recentTasks.length
    ? recentTasks
        .map((t) => `- [${t.kind}] ${t.title} → ${t.status}${t.result?.summary ? `: ${t.result.summary.slice(0, 140)}` : ""}`)
        .join("\n")
    : "Nothing run yet."
}

## What I can do
${managerMenu()}`;

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM },
    { role: "system", content: context },
    ...history
      .reverse()
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
  ];

  try {
    const result = await complete({
      model: REASONING_MODEL,
      messages,
      tools: managerTools(),
      maxTokens: 1500,
      temperature: 0.7,
    });

    await recordAiSpend(userId, 0.01);

    // Any tool call the employee made becomes a real queued task.
    const queued: Array<{ id: string; title: string; kind: string }> = [];
    for (const call of result.toolCalls.slice(0, 2)) {
      const managerId = call.function.name.replace(/^queue_/, "");
      const manager = MANAGERS[managerId];
      if (!manager || !managerAvailable(manager)) continue;

      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {
        continue;
      }

      const { title, ...managerInput } = args as { title?: string } & Record<string, unknown>;
      const task = await createTask({
        company,
        title: String(title || manager.title),
        brief: message,
        kind: manager.kind as TaskKind,
        createdBy: "user",
        rationale: "Queued from your conversation.",
        managerInput,
      });
      queued.push({ id: task.taskId, title: task.title, kind: task.kind });
    }

    let reply = result.text;
    if (!reply && queued.length) {
      reply = `Queued: ${queued.map((q) => q.title).join(", ")}. It runs on tonight's shift unless you run it now.`;
    }
    if (!reply) reply = "I did not have anything useful to add to that.";

    await chatCol.insertOne({
      companyId,
      userId,
      role: "assistant",
      content: reply,
      createdAt: new Date(),
    });

    return NextResponse.json({ reply, queued });
  } catch (e) {
    console.error("[chat] failed", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "The employee could not reply." },
      { status: 502 },
    );
  }
}
