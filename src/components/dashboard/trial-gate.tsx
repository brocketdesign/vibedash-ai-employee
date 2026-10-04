"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { usePlan } from "@/lib/hooks";
import { useIsDemo } from "@/lib/demo-context";
import {
  Crown,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Lock,
  Loader2,
  Sparkles,
  Zap,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

async function startCheckout(): Promise<void> {
  const res = await fetch("/api/stripe/checkout", { method: "POST" });
  if (!res.ok) throw new Error("Failed to create checkout session");
  const { url } = await res.json();
  window.location.href = url;
}

// ─── Hero dashboard illustration (Modal 1) ────────────────────────────────

function HeroDashboard() {
  const bars = [35, 55, 42, 70, 50, 85, 62, 95, 78, 100];

  return (
    <div className="relative h-52 overflow-hidden bg-gradient-to-br from-[#1a0533] via-[#150b2e] to-[#0d0721]">
      {/* Dot grid */}
      <div
        className="absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(167,139,250,0.7) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Glow orbs */}
      <div className="absolute -left-20 -top-20 h-56 w-56 rounded-full bg-violet-700/25 blur-3xl" />
      <div className="absolute -bottom-20 right-0 h-56 w-56 rounded-full bg-indigo-700/25 blur-3xl" />
      <div className="absolute right-24 top-4 h-24 w-24 rounded-full bg-pink-600/15 blur-2xl" />

      {/* Left column: metric cards */}
      <div className="absolute left-5 top-5 space-y-2">
        <div className="w-[112px] rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2 backdrop-blur-sm">
          <p className="text-[9px] uppercase tracking-wider text-white/45">Revenue</p>
          <p className="text-base font-bold leading-tight text-white">$12,450</p>
          <p className="text-[9px] text-emerald-400">↑ 23% this month</p>
        </div>
        <div className="w-[112px] rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2 backdrop-blur-sm">
          <p className="text-[9px] uppercase tracking-wider text-white/45">Projects</p>
          <p className="text-base font-bold leading-tight text-white">8 Active</p>
          <p className="text-[9px] text-violet-400">● All on track</p>
        </div>
        <div className="w-[112px] rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2 backdrop-blur-sm">
          <p className="text-[9px] uppercase tracking-wider text-white/45">Visitors</p>
          <p className="text-base font-bold leading-tight text-white">48,200</p>
          <p className="text-[9px] text-sky-400">↑ 12% vs last wk</p>
        </div>
      </div>

      {/* Crown icon — centered */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="relative">
          <div className="absolute inset-0 scale-[2.5] rounded-full bg-amber-500/20 blur-2xl" />
          <div className="relative flex h-[60px] w-[60px] items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shadow-xl shadow-amber-600/40">
            <Crown className="h-7 w-7 text-white" />
          </div>
        </div>
      </div>

      {/* Bar chart — bottom right */}
      <div className="absolute bottom-4 right-5 flex items-end gap-[3px]">
        {bars.map((h, i) => (
          <div
            key={i}
            className="w-[10px] rounded-t-sm"
            style={{
              height: `${h * 0.44}px`,
              background: `linear-gradient(to top, rgba(139,92,246,${0.28 + i * 0.06}), rgba(99,102,241,0.9))`,
            }}
          />
        ))}
      </div>

      {/* "Pro Access" pill — top right */}
      <div className="absolute right-5 top-5 flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-1">
        <Sparkles className="h-3 w-3 text-amber-400" />
        <span className="text-[10px] font-semibold text-amber-300">Pro Access</span>
      </div>

      {/* Sparkle dots */}
      <div className="absolute right-6 top-14 h-1.5 w-1.5 animate-pulse rounded-full bg-violet-400" />
      <div className="absolute right-16 top-24 h-1 w-1 rounded-full bg-indigo-300/70" />
      <div className="absolute bottom-10 left-[152px] h-1.5 w-1.5 animate-pulse rounded-full bg-pink-400" />
      <div className="absolute left-[158px] top-8 h-[5px] w-[5px] rounded-full bg-white/30" />
    </div>
  );
}

// ─── Shared CTA button that hits the Stripe API ─────────────────────────

function CheckoutButton({ label, className }: { label: string; className?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleClick = async () => {
    setLoading(true);
    setError("");
    try {
      await startCheckout();
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <Button
        onClick={handleClick}
        disabled={loading}
        className={cn(
          "w-full rounded-xl py-6 text-base font-semibold text-white",
          className
        )}
      >
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <ArrowRight className="mr-2 h-4 w-4" />
        )}
        {loading ? "Redirecting to Stripe…" : label}
      </Button>
      {error && (
        <p className="mt-2 text-center text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}

// ─── Modal 1 — Unlock the platform ───────────────────────────────────────

function Modal1({ onDismiss }: { onDismiss: () => void }) {
  const features = [
    "Unlimited projects — no artificial limits",
    "AI Advisor with real-time code & strategy insights",
    "Advanced analytics, pipeline & revenue tracking",
    "GitHub sync, marketing hub & custom domains",
  ];

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" />

      {/* Card */}
      <div className="animate-in fade-in zoom-in-95 relative z-10 w-full max-w-lg overflow-hidden rounded-2xl shadow-2xl shadow-violet-950/60 ring-1 ring-white/10 duration-300">
        {/* Hero art */}
        <HeroDashboard />

        {/* Content */}
        <div className="bg-[#0b0715] px-8 pb-8 pt-6">
          {/* Urgency badge */}
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1">
            <Zap className="h-3 w-3 text-amber-400" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-300">
              Limited — won&apos;t be available later
            </span>
          </div>

          {/* Headline */}
          <h2 className="mb-2 text-2xl font-extrabold leading-tight text-white">
            Unlock Your Full{" "}
            <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
              Vibe Dashboard
            </span>
          </h2>

          <p className="mb-5 text-sm leading-relaxed text-white/60">
            Get unrestricted access to every feature with a{" "}
            <strong className="text-white/90">3-day free trial</strong>. No
            charge during the trial — cancel any time. After 3 days,
            auto-upgrades to Pro at $19/mo only if you stay.
          </p>

          {/* Feature list */}
          <ul className="mb-6 space-y-2">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-white/75">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                {f}
              </li>
            ))}
          </ul>

          {/* Primary CTA */}
          <CheckoutButton
            label="Start 3-Day Free Trial"
            className="bg-gradient-to-r from-violet-600 to-indigo-600 shadow-lg shadow-violet-600/30 hover:from-violet-500 hover:to-indigo-500"
          />

          {/* Soft dismiss */}
          <button
            onClick={onDismiss}
            className="mt-3 w-full text-center text-xs text-white/30 transition-colors hover:text-white/50"
          >
            Maybe later — I&apos;ll check it out later →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal 2 — Last chance ────────────────────────────────────────────────

function Modal2({ onDismiss }: { onDismiss: () => void }) {
  const reassurances = [
    { icon: Shield, label: "No charge for 3 days", color: "text-emerald-400" },
    { icon: CheckCircle2, label: "Cancel any time — zero commitment", color: "text-emerald-400" },
    { icon: Crown, label: "Full Pro access from day one", color: "text-amber-400" },
  ] as const;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
      {/* Backdrop — deeper than modal 1 */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" />

      {/* Card */}
      <div className="animate-in fade-in zoom-in-95 relative z-10 w-full max-w-md overflow-hidden rounded-2xl shadow-2xl duration-300">
        {/* Urgent header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-red-950 via-orange-950 to-amber-950 px-8 pb-6 pt-8">
          <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-red-600/20 blur-3xl" />
          <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-amber-600/20 blur-2xl" />

          <div className="relative">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/20 ring-1 ring-red-500/30">
              <AlertTriangle className="h-7 w-7 text-red-400" />
            </div>

            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-red-400">
                Last Chance
              </span>
            </div>

            <h2 className="mt-1 text-2xl font-extrabold text-white">
              You&apos;re about to lose access
            </h2>
            <p className="mt-1.5 text-sm text-white/60">
              This is the last time you can activate the 3-day free trial.
              Once you leave this screen, the offer is gone.
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="bg-[#0b0715] px-8 py-6">
          <p className="mb-5 text-sm leading-relaxed text-white/70">
            It&apos;s{" "}
            <strong className="text-white">completely free for 3 days</strong> —
            no charge whatsoever. Cancel before the trial ends and you won&apos;t
            pay a single cent.
          </p>

          {/* Reassurances */}
          <div className="mb-6 space-y-2">
            {reassurances.map(({ icon: Icon, label, color }) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.04] px-4 py-2.5"
              >
                <Icon className={cn("h-4 w-4 shrink-0", color)} />
                <span className="text-sm text-white/80">{label}</span>
              </div>
            ))}
          </div>

          {/* Primary CTA */}
          <CheckoutButton
            label="Yes, Give Me Access Now"
            className="bg-gradient-to-r from-red-600 to-orange-600 shadow-lg shadow-red-600/30 hover:from-red-500 hover:to-orange-500"
          />

          {/* Hard dismiss */}
          <button
            onClick={onDismiss}
            className="mt-3 w-full text-center text-xs text-white/25 transition-colors hover:text-white/40"
          >
            No thanks, I prefer restricted access
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Restricted access banner ─────────────────────────────────────────────

function RestrictedBanner({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 sm:flex-row sm:items-center">
      <Lock className="h-4 w-4 shrink-0 text-amber-400" />
      <p className="flex-1 text-sm text-amber-200/80">
        <strong className="text-amber-300">Restricted access.</strong> Start
        your free trial to unlock projects, AI Advisor, analytics, and all Pro
        features.
      </p>
      <Button
        onClick={onRetry}
        size="sm"
        className="shrink-0 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white"
      >
        Activate Free Trial
      </Button>
    </div>
  );
}

// ─── Gate wrapper (exported) ──────────────────────────────────────────────

type GateStep = "loading" | "modal1" | "modal2" | "gated" | "allowed";

export function TrialGate({ children }: { children: React.ReactNode }) {
  const { plan, loading } = usePlan();
  const isDemo = useIsDemo();
  const [step, setStep] = useState<GateStep>("loading");

  useEffect(() => {
    if (loading) return;

    // Demo users and paying/trial users bypass the gate
    if (isDemo || plan === "pro" || plan === "trial") {
      setStep("allowed");
      return;
    }

    // Free plan: check if they've already dismissed modal 2
    try {
      const saved = localStorage.getItem("vd_trial_gate");
      setStep(saved === "gated" ? "gated" : "modal1");
    } catch {
      setStep("modal1");
    }
  }, [plan, loading, isDemo]);

  const handleDismissModal1 = useCallback(() => setStep("modal2"), []);

  const handleDismissModal2 = useCallback(() => {
    try {
      localStorage.setItem("vd_trial_gate", "gated");
    } catch {
      // storage unavailable — still gate them for this session
    }
    setStep("gated");
  }, []);

  const handleRetry = useCallback(() => setStep("modal1"), []);

  // While loading, render children invisibly to avoid layout flash
  if (step === "loading") {
    return <div className="opacity-0 pointer-events-none">{children}</div>;
  }

  if (step === "allowed") {
    return <>{children}</>;
  }

  return (
    <>
      {step === "gated" && <RestrictedBanner onRetry={handleRetry} />}

      {/* Blur & disable interaction when gated */}
      <div
        className={cn(
          step === "gated" &&
            "pointer-events-none select-none blur-sm opacity-60"
        )}
      >
        {children}
      </div>

      {step === "modal1" && <Modal1 onDismiss={handleDismissModal1} />}
      {step === "modal2" && <Modal2 onDismiss={handleDismissModal2} />}
    </>
  );
}
