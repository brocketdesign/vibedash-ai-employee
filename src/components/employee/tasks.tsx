"use client";

import { useState } from "react";
import { Panel, Empty, kindLabel, relative } from "./panels";
import type { TaskView } from "./api-types";

/**
 * The backlog. The employee only runs one task a night, so the ordering here is
 * the product: whichever card carries TONIGHT is what actually happens.
 */
export function TasksPanel({
  tasks,
  slug,
  onRefresh,
  canRun,
}: {
  tasks: TaskView[];
  slug: string;
  onRefresh: () => Promise<void>;
  canRun: boolean;
}) {
  const [composing, setComposing] = useState(false);
  const [request, setRequest] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const queued = tasks.filter((t) => t.status === "queued" || t.status === "running");
  const finished = tasks.filter((t) => ["done", "failed", "blocked"].includes(t.status));

  async function addTask(event: React.FormEvent) {
    event.preventDefault();
    const text = request.trim();
    if (text.length < 5) return;

    setBusy("new");
    setError(null);
    try {
      const res = await fetch(`/api/companies/${slug}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request: text }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Could not queue that.");
        return;
      }
      setRequest("");
      setComposing(false);
      await onRefresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(null);
    }
  }

  async function autoPlan() {
    setBusy("plan");
    setError(null);
    try {
      const res = await fetch(`/api/companies/${slug}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoPlan: true }),
      });
      const body = await res.json();
      if (!res.ok) setError(body.error || "Could not plan.");
      else await onRefresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(null);
    }
  }

  async function runNow(taskId: string) {
    setBusy(taskId);
    setError(null);
    try {
      const res = await fetch(`/api/companies/${slug}/tasks/${taskId}`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) setError(body.error || "The task could not run.");
      await onRefresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(null);
    }
  }

  async function setTonight(taskId: string, tonight: boolean) {
    setBusy(taskId);
    try {
      await fetch(`/api/companies/${slug}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tonight }),
      });
      await onRefresh();
    } finally {
      setBusy(null);
    }
  }

  async function remove(taskId: string) {
    setBusy(taskId);
    try {
      await fetch(`/api/companies/${slug}/tasks/${taskId}`, { method: "DELETE" });
      await onRefresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <Panel
      title="Tasks"
      action={
        <button
          className="label underline underline-offset-4 hover:text-black"
          onClick={autoPlan}
          disabled={busy === "plan"}
        >
          {busy === "plan" ? "Planning..." : "Let it plan"}
        </button>
      }
    >
      {queued.length === 0 && finished.length === 0 ? (
        <Empty>No tasks yet. Ask your employee to plan, or tell it what you want done.</Empty>
      ) : null}

      <ul className="space-y-3">
        {queued.map((task) => (
          <li key={task.id} className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-[17px] leading-snug">{task.title}</h3>
              {task.moneyScore > 0 && (
                <span className="label shrink-0" title="Expected revenue impact">
                  {task.moneyScore}
                </span>
              )}
            </div>

            {task.rationale && (
              <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--muted-ink)" }}>
                {task.rationale}
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="label border px-2 py-1 rule">{kindLabel(task.kind)}</span>
              {task.tonight && (
                <span
                  className="label border px-2 py-1"
                  style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
                >
                  Tonight
                </span>
              )}
              {task.status === "running" && <span className="label">Running…</span>}

              <span className="flex-1" />

              {task.status === "queued" && (
                <>
                  <button
                    className="btn btn-sm"
                    onClick={() => setTonight(task.id, !task.tonight)}
                    disabled={busy === task.id}
                  >
                    {task.tonight ? "Unpin" : "Tonight"}
                  </button>
                  <button
                    className="btn btn-sm"
                    onClick={() => runNow(task.id)}
                    disabled={busy === task.id || !canRun}
                    title={canRun ? "Uses one task credit" : "Hire your employee to run tasks on demand"}
                  >
                    {busy === task.id ? "Running…" : "Run now"}
                  </button>
                  <button
                    className="btn btn-sm"
                    onClick={() => remove(task.id)}
                    disabled={busy === task.id}
                    aria-label={`Remove ${task.title}`}
                  >
                    ✕
                  </button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>

      {error && (
        <p className="mono mt-3 text-xs" style={{ color: "#dc2626" }} role="alert">
          {error}
        </p>
      )}

      {composing ? (
        <form onSubmit={addTask} className="mt-4">
          <textarea
            className="field resize-none"
            rows={3}
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            placeholder="Ship a pricing page with the $49 tier and a working checkout."
            maxLength={1000}
            autoFocus
          />
          <div className="mt-2 flex gap-2">
            <button className="btn btn-sm btn-solid" disabled={busy === "new" || request.trim().length < 5}>
              {busy === "new" ? "Queueing…" : "Queue it"}
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setComposing(false)}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button className="btn btn-sm mt-4" onClick={() => setComposing(true)}>
          + New task
        </button>
      )}

      {finished.length > 0 && (
        <div className="mt-10">
          <h3 className="label mb-3">Completed</h3>
          <ul className="space-y-3">
            {finished.slice(0, 6).map((task) => (
              <li key={task.id} className="border-b pb-3 rule">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[15px]">{task.title}</span>
                  <span
                    className="label shrink-0"
                    style={{ color: task.status === "done" ? undefined : "#dc2626" }}
                  >
                    {task.status} · {relative(task.completedAt || task.createdAt)}
                  </span>
                </div>
                {task.result?.summary && (
                  <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--muted-ink)" }}>
                    {task.result.summary}
                  </p>
                )}
                {task.error && (
                  <p className="mono mt-1.5 text-xs" style={{ color: "#dc2626" }}>
                    {task.error}
                  </p>
                )}
                {task.result?.artifacts?.map((artifact, i) =>
                  artifact.url ? (
                    <a
                      key={i}
                      href={artifact.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="label mt-1 block underline underline-offset-4"
                    >
                      {artifact.label} ↗
                    </a>
                  ) : null,
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}
