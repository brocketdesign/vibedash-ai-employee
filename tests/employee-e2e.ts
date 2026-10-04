/**
 * End-to-end exercise of the night shift against a real MongoDB and a stub
 * Novita endpoint. Verifies the whole chain: create a company → plan a backlog
 * → run a shift → produce a verified task, a document, a ticker and a report.
 */
import { createServer } from "http";

const PORT = 8791;

/** Stub Novita: answers each prompt shape the employee actually sends. */
const server = createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const payload = JSON.parse(body || "{}");
    // Concatenate raw contents — stringifying escapes the quotes we match on.
    const prompt = (payload.messages || [])
      .map((m: { content?: string }) => m.content || "")
      .join("\n");
    let content: string;

    if (prompt.includes("Pick exactly ONE task for tonight")) {
      content = JSON.stringify({
        kind: "research",
        title: "Find the 10 segments most likely to pay",
        brief: "Name who actually pays and where to reach them.",
        moneyScore: 70,
        rationale: "You have no landing page and no buyer named. I cannot write copy for nobody.",
        input: { question: "Who pays for this and where do they gather?", deliverable: "segments", count: 10 },
      });
    } else if (prompt.includes("Propose the next")) {
      content = JSON.stringify({
        tasks: [
          { kind: "research", title: "Name the buyer", brief: "b", moneyScore: 70, rationale: "r", input: { question: "who pays?", deliverable: "segments" } },
          { kind: "content", title: "Write the landing copy", brief: "b", moneyScore: 80, rationale: "r", input: { mode: "landing", topic: "the offer" } },
          { kind: "revenue", title: "Set the price", brief: "b", moneyScore: 60, rationale: "r", input: { focus: "pricing" } },
        ],
      });
    } else if (prompt.includes('"mission":')) {
      content = JSON.stringify({
        mission: "Help freelancers get paid on time without chasing clients. Winning is $5k MRR.",
        offer: "Automatic invoice reminders sold as a monthly subscription.",
        audience: "Freelance designers and developers who invoice a handful of clients each month.",
        pricePoint: "$19/month",
        moneyPath: "Land 100 freelancers, convert 2% to a $19 plan.",
      });
    } else if (prompt.includes('{"ok": boolean')) {
      content = JSON.stringify({ ok: true, reason: "specific and actionable" });
    } else if (prompt.includes('"mrr": number')) {
      content = JSON.stringify({ mrr: 0, basis: "no traffic yet" });
    } else {
      // Long-form prose (research brief, morning report, copy).
      content =
        "## Segments\n\n" +
        Array.from({ length: 10 }, (_, i) =>
          `${i + 1}. Segment ${i + 1} — solo freelancers with recurring clients. Estimated reach 4,000. Next action: DM the top 20.`,
        ).join("\n") +
        "\n\n## What I would do next and why\n\nWrite the landing page for segment 1, because there is nowhere for them to land.";
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        choices: [{ message: { content, tool_calls: [] } }],
        usage: { prompt_tokens: 500, completion_tokens: 400 },
      }),
    );
  });
});

async function main() {
  await new Promise<void>((r) => server.listen(PORT, r));
  console.log(`stub model on :${PORT}\n`);

  // Env must be set before the modules that read it are imported.
  process.env.NOVITA_BASE_URL = `http://127.0.0.1:${PORT}`;
  process.env.NOVITA_API_KEY = "sk_stub";

  const { createCompany } = await import("@/lib/employee/companies");
  const { runNightShift } = await import("@/lib/employee/shift");
  const { activateSubscription, getPlanState } = await import("@/lib/employee/plan");
  const { queueBacklog } = await import("@/lib/employee/planner");
  const { companies, tasks, documents, activity, shifts } = await import("@/lib/employee/db");

  let pass = 0, fail = 0;
  const check = (name: string, cond: boolean, detail = "") => {
    if (cond) { pass++; console.log(`  ok   ${name}`); }
    else { fail++; console.log(`  FAIL ${name} ${detail}`); }
  };

  const userId = `user_test_${Date.now()}`;

  // Clean slate.
  const companyCol = await companies();
  await companyCol.deleteMany({ userId });

  console.log("— hire the employee —");
  await activateSubscription(userId, { companySeats: 1, firstMonth: true });
  const plan = await getPlanState(userId);
  check("subscription active", plan.active);
  check("30 night shifts granted", plan.nightShifts === 30, String(plan.nightShifts));
  check("15 credits in month one", plan.taskCredits === 15, String(plan.taskCredits));

  console.log("\n— create a company —");
  const company = await createCompany({
    userId,
    name: "Acme Invoicing",
    pitch: "A tool that sends freelancers' invoices and chases late payments automatically.",
    origin: "new",
  });
  check("slug generated", company.slug === "acme-invoicing", company.slug);
  check("mission drafted by the model", company.mission.includes("freelancers"), company.mission.slice(0, 50));
  check("price point set", company.pricePoint === "$19/month", company.pricePoint);
  check("auto mode on by default", company.autoMode);

  const companyId = company._id!.toString();
  const docCol = await documents();
  check("mission document filed", (await docCol.countDocuments({ companyId, kind: "mission" })) === 1);

  console.log("\n— plan a backlog —");
  const queued = await queueBacklog(company, 3);
  check("3 tasks queued", queued.length === 3, String(queued.length));
  check("exactly one flagged for tonight", queued.filter((t) => t.tonight).length === 1);
  check("tasks carry a rationale", queued.every((t) => t.rationale.length > 0));

  console.log("\n— run the night shift —");
  const outcome = await runNightShift(company);
  check("shift completed", outcome.status === "done", `${outcome.status}: ${outcome.summary}`);

  const taskCol = await tasks();
  const done = await taskCol.find({ companyId, status: "done" }).toArray();
  check("a task finished and verified", done.length === 1, `${done.length} done`);
  check("the task has a summary", Boolean(done[0]?.result?.summary));
  check("the task verified ok", done[0]?.verify?.ok === true);
  check("an artifact was produced", (done[0]?.result?.artifacts.length ?? 0) > 0);

  check("research document filed", (await docCol.countDocuments({ companyId, kind: "research" })) === 1);

  const actCol = await activity();
  const ticker = await actCol.find({ companyId }).sort({ createdAt: 1 }).toArray();
  check("ticker has lines", ticker.length >= 3, `${ticker.length} lines`);
  check("ticker recorded a success", ticker.some((a) => a.level === "success"));

  const shiftCol = await shifts();
  const shift = await shiftCol.findOne({ companyId }, { sort: { startedAt: -1 } });
  check("shift row written", shift?.status === "done", shift?.status);
  check("morning report written", (shift?.report?.length ?? 0) > 50, `${shift?.report?.length} chars`);

  console.log("\n— metering —");
  const after = await getPlanState(userId);
  check("one night shift consumed", after.nightShifts === 29, String(after.nightShifts));
  check("AI spend recorded", after.aiSpentUsd > 0, `$${after.aiSpentUsd.toFixed(4)}`);

  console.log("\n— knowledge accumulates —");
  const refreshed = await companyCol.findOne({ _id: company._id });
  check("outcome folded into knowledge", (refreshed?.knowledge?.length ?? 0) > 20, refreshed?.knowledge?.slice(0, 60));

  console.log("\n— backlog refilled for tomorrow —");
  const stillQueued = await taskCol.countDocuments({ companyId, status: "queued" });
  check("backlog topped back up", stillQueued >= 2, String(stillQueued));
  check("one task pinned for tomorrow", (await taskCol.countDocuments({ companyId, status: "queued", tonight: true })) === 1);

  console.log(`\n${pass} passed, ${fail} failed\n`);

  await companyCol.deleteMany({ userId });
  server.close();
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  server.close();
  process.exit(1);
});
