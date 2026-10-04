"use client";

import { useState } from "react";
import type { DashboardData, TaskView } from "./api-types";

/** Every panel on the dashboard shares this frame: a ruled heading, then content. */
export function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <div className="mb-4 flex items-baseline justify-between border-b pb-2 rule">
        <h2 className="display text-2xl">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-2 text-sm italic" style={{ color: "var(--muted-ink)" }}>
      {children}
    </p>
  );
}

// ─── Business ───────────────────────────────────────────────────────────────

export function BusinessPanel({ data }: { data: DashboardData }) {
  const { metrics } = data.company;
  const stripeReady = data.capabilities.stripe;

  return (
    <Panel title="Business">
      <dl className="space-y-1.5 text-[15px]">
        <Row label="Visitors" value={metrics.visitors.toLocaleString()} />
        <Row label="Signups" value={metrics.signups.toLocaleString()} />
        <Row label="Revenue" value={`$${metrics.revenue.toFixed(2)}`} mono />
        <Row label="MRR" value={`$${metrics.mrr.toFixed(2)}`} mono />
      </dl>
      <p className="label mt-3">
        Updated {relative(metrics.updatedAt)}
      </p>

      <div className="mt-6 border border-dashed p-5 text-center rule">
        <button className="btn btn-sm" disabled={!stripeReady}>
          Setup payments
        </button>
        <p className="label mt-3">
          {stripeReady
            ? "Enable Stripe to accept payments"
            : "Billing is not configured on this deployment"}
        </p>
      </div>
    </Panel>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt style={{ color: "var(--muted-ink)" }}>{label}:</dt>
      <dd className={mono ? "mono" : ""}>{value}</dd>
    </div>
  );
}

// ─── Documents ──────────────────────────────────────────────────────────────

export function DocumentsPanel({ documents }: { documents: DashboardData["documents"] }) {
  return (
    <Panel title="Documents">
      {documents.length === 0 ? (
        <Empty>Nothing written yet. Your employee files what it learns here.</Empty>
      ) : (
        <ul className="space-y-0">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-baseline justify-between border-b py-3 rule">
              <span className="truncate pr-4 text-[15px]">{doc.title}</span>
              <span className="label shrink-0">{relative(doc.updatedAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

// ─── Website ────────────────────────────────────────────────────────────────

export function WebsitePanel({ data }: { data: DashboardData }) {
  const { infra } = data.company;

  return (
    <Panel title="Website">
      {infra.siteUrl ? (
        <a
          href={infra.siteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mono block truncate text-sm underline underline-offset-4"
        >
          {infra.siteUrl}
        </a>
      ) : (
        <Empty>
          Nothing deployed yet.{" "}
          {data.capabilities.vps
            ? "Your employee will put a page up on its next build task."
            : "Hosting is not configured on this deployment."}
        </Empty>
      )}

      <p className="label mt-4">
        Hosting: {data.capabilities.vps ? infra.vpsStatus || "ready" : "not configured"} · Sandbox:{" "}
        {data.capabilities.sandbox ? "ready" : "not configured"}
      </p>
    </Panel>
  );
}

// ─── Social ─────────────────────────────────────────────────────────────────

export function SocialPanel({
  data,
  slug,
  onQueue,
}: {
  data: DashboardData;
  slug: string;
  onQueue: (request: string) => Promise<void>;
}) {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const posts = data.social;

  async function connect() {
    setError(null);
    setConnecting(true);
    try {
      const res = await fetch(`/api/companies/${slug}/social`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "connect", platform: "twitter" }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Could not start the connection.");
        return;
      }
      window.location.href = body.authUrl;
    } catch {
      setError("Could not reach the server.");
    } finally {
      setConnecting(false);
    }
  }

  return (
    <Panel title="X / Twitter">
      {posts.length === 0 ? (
        <Empty>
          {data.capabilities.zernio
            ? "No posts yet. Connect an account and your employee will post what it ships."
            : "Social posting is not configured on this deployment."}
        </Empty>
      ) : (
        <ul className="space-y-4">
          {posts.slice(0, 3).map((post) => (
            <li key={post.id} className="border-b pb-4 rule">
              {post.username && <p className="label mb-1">@{post.username}</p>}
              <p className="text-[15px] leading-snug">{post.content}</p>
              <p className="label mt-2">
                {post.status} · {relative(post.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          className="btn btn-sm"
          onClick={() => onQueue("Write and post an update to X about where the company is right now.")}
          disabled={!data.capabilities.zernio}
        >
          Auto-tweet
        </button>
        <button className="btn btn-sm" onClick={connect} disabled={connecting || !data.capabilities.zernio}>
          {connecting ? "Opening..." : "Connect account"}
        </button>
      </div>

      {error && (
        <p className="mono mt-3 text-xs" style={{ color: "#dc2626" }} role="alert">
          {error}
        </p>
      )}
    </Panel>
  );
}

// ─── Email ──────────────────────────────────────────────────────────────────

export function EmailPanel({
  data,
  onQueue,
}: {
  data: DashboardData;
  onQueue: (request: string) => Promise<void>;
}) {
  return (
    <Panel title="Email">
      <p className="label mb-3">
        {data.email.sent} sent · {data.email.replies} replied
      </p>

      {data.email.recent.length === 0 ? (
        <Empty>
          {data.capabilities.email
            ? "No outreach yet. Your employee needs a real prospect list before it will send anything."
            : "Email is not configured on this deployment."}
        </Empty>
      ) : (
        <ul className="space-y-0">
          {data.email.recent.slice(0, 4).map((row) => (
            <li key={row.id} className="border-b py-2.5 rule">
              <p className="truncate text-[15px]">→ {row.subject}</p>
              <p className="label mt-0.5 truncate">to: {row.to}</p>
            </li>
          ))}
        </ul>
      )}

      <button
        className="btn btn-sm mt-4"
        onClick={() =>
          onQueue(
            "Research a prospect list for cold outreach, then draft the campaign. Do not send to invented addresses.",
          )
        }
        disabled={!data.capabilities.email}
      >
        Cold outreach
      </button>
    </Panel>
  );
}

// ─── Ads ────────────────────────────────────────────────────────────────────

export function AdsPanel({ onQueue }: { onQueue: (request: string) => Promise<void> }) {
  return (
    <Panel title="Ads">
      <Empty>
        No campaign yet. Your employee prepares the campaign — creative, targeting, and the CPA to
        kill it at — and leaves the funding to you.
      </Empty>
      <button
        className="btn btn-sm mt-4"
        onClick={() =>
          onQueue("Plan a paid acquisition campaign for the landing page, with kill and scale criteria.")
        }
      >
        Run ads
      </button>
    </Panel>
  );
}

// ─── Shared helpers ─────────────────────────────────────────────────────────

export function relative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return `${Math.max(0, seconds)}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function kindLabel(kind: TaskView["kind"]): string {
  return kind.toUpperCase();
}
