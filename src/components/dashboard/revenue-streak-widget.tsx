"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useIsDemo } from "@/lib/demo-context";
import {
  Flame,
  Trophy,
  CheckCircle2,
  AlertCircle,
  Zap,
} from "lucide-react";
import { RevenueAction } from "@/types";

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActionAt: string | null;
  todayActions: RevenueAction[];
  doneToday: boolean;
}

const MILESTONES = [3, 7, 14, 30, 60, 100];
const MILESTONE_MESSAGES: Record<number, string> = {
  3: "3-day streak! You're building momentum 🚀",
  7: "1 week strong! Revenue habits forming 💪",
  14: "2 weeks! You're a revenue machine 🔥",
  30: "30-day streak! Legendary consistency 👑",
  60: "60 days! Unstoppable revenue warrior ⚡",
  100: "100 days! You've mastered the revenue game 🏆",
};

function getMilestoneMessage(streak: number): string | null {
  // Find the highest milestone at or below the current streak
  for (let i = MILESTONES.length - 1; i >= 0; i--) {
    if (streak === MILESTONES[i]) {
      return MILESTONE_MESSAGES[MILESTONES[i]];
    }
  }
  return null;
}

function getNextMilestone(streak: number): number | null {
  for (const m of MILESTONES) {
    if (m > streak) return m;
  }
  return null;
}

// Demo data
const DEMO_STREAK: StreakData = {
  currentStreak: 5,
  longestStreak: 12,
  lastActionAt: new Date().toISOString(),
  todayActions: [
    {
      id: "demo-1",
      type: "money-step",
      label: "A/B test pricing for VibeTracker",
      projectName: "VibeTracker",
      completedAt: new Date().toISOString(),
    },
  ],
  doneToday: true,
};

interface RevenueStreakWidgetProps {
  /** Called externally when a revenue action is recorded (to refresh data) */
  refreshTrigger?: number;
  onFilterRevenueTasks?: () => void;
}

export function RevenueStreakWidget({
  refreshTrigger,
  onFilterRevenueTasks,
}: RevenueStreakWidgetProps) {
  const isDemo = useIsDemo();
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true);
  const [streakBroken, setStreakBroken] = useState(false);
  const [showMilestone, setShowMilestone] = useState(false);

  const fetchStreak = useCallback(async () => {
    if (isDemo) {
      setStreak(DEMO_STREAK);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/ai-advisor/streak");
      if (res.ok) {
        const data = await res.json();
        setStreak((prev) => {
          // Detect streak broken (was > 0, now is 0, and user has history)
          if (prev && prev.currentStreak > 0 && data.currentStreak === 0 && data.longestStreak > 0) {
            setStreakBroken(true);
            setTimeout(() => setStreakBroken(false), 3000);
          }
          // Detect milestone reached
          if (data.currentStreak > 0 && MILESTONES.includes(data.currentStreak)) {
            if (!prev || prev.currentStreak !== data.currentStreak) {
              setShowMilestone(true);
              setTimeout(() => setShowMilestone(false), 5000);
            }
          }
          return data;
        });
      }
    } catch (err) {
      console.error("Failed to fetch streak:", err);
    } finally {
      setLoading(false);
    }
  }, [isDemo]);

  useEffect(() => {
    fetchStreak();
  }, [fetchStreak]);

  // Re-fetch when parent triggers a refresh
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      fetchStreak();
    }
  }, [refreshTrigger, fetchStreak]);

  if (loading) {
    return (
      <Card className="border-orange-500/20 bg-gradient-to-br from-orange-500/5 via-background to-red-500/5">
        <CardContent className="flex items-center justify-center py-6">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
        </CardContent>
      </Card>
    );
  }

  if (!streak) return null;

  const { currentStreak, longestStreak, doneToday, todayActions } = streak;
  const isActive = currentStreak > 0 && doneToday;
  const milestoneMsg = getMilestoneMessage(currentStreak);
  const nextMilestone = getNextMilestone(currentStreak);

  return (
    <Card
      className={cn(
        "relative overflow-hidden transition-all duration-500 cursor-pointer",
        streakBroken && "border-red-500/40 bg-red-500/5 animate-pulse",
        isActive && !streakBroken && "border-orange-500/30 bg-gradient-to-br from-orange-500/5 via-background to-amber-500/5",
        !isActive && !streakBroken && "border-muted bg-muted/30"
      )}
      onClick={onFilterRevenueTasks}
    >
      {/* Glow effect for active streak */}
      {isActive && !streakBroken && (
        <div className="pointer-events-none absolute -right-4 -top-4 h-24 w-24 rounded-full bg-gradient-to-br from-orange-500/20 to-amber-500/10 blur-2xl" />
      )}

      <CardContent className="p-4">
        {/* Streak broken flash */}
        {streakBroken && (
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs font-medium text-red-500">
            <AlertCircle className="h-3.5 w-3.5" />
            Streak broken — start a new one today!
          </div>
        )}

        {/* Milestone celebration */}
        {showMilestone && milestoneMsg && (
          <div className="mb-3 flex items-center gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-600 dark:text-amber-400">
            <Zap className="h-3.5 w-3.5" />
            {milestoneMsg}
          </div>
        )}

        <div className="flex items-center gap-4">
          {/* Fire icon + streak count */}
          <div className="flex flex-col items-center gap-0.5">
            <div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-xl transition-all",
                isActive
                  ? "bg-gradient-to-br from-orange-500 to-red-500 shadow-lg shadow-orange-500/30"
                  : "bg-muted"
              )}
            >
              <Flame
                className={cn(
                  "h-6 w-6",
                  isActive ? "text-white" : "text-muted-foreground"
                )}
              />
            </div>
          </div>

          {/* Main stats */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span
                className={cn(
                  "text-3xl font-bold tabular-nums",
                  isActive ? "text-orange-500" : "text-muted-foreground"
                )}
              >
                {currentStreak}
              </span>
              <span className="text-xs text-muted-foreground">
                day{currentStreak !== 1 ? "s" : ""} streak
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">
              Revenue Action Streak
            </p>
          </div>

          {/* Right side stats */}
          <div className="flex flex-col items-end gap-2">
            {/* Best streak */}
            <div className="flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-xs font-medium">{longestStreak}</span>
              <span className="text-[10px] text-muted-foreground">best</span>
            </div>

            {/* Done today indicator */}
            <Badge
              variant="outline"
              className={cn(
                "h-5 text-[9px] gap-1",
                doneToday
                  ? "border-green-500/30 text-green-500 bg-green-500/10"
                  : "border-muted text-muted-foreground"
              )}
            >
              {doneToday ? (
                <>
                  <CheckCircle2 className="h-3 w-3" />
                  Done today ({todayActions.length})
                </>
              ) : (
                <>
                  <AlertCircle className="h-3 w-3" />
                  Not yet today
                </>
              )}
            </Badge>
          </div>
        </div>

        {/* Progress to next milestone */}
        {nextMilestone && currentStreak > 0 && (
          <div className="mt-3 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">
                Next milestone: {nextMilestone} days
              </span>
              <span className="text-[10px] font-medium text-muted-foreground">
                {nextMilestone - currentStreak} to go
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-700",
                  isActive
                    ? "bg-gradient-to-r from-orange-500 to-amber-500"
                    : "bg-muted-foreground/30"
                )}
                style={{
                  width: `${Math.min(100, (currentStreak / nextMilestone) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
