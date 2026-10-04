"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Terminal } from "@/components/employee/terminal";
import { SUPPORT_EMAIL } from "@/lib/constants";

type Mode = "choose" | "new" | "existing";

/**
 * Hiring flow. Two doors, matching how founders actually arrive: with an idea,
 * or with something that already exists and is not growing. The employee needs
 * the same three facts either way, so the form is the same shape — only the
 * framing changes.
 */
export default function NewCompanyPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("choose");
  const [name, setName] = useState("");
  const [pitch, setPitch] = useState("");
  const [existingUrl, setExistingUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          pitch: pitch.trim(),
          origin: mode === "existing" ? "existing" : "new",
          existingUrl: existingUrl.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        setSubmitting(false);
        return;
      }
      router.push(`/dashboard/${data.company.slug}`);
    } catch {
      setError("Could not reach the server. Try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="employee min-h-screen">
      <Terminal
        lines={[
          { message: submitting ? "Writing your company profile..." : "Ready when you are." },
        ]}
        rows={5}
        typing
      />

      <nav className="border-b rule">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <Link href="/" className="display text-2xl">
            VibeDash
          </Link>
        </div>
      </nav>

      <main className="mx-auto max-w-2xl px-4 py-20 sm:px-6">
        {mode === "choose" ? (
          <>
            <h1 className="display text-6xl">Let&apos;s get started.</h1>

            <div className="mt-16 space-y-10">
              <div>
                <button
                  type="button"
                  onClick={() => setMode("new")}
                  className="btn btn-solid w-full"
                >
                  Create a new company
                </button>
                <p className="mt-3 text-center italic" style={{ color: "var(--muted-ink)" }}>
                  Start from scratch
                </p>
              </div>

              <div className="flex items-center gap-4">
                <span className="h-px flex-1" style={{ background: "var(--rule)" }} />
                <span className="label">or</span>
                <span className="h-px flex-1" style={{ background: "var(--rule)" }} />
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setMode("existing")}
                  className="btn btn-solid w-full"
                >
                  Grow my company
                </button>
                <p className="mt-3 text-center italic" style={{ color: "var(--muted-ink)" }}>
                  Already have a business
                </p>
              </div>
            </div>
          </>
        ) : (
          <form onSubmit={submit}>
            <button
              type="button"
              onClick={() => setMode("choose")}
              className="label mb-8 underline underline-offset-4"
            >
              ← Back
            </button>

            <h1 className="display text-5xl">
              {mode === "existing" ? "Tell me about the business." : "What are we building?"}
            </h1>
            <p className="mt-4 text-lg" style={{ color: "var(--muted-ink)" }}>
              {mode === "existing"
                ? "I will read this, name who actually pays you, and put tonight's shift against whatever is costing you the most money."
                : "One or two sentences is enough. I will turn it into a mission, an offer, an audience and a price before my first shift."}
            </p>

            <div className="mt-12 space-y-8">
              <div>
                <label htmlFor="name" className="label mb-2 block">
                  Company name
                </label>
                <input
                  id="name"
                  className="field"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Acme Invoicing"
                  maxLength={80}
                  required
                  autoFocus
                />
              </div>

              <div>
                <label htmlFor="pitch" className="label mb-2 block">
                  {mode === "existing" ? "What it does and where it is stuck" : "What it does"}
                </label>
                <textarea
                  id="pitch"
                  className="field resize-none"
                  rows={5}
                  value={pitch}
                  onChange={(e) => setPitch(e.target.value)}
                  placeholder={
                    mode === "existing"
                      ? "An invoicing tool for freelancers. A few dozen signups, almost nobody paying, and I cannot work out why the rest do not convert."
                      : "A tool that sends freelancers' invoices and chases late payments automatically."
                  }
                  maxLength={2000}
                  required
                />
                <p className="label mt-2">{pitch.length}/2000</p>
              </div>

              {mode === "existing" && (
                <div>
                  <label htmlFor="url" className="label mb-2 block">
                    Existing website (optional)
                  </label>
                  <input
                    id="url"
                    className="field"
                    type="url"
                    value={existingUrl}
                    onChange={(e) => setExistingUrl(e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              )}

              {error && (
                <p className="mono text-sm" style={{ color: "#dc2626" }} role="alert">
                  {error}
                </p>
              )}

              <button
                type="submit"
                className="btn btn-solid w-full"
                disabled={submitting || name.trim().length < 2 || pitch.trim().length < 10}
              >
                {submitting ? "Writing the profile..." : "Create company"}
              </button>

              <p className="text-center text-sm" style={{ color: "var(--muted-ink)" }}>
                Free to create. You hire the employee — $20/mo — when you want it to start work.
              </p>
            </div>
          </form>
        )}
      </main>

      <footer className="border-t rule">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="label flex flex-wrap gap-6">
            <Link href="/terms" className="hover:text-black">Terms</Link>
            <Link href="/privacy" className="hover:text-black">Privacy</Link>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-black">
              Support: {SUPPORT_EMAIL}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
