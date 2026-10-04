import Link from "next/link";
import { ScriptedTerminal } from "@/components/employee/terminal";
import { PLAN } from "@/lib/employee/plan-constants";
import { SUPPORT_EMAIL } from "@/lib/constants";

export const metadata = {
  title: "VibeDash — AI That Runs Your Company While You Sleep",
  description:
    "Hire an AI employee for $20/month. It works every night — research, build, ship, post, sell — and leaves a report in the morning.",
};

const SCRIPT = [
  "Reading your company profile...",
  "Planning tonight's shift...",
  "Chose: ship the pricing page — highest expected value",
  "Sandbox up. Building...",
  "Build passed checks. Deploying to your VPS...",
  `Live at your-company.${process.env.VPS_ROOT_DOMAIN || "example.com"}`,
  "Drafting a post about what shipped...",
  "Posted to X.",
  "Writing your morning report...",
  "Done. See you at breakfast.",
];

const SHIFT = [
  {
    n: "01",
    title: "It reads the business",
    body: "You give it one sentence. It writes the mission, names the buyer, and puts a real price on the offer — because a company with no price has nothing to sell.",
  },
  {
    n: "02",
    title: "It picks one thing",
    body: "One task per night, chosen against a single question: what makes money soonest? Nowhere to land beats no traffic. A checkout beats a blog post.",
  },
  {
    n: "03",
    title: "It actually does the work",
    body: "Code runs in an isolated sandbox and ships to your own server. Posts go to your X account. Emails go to a real list. Nothing is a mockup.",
  },
  {
    n: "04",
    title: "It reports honestly",
    body: "A note in your inbox by morning: what it did, what that is worth, what it needs from you. Including the nights it got nowhere.",
  },
];

const CAPABILITIES = [
  ["Research", "Segments, competitors, channels, prospect lists — each item with a next action."],
  ["Build & ship", "Landing pages, pricing pages, tools. Built in a sandbox, deployed to your VPS."],
  ["Content", "Landing copy that converts, articles that rank, launch posts that land."],
  ["Social", "Writes and publishes to X on your account, in your voice, on a schedule."],
  ["Cold outreach", "Personalised email to a real list. Capped, deduplicated, never invented."],
  ["Ads", "Campaign, creative and the CPA thresholds to kill or scale. It prepares; you fund."],
  ["Revenue", "Pricing, packaging, checkout, churn — the money you are already leaving behind."],
  ["Infrastructure", "Server, database, email, browser and sandbox. Included, already wired."],
];

export default function LandingPage() {
  return (
    <div className="employee min-h-screen">
      <ScriptedTerminal script={SCRIPT} rows={5} />

      <div className="border-b" style={{ background: "var(--accent)", borderColor: "var(--accent)" }}>
        <div className="mx-auto max-w-7xl px-4 py-2.5 text-center sm:px-6">
          <span className="mono text-[11px] uppercase tracking-[0.14em] text-white">
            ● Your employee starts work the night you hire it →
          </span>
        </div>
      </div>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <header className="relative">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-6 sm:px-6">
          <span className="display text-2xl">VibeDash</span>
          <Link href="/login" className="label underline underline-offset-4 hover:text-black">
            Sign in
          </Link>
        </nav>

        <div className="mx-auto max-w-4xl px-4 pb-24 pt-16 text-center sm:px-6 sm:pt-24">
          <h1 className="display text-[13vw] leading-[0.95] sm:text-7xl md:text-[5.5rem]">
            AI That Runs Your
            <br />
            Company While You Sleep
          </h1>

          <p className="mx-auto mt-8 max-w-xl text-lg leading-relaxed" style={{ color: "var(--muted-ink)" }}>
            Hire an employee for {formatUsd(PLAN.priceUsd)} a month. It works a shift every night —
            researching, building, shipping, posting, selling — and leaves a report on your desk by
            morning.
          </p>

          <div className="mt-12 flex flex-col items-center gap-4">
            <Link href="/new" className="btn btn-solid inline-block">
              Get started
            </Link>
            <span className="label">
              ${PLAN.perDayUsd.toFixed(2)}/day · Cancel anytime
            </span>
          </div>
        </div>
      </header>

      {/* ── The night shift ────────────────────────────────────────────── */}
      <section className="border-t rule">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <h2 className="label mb-12">What a night looks like</h2>
          <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-4" style={{ background: "var(--rule)" }}>
            {SHIFT.map((step) => (
              <div key={step.n} className="bg-white p-8">
                <span className="mono text-xs" style={{ color: "var(--accent)" }}>
                  {step.n}
                </span>
                <h3 className="display mt-4 text-2xl">{step.title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed" style={{ color: "var(--muted-ink)" }}>
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Capabilities ──────────────────────────────────────────────── */}
      <section className="border-t rule">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <h2 className="label mb-12">What it can actually do</h2>
          <dl className="grid gap-x-12 gap-y-10 md:grid-cols-2">
            {CAPABILITIES.map(([name, body]) => (
              <div key={name} className="border-t pt-5 rule">
                <dt className="display text-2xl">{name}</dt>
                <dd className="mt-2 text-[15px] leading-relaxed" style={{ color: "var(--muted-ink)" }}>
                  {body}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── Price ─────────────────────────────────────────────────────── */}
      <section className="border-t rule" id="pricing">
        <div className="mx-auto max-w-2xl px-4 py-24 sm:px-6">
          <div className="card p-10 text-center">
            <h2 className="display text-5xl">Hire Your AI Employee</h2>
            <p className="mt-3 text-lg" style={{ color: "var(--muted-ink)" }}>
              Works every night while you sleep.
            </p>

            <div className="mt-10 flex items-baseline justify-center gap-1">
              <span className="display text-7xl">${PLAN.priceUsd}</span>
              <span className="text-xl" style={{ color: "var(--muted-ink)" }}>
                /month
              </span>
            </div>
            <p className="label mt-2" style={{ color: "var(--accent)" }}>
              Cancel anytime
            </p>

            <ul className="mx-auto mt-10 max-w-sm space-y-3 text-left">
              {PLAN.features.map((feature) => (
                <li key={feature} className="flex gap-3 text-[15px]">
                  <span style={{ color: "var(--accent)" }}>✓</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <Link href="/new" className="btn btn-solid mt-10 inline-block w-full max-w-xs">
              Subscribe · ${PLAN.priceUsd}/mo
            </Link>
          </div>

          <p className="mt-8 text-center text-sm" style={{ color: "var(--muted-ink)" }}>
            Create your company first and look around. You only pay when you put it to work.
          </p>
        </div>
      </section>

      <footer className="border-t rule">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span className="display text-xl">VibeDash</span>
          <div className="label flex flex-wrap gap-6">
            <Link href="/terms" className="hover:text-black">Terms</Link>
            <Link href="/privacy" className="hover:text-black">Privacy</Link>
            <Link href="/workspace" className="hover:text-black">Project workspace</Link>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="hover:text-black">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function formatUsd(n: number): string {
  return `$${n}`;
}
