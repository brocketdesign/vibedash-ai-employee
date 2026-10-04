"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Top3Action, Top3ImpactTag, ProjectPhase } from "@/types";
import { cn } from "@/lib/utils";
import {
  Zap,
  Target,
  RefreshCw,
  CheckCircle2,
  Pin,
  PinOff,
  Loader2,
  Sparkles,
} from "lucide-react";

// ── Visual maps ──────────────────────────────────────────

const impactConfig: Record<
  Top3ImpactTag,
  { emoji: string; label: string; badgeClass: string; cardAccent: string }
> = {
  revenue: {
    emoji: "💰",
    label: "Revenue",
    badgeClass:
      "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    cardAccent: "border-l-emerald-500",
  },
  progress: {
    emoji: "⚡",
    label: "Progress",
    badgeClass:
      "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400",
    cardAccent: "border-l-blue-500",
  },
  unblock: {
    emoji: "🧱",
    label: "Unblock",
    badgeClass:
      "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    cardAccent: "border-l-amber-500",
  },
};

const phaseLabels: Record<ProjectPhase, string> = {
  idea: "💡 Idea",
  prototype: "🗂️ Prototype",
  "free-tier": "🆓 Free Tier",
  premium: "💎 Premium",
  deploy: "🌐 Deploy",
  live: "🚀 Live",
};

// ── Props ────────────────────────────────────────────────

interface TodaysTop3Props {
  actions: Top3Action[];
  loading: boolean;
  onRefresh: () => void;
  onMarkDone: (actionId: string) => void;
  onTogglePin: (actionId: string, pinned: boolean) => void;
  refreshing?: boolean;
}

// ── Component ────────────────────────────────────────────

export function TodaysTop3({
  actions,
  loading,
  onRefresh,
  onMarkDone,
  onTogglePin,
  refreshing = false,
}: TodaysTop3Props) {
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [pinningId, setPinningId] = useState<string | null>(null);

  const handleDone = async (id: string) => {
    setCompletingId(id);
    try {
      await onMarkDone(id);
    } finally {
      setCompletingId(null);
    }
  };

  const handlePin = async (id: string, pinned: boolean) => {
    setPinningId(id);
    try {
      await onTogglePin(id, pinned);
    } finally {
      setPinningId(null);
    }
  };

  if (loading) {
    return (
      <Card className="relative overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20">
              <Target className="h-4 w-4 text-amber-500" />
            </div>
            <CardTitle className="text-base font-semibold">
              Today&apos;s Top 3
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
            <span className="ml-2 text-sm text-muted-foreground">
              AI is analyzing your projects…
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (actions.length === 0) {
    return (
      <Card className="relative overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20">
                <Target className="h-4 w-4 text-amber-500" />
              </div>
              <CardTitle className="text-base font-semibold">
                Today&apos;s Top 3
              </CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-6">
            No actions yet. Add projects to get AI-powered priorities.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden">
      {/* Decorative gradient */}
      <div className="absolute right-0 top-0 h-32 w-32 translate-x-8 -translate-y-8 rounded-full bg-gradient-to-br from-amber-500/10 to-orange-500/10 blur-2xl" />

      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20">
              <Target className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">
                Today&apos;s Top 3
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Highest-impact actions for today
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="gap-1 border-amber-500/30 text-amber-500"
            >
              <Sparkles className="h-3 w-3" />
              AI
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onRefresh}
              disabled={refreshing}
              title="Regenerate today's actions"
            >
              <RefreshCw
                className={cn("h-4 w-4", refreshing && "animate-spin")}
              />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {actions.map((action, idx) => {
          const impact = impactConfig[action.impactTag];
          const isDone = !!action.completedAt;

          return (
            <div
              key={action.id}
              className={cn(
                "relative rounded-xl border border-l-4 p-4 transition-all",
                impact.cardAccent,
                isDone
                  ? "opacity-60 bg-muted/30"
                  : action.impactTag === "revenue"
                    ? "bg-emerald-500/5 hover:bg-emerald-500/10 shadow-sm"
                    : "hover:bg-accent/50",
              )}
            >
              {/* Top row: number + project + badges */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {idx + 1}
                  </span>
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">
                        {action.projectName}
                      </span>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {phaseLabels[action.pipelineStage] || action.pipelineStage}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn("text-[10px] px-1.5 py-0", impact.badgeClass)}
                      >
                        {impact.emoji} {impact.label}
                      </Badge>
                      {action.pinned && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-violet-500/30 text-violet-500">
                          📌 Pinned
                        </Badge>
                      )}
                    </div>

                    {/* Next step */}
                    <p
                      className={cn(
                        "text-sm",
                        isDone
                          ? "line-through text-muted-foreground"
                          : "text-foreground",
                      )}
                    >
                      {action.nextStep}
                    </p>

                    {/* Expected outcome */}
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Zap className="h-3 w-3" />
                      {action.expectedOutcome}
                    </p>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-3 flex items-center gap-2">
                {!isDone && (
                  <Button
                    size="sm"
                    variant={action.impactTag === "revenue" ? "default" : "outline"}
                    className={cn(
                      "h-7 gap-1.5 rounded-lg text-xs",
                      action.impactTag === "revenue" &&
                        "bg-emerald-600 hover:bg-emerald-700",
                    )}
                    disabled={completingId === action.id}
                    onClick={() => handleDone(action.id)}
                  >
                    {completingId === action.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3 w-3" />
                    )}
                    Mark as done
                  </Button>
                )}
                {isDone && (
                  <Badge className="gap-1 bg-green-500/10 text-green-600 border-green-500/30 text-xs">
                    <CheckCircle2 className="h-3 w-3" /> Done
                  </Badge>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 rounded-lg text-xs text-muted-foreground"
                  disabled={pinningId === action.id}
                  onClick={() => handlePin(action.id, !action.pinned)}
                >
                  {pinningId === action.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : action.pinned ? (
                    <PinOff className="h-3 w-3" />
                  ) : (
                    <Pin className="h-3 w-3" />
                  )}
                  {action.pinned ? "Unpin" : "Pin"}
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
