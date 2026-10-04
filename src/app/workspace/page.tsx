"use client";

import { useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { StatsCard } from "@/components/dashboard/stats-card";
import { ProjectCard } from "@/components/dashboard/project-card";
import { PhasePipeline } from "@/components/dashboard/phase-pipeline";
import { AIInsightsCard } from "@/components/dashboard/ai-insights-card";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { PhaseDistribution } from "@/components/dashboard/phase-distribution";
import { UpcomingTasks } from "@/components/dashboard/upcoming-tasks";
import { NewProjectDialog } from "@/components/dashboard/new-project-dialog";
import { TodaysTop3 } from "@/components/dashboard/todays-top3";
import { useProjects, useStats, useTop3Actions, usePlan } from "@/lib/hooks";
import { mockInsights } from "@/lib/mock-data";
import {
  FolderKanban,
  DollarSign,
  Eye,
  GitCommit,
  Loader2,
  Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { refetch: refetchPlan } = usePlan();
  const verifiedRef = useRef(false);

  // ── Stripe return: verify session and activate trial ──────────────────
  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (!sessionId || verifiedRef.current) return;
    verifiedRef.current = true;

    (async () => {
      try {
        await fetch("/api/stripe/verify-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        await refetchPlan();
      } catch {
        // silent — user can retry
      } finally {
        // Clean the URL so the session_id doesn't persist on refresh
        router.replace("/dashboard");
      }
    })();
  }, [searchParams, refetchPlan, router]);

  const { projects, loading, createProject, updateProject, refetch } = useProjects();
  const { stats, refetch: refetchStats } = useStats();
  const {
    actions: top3Actions,
    loading: top3Loading,
    refreshing: top3Refreshing,
    refresh: refreshTop3,
    markDone: markTop3Done,
    togglePin: toggleTop3Pin,
  } = useTop3Actions();

  const handleSeedData = async () => {
    try {
      await fetch("/api/seed", { method: "POST" });
      refetch();
    } catch (err) {
      console.error("Seed error:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">
            Welcome back, Vibe Coder 👋
          </h1>
          <p className="text-sm text-muted-foreground">
            Here&apos;s what&apos;s happening across your{" "}
            {stats?.totalProjects || projects.length} projects today.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {projects.length === 0 && (
            <Button
              variant="outline"
              className="gap-2 rounded-xl"
              onClick={handleSeedData}
            >
              <Database className="h-4 w-4" />
              Seed Demo Data
            </Button>
          )}
          <NewProjectDialog onProjectCreated={createProject} />
        </div>
      </div>

      {/* Today's Top 3 — AI-powered daily priority actions */}
      <TodaysTop3
        actions={top3Actions}
        loading={top3Loading}
        refreshing={top3Refreshing}
        onRefresh={refreshTop3}
        onMarkDone={markTop3Done}
        onTogglePin={toggleTop3Pin}
      />

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 min-w-0">
        <StatsCard
          title="Active Projects"
          value={stats?.activeProjects ?? projects.filter((p) => p.status === "active").length}
          change={`${projects.length} total`}
          changeType="positive"
          icon={FolderKanban}
          iconColor="text-violet-500"
        />
        <StatsCard
          title="Monthly Revenue"
          value={`$${(stats?.totalRevenue ?? projects.reduce((a, p) => a + (p.revenue || 0), 0)).toLocaleString()}`}
          change="from all projects"
          changeType="positive"
          icon={DollarSign}
          iconColor="text-emerald-500"
        />
        <StatsCard
          title="Total Visitors"
          value={(stats?.totalVisitors ?? projects.reduce((a, p) => a + (p.monthlyVisitors || 0), 0)).toLocaleString()}
          change="monthly"
          changeType="positive"
          icon={Eye}
          iconColor="text-blue-500"
        />
        <StatsCard
          title="Total Commits"
          value={(stats?.totalCommits ?? projects.reduce((a, p) => a + (p.commits || 0), 0)).toLocaleString()}
          change="across all repos"
          changeType="neutral"
          icon={GitCommit}
          iconColor="text-orange-500"
        />
      </div>

      {/* Pipeline overview */}
      <div className="min-w-0">
        <PhasePipeline projects={projects} onUpdateDomain={async (id, domain) => { await updateProject(id, { domain }); }} />
      </div>

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-3 min-w-0">
        {/* Left column - Projects */}
        <div className="space-y-6 lg:col-span-2 min-w-0">
          <div>
            <h2 className="mb-4 text-lg font-semibold">Your Projects</h2>
            {projects.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 min-w-0">
                {projects.slice(0, 4).map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-12">
                <p className="text-sm text-muted-foreground">
                  No projects yet. Create one or seed demo data!
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right column - Insights & Activity */}
        <div className="space-y-6 min-w-0">
          <AIInsightsCard insights={mockInsights} />
          <UpcomingTasks projects={projects} />
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid gap-6 lg:grid-cols-2 min-w-0">
        <div className="min-w-0"><RecentActivity projects={projects} /></div>
        {stats && <div className="min-w-0"><PhaseDistribution stats={stats} onRefresh={refetchStats} /></div>}
      </div>
    </div>
  );
}
