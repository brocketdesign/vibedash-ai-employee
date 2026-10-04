import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { connectToDatabase } from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import { UserDataViewConfig } from "@/types";

const GROK_API_KEY = process.env.GROK_API_KEY || process.env.NEXT_PUBLIC_GROK_API_KEY || "";

async function callAI(prompt: string): Promise<string> {
  if (!GROK_API_KEY) throw new Error("GROK_API_KEY is not configured");

  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROK_API_KEY}` },
    body: JSON.stringify({
      model: "grok-3-fast",
      messages: [
        { role: "system", content: "You are a data visualization expert. Respond with a single valid JSON object only. No markdown, no code fences, no explanation. The first character of your response must be '{' and the last must be '}'." },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 3000,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Grok API error: ${res.status} — ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

/**
 * Produces a compact structural summary of the payload so the AI understands
 * every available dataPath without receiving potentially huge arrays.
 * - Scalars (numbers, strings, booleans) are kept verbatim.
 * - Arrays are replaced with { _length: N, _itemShape: { ...firstItem } }.
 * - Nested objects are recursed.
 * - Strings longer than 80 chars are truncated.
 */
function summarizeStructure(
  value: unknown,
  depth = 0
): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return value.length > 80 ? value.slice(0, 77) + "…" : value;
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    const shape =
      value.length > 0 && typeof value[0] === "object" && value[0] !== null
        ? summarizeStructure(value[0], depth + 1)
        : value[0] ?? null;
    return { _length: value.length, _itemShape: shape };
  }
  if (typeof value === "object") {
    if (depth > 4) return "…";
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = summarizeStructure(v, depth + 1);
    }
    return out;
  }
  return value;
}

function buildPrompt(projectName: string, data: Record<string, unknown>): string {
  const structure = summarizeStructure(data);
  const sample = JSON.stringify(structure, null, 2).slice(0, 5000);
  return `You are a data visualization expert. You are building a dashboard for a project called "${projectName}".

Below is a structural summary of the JSON returned by the project's /api/vibedash/users endpoint.
Arrays are shown as { _length, _itemShape } — the actual data is NOT included here, but the dataPath you output will be applied against the real payload at render time.

${sample}

Your task: produce a single JSON dashboard configuration that turns ALL meaningful data in the payload above into a rich, multi-tab dashboard. Use tabs to group related data logically.

Output exactly one JSON object matching this schema (no markdown, no explanation):

{
  "title": "<descriptive dashboard title>",
  "description": "<one sentence describing what this dashboard shows>",
  "tabs": [
    {
      "title": "<tab label, e.g. Overview | Growth | Activity | Distribution | Users>",
      "description": "<optional one sentence about this tab>",
      "cards": [
        {
          "type": "stat",
          "label": "<human-readable label>",
          "dataPath": "<dot-notation path into the JSON, e.g. summary.totalUsers or metrics.totalImagesGenerated>",
          "icon": "<one of: users, crown, star, trending-up, bar-chart, zap, dollar>",
          "color": "<one of: blue, green, gold, violet, rose, orange>",
          "format": "<one of: number, percent, currency>"
        }
      ],
      "charts": [
        {
          "type": "<bar | line | pie>",
          "title": "<chart title>",
          "dataPath": "<path to an array in the JSON, e.g. charts.userGrowth>",
          "xKey": "<key for x-axis in each array item>",
          "yKey": "<key for y-axis in each array item>"
        }
      ],
      "tables": [
        {
          "type": "table",
          "title": "<table title>",
          "dataPath": "<path to an array in the JSON, e.g. users>",
          "columns": ["<key1>", "<key2>", "<key3>"]
        }
      ]
    }
  ],
  "cards": [],
  "charts": [],
  "tables": [],
  "generatedAt": "${new Date().toISOString()}"
}

Tab design rules — create tabs in this order when the data supports them:
1. **Overview** — Always include. Put ALL scalar metrics here as stat cards (summary.* and metrics.*). No charts or tables needed here.
2. **Growth** — Include if ANY time-series arrays exist (arrays where items have a date/day/week key and a count/value key). Use line charts.
3. **Activity** — Include if there are additional time-series arrays beyond userGrowth (e.g. imagesPerDay, ordersPerDay, messagesPerDay). Use bar or line charts.
4. **Distribution** — Include if ANY categorical arrays exist (arrays where items have a name/plan/category key and a count/value key). Use pie or bar charts.
5. **Users** — Include only if a "users" array exists at the top level with at least 2 columns. Use a table. Pick the most useful columns (max 6).
6. Add further tabs if the payload contains additional distinct data groups not covered above.

Additional rules:
- Only reference dataPath values that ACTUALLY EXIST in the JSON above. Do not invent paths.
- For Overview stat cards: create one card per scalar value in summary.* AND one card per scalar value in metrics.*. Do not skip any — every metric deserves a card.
- For charts: correctly identify whether an array is time-series (use "line") or categorical (use "bar" or "pie").
- Keep "cards", "charts", and "tables" at the top level as empty arrays (all content goes into tabs).
- Each tab's cards/charts/tables arrays may be empty — only include what the data supports.
- Respond with ONLY the JSON object, nothing else.`;
}

// POST /api/projects/[id]/user-data/generate-view
// Sends cached JSON to AI → generates ViewConfig → stores it
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    if (!ObjectId.isValid(id)) return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });

    const { db } = await connectToDatabase();

    const project = await db.collection("projects").findOne({ _id: new ObjectId(id), userId });
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });

    const connection = await db.collection("userDataConnections").findOne({ projectId: id, userId });
    if (!connection) return NextResponse.json({ error: "No user data connection" }, { status: 404 });
    if (!connection.cachedData) {
      return NextResponse.json(
        { error: "No cached data found. Click 'Fetch Data' first." },
        { status: 400 }
      );
    }

    const prompt = buildPrompt(project.name, connection.cachedData);
    const raw = await callAI(prompt);

    // Strip markdown code fences if AI wrapped in them
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    let viewConfig: UserDataViewConfig;
    try {
      viewConfig = JSON.parse(cleaned);
    } catch {
      console.error("AI returned non-JSON:", cleaned.slice(0, 500));
      return NextResponse.json(
        { error: "AI returned invalid JSON. Try again.", raw: cleaned.slice(0, 500) },
        { status: 500 }
      );
    }

    const now = new Date().toISOString();
    viewConfig.generatedAt = now;

    await db.collection("userDataConnections").updateOne(
      { projectId: id, userId },
      { $set: { viewConfig, viewGeneratedAt: now } }
    );

    return NextResponse.json({ success: true, viewConfig });
  } catch (error) {
    console.error("POST /api/projects/[id]/user-data/generate-view error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
