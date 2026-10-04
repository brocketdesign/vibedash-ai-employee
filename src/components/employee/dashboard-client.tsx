"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Terminal } from "./terminal";
import { TasksPanel } from "./tasks";
import { ChatPanel } from "./chat";
import { SubscribeCard } from "./subscribe";
import {
  AdsPanel,
  BusinessPanel,
  DocumentsPanel,
  EmailPanel,
  Panel,
  SocialPanel,
  WebsitePanel,
  relative,
} from "./panels";
import type { DashboardData } from "./api-types";

/**
 * The company dashboard. Everything the employee has done, is doing, and
 * intends to do — on one screen, with the chat rail alongside it so the founder
 * can redirect the night without leaving the page.
 *
 * It polls rather than streams: a shift takes minutes, not milliseconds, and a
 * five-second poll is far more robust across serverless cold starts than a
 * long-lived connection.
 */
export function DashboardClient({
  slug,
  initial,
}: {
  slug: string;
  initial: DashboardData;
}) {
  const [data, setData] = useState<DashboardData>(initial);
  const [chatOpen, setChatOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/companies/${slug}`);
      if (res.ok) setData(await res.json());
    } catch {
      // A failed poll is not worth surfacing; the next one will pick it up.
    }
  }, [slug]);

  // Poll faster while something is actually running.
  const busy = running || data.tasks.some((t) => t.status === "running" || t.status === "verifying");
  useEffect(() => {
    const interval = setInterval(refresh, busy ? 4000 : 20000);
    return () => clearInterval(interval);
  }, [refresh, busy]);

  async function queue(request: string) {
    setNotice(null);
    try {
      const res = await fetch(`/api/companies/${slug}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request }),
      });
      const body = await res.json();
      if (!res.ok) setNotice(body.error || "Could not queue that.");
      else {
        setNotice("Queued. It runs on tonight's shift unless you run it now.");
        await refresh();
      }
    } catch {
      setNotice("Could not reach the server.");
    }
  }

  async function runShiftNow() {
    setRunning(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/companies/${slug}/shift`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) setNotice(body.error || "The shift could not run.");
      else setNotice(body.outcome?.summary || "Shift finished.");
      await refresh();
    } catch {
      setNotice("Could not reach the server.");
    } finally {
      setRunning(false);
    }
  }

  async function toggleAuto() {
    const next = !data.company.autoMode;
    setData((prev) => ({ ...prev, company: { ...prev.company, autoMode: next } }));
    await fetch(`/api/companies/${slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoMode: next }),
    });
    await refresh();
  }

  const { company, plan } = data;
  const ticker = data.activity.length
    ? data.activity.map((a) => ({ id: a.id, level: a.level, message: a.message }))
    : [{ message: "Standing by. Your employee starts at nightfall." }];

  return (
    <div className="employee min-h-screen">
      <Terminal lines={ticker} rows={5} typing={busy} />

      <header className="border-b rule">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div className="min-w-0">
            <Link href="/dashboard" className="label mb-1 block hover:text-black">
              ← All companies
            </Link>
            <h1 className="display truncate text-3xl">{company.name}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link href="/new" className="btn btn-sm">
              + New
            </Link>
            <button
              className="btn btn-sm lg:hidden"
              onClick={() => setChatOpen((v) => !v)}
              aria-expanded={chatOpen}
            >
              {chatOpen ? "Close chat" : "Ask"}
            </button>
          </div>
        </div>
      </header>

      {notice && (
        <div className="border-b px-4 py-3 sm:px-6 rule" style={{ background: "#fff7ed" }}>
          <p className="mono mx-auto max-w-[1600px] text-xs">{notice}</p>
        </div>
      )}

      <div className="mx-auto flex max-w-[1600px]">
        <main className="min-w-0 flex-1 px-4 py-8 sm:px-6">
          <div className="grid gap-x-10 lg:grid-cols-3">
            {/* ── Column 1: the employee itself ──────────────────────── */}
            <div>
              <Panel title="Status">
                <p className="display text-3xl">
                  {company.status === "live" ? "Live" : company.status === "paused" ? "Paused" : "Getting set up"}
                </p>
                <p className="mt-2 text-[15px] leading-relaxed" style={{ color: "var(--muted-ink)" }}>
                  {company.mission}
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <button
                    className={`btn btn-sm ${company.autoMode ? "btn-solid" : ""}`}
                    onClick={toggleAuto}
                    aria-pressed={company.autoMode}
                  >
                    Auto mode {company.autoMode ? "on" : "off"}
                  </button>
                  <button
                    className="btn btn-sm"
                    onClick={runShiftNow}
                    disabled={running || !plan.active}
                    title={plan.active ? "Uses one task credit" : "Hire your employee first"}
                  >
                    {running ? "Working…" : "Run tonight now"}
                  </button>
                </div>

                {!company.autoMode && (
                  <p className="label mt-3">
                    Auto mode is off — no night shifts will run.
                  </p>
                )}
              </Panel>

              <div className="mb-10">
                <SubscribeCard plan={plan} returnTo={`/dashboard/${slug}`} />
              </div>

              {data.lastShift?.report && (
                <Panel title="Last night">
                  <p className="label mb-3">
                    {data.lastShift.status} · {relative(data.lastShift.startedAt)}
                  </p>
                  <div className="space-y-3 text-[15px] leading-relaxed">
                    {data.lastShift.report.split(/\n{2,}/).slice(0, 4).map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </div>
                </Panel>
              )}

              <BusinessPanel data={data} />
            </div>

            {/* ── Column 2: the work ─────────────────────────────────── */}
            <div>
              <TasksPanel
                tasks={data.tasks}
                slug={slug}
                onRefresh={refresh}
                canRun={plan.active && plan.taskCredits > 0}
              />
              <DocumentsPanel documents={data.documents} />
              <WebsitePanel data={data} />
            </div>

            {/* ── Column 3: the channels ─────────────────────────────── */}
            <div>
              <SocialPanel data={data} slug={slug} onQueue={queue} />
              <EmailPanel data={data} onQueue={queue} />
              <AdsPanel onQueue={queue} />
            </div>
          </div>
        </main>

        <aside
          className={`w-full shrink-0 lg:block lg:w-[380px] ${chatOpen ? "block" : "hidden"}`}
          style={{ height: "calc(100vh - 1px)", position: "sticky", top: 0 }}
        >
          <ChatPanel slug={slug} companyName={company.name} onQueued={refresh} />
        </aside>
      </div>
    </div>
  );
}
