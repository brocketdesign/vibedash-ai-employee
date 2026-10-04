"use client";

import { useState, useMemo, useEffect } from "react";
import { ProjectCard } from "@/components/dashboard/project-card";
import { NewProjectDialog } from "@/components/dashboard/new-project-dialog";
import { useProjects } from "@/lib/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PHASES, PHASE_MAP } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  Filter,
  Loader2,
  Database,
  Clock,
  ArrowUpDown,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ProjectsPage() {
  const { projects, loading, createProject, syncGitHubStats, refetch } = useProjects();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [phaseFilter, setPhaseFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"urgency" | "name" | "updated" | "created">("urgency");
  const [staleProjectCount, setStaleProjectCount] = useState(0);
  const [hasStaleProjects, setHasStaleProjects] = useState(false);

  // Calculate stale projects count (avoid impure function during render)
  useEffect(() => {
    const staleCount = projects.filter((p) => {
      const lastActivity = p.lastSyncedAt || p.updatedAt;
      const daysSince = Math.floor(
        (Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysSince > 7 && p.status === "active";
    }).length;
    setStaleProjectCount(staleCount);
    setHasStaleProjects(staleCount > 0);
  }, [projects]);

  const filteredProjects = useMemo(() => {
    const filtered = projects.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase());
      const matchesPhase =
        phaseFilter === "all" || p.currentPhase === phaseFilter;
      const matchesStatus =
        statusFilter === "all" || p.status === statusFilter;
      return matchesSearch && matchesPhase && matchesStatus;
    });

    // Sort projects
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case "urgency": {
          // Calculate urgency score (higher = more urgent)
          const getUrgency = (p: typeof a) => {
            const lastActivity = p.lastSyncedAt || p.updatedAt;
            const daysSinceActivity = Math.floor(
              (Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24)
            );
            // Priority multiplier
            const priorityMultiplier = { low: 1, medium: 2, high: 3, critical: 4 }[p.priority] || 1;
            // Phase urgency (earlier stages less urgent)
            const phaseOrder = ["idea", "prototype", "free-tier", "premium", "deploy", "live"];
            const phaseIndex = phaseOrder.indexOf(p.currentPhase);
            const phaseUrgency = phaseIndex * 10;
            // Deadline urgency
            let deadlineUrgency = 0;
            if (p.deadline) {
              const daysToDeadline = Math.floor(
                (new Date(p.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
              );
              if (daysToDeadline < 0) deadlineUrgency = 100; // Overdue
              else if (daysToDeadline < 7) deadlineUrgency = 50;
              else if (daysToDeadline < 30) deadlineUrgency = 20;
            }
            return (daysSinceActivity * priorityMultiplier) + phaseUrgency + deadlineUrgency;
          };
          return getUrgency(b) - getUrgency(a);
        }
        case "name":
          return a.name.localeCompare(b.name);
        case "updated":
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case "created":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        default:
          return 0;
      }
    });
  }, [projects, search, phaseFilter, statusFilter, sortBy]);

  const [isSyncingAll, setIsSyncingAll] = useState(false);

  const handleSyncAll = async () => {
    setIsSyncingAll(true);
    try {
      const linked = projects.filter((p) => p.githubUrl || p.githubRepo);
      if (linked.length === 0) {
        toast.info("No linked repos", {
          description: "None of your projects are connected to a GitHub repository.",
        });
        return;
      }
      await Promise.allSettled(linked.map((p) => syncGitHubStats(p.id)));
      await refetch();
      toast.success(`Synced ${linked.length} project(s)`, {
        description: "All project data refreshed from GitHub",
      });
    } catch (err) {
      console.error("Sync all error:", err);
      toast.error("Sync failed", { description: "Some projects could not be synced" });
    } finally {
      setIsSyncingAll(false);
    }
  };

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
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Manage and track all your vibe coding projects
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          {projects.length > 0 && (
            <Button
              variant="outline"
              className="gap-2 rounded-xl"
              disabled={isSyncingAll}
              onClick={handleSyncAll}
            >
              <RefreshCw className={cn("h-4 w-4", isSyncingAll && "animate-spin")} />
              {isSyncingAll ? "Syncing…" : "Sync All"}
            </Button>
          )}
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

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:flex-1 sm:min-w-[200px] sm:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 rounded-xl pl-10"
          />
        </div>

        <Select value={phaseFilter} onValueChange={setPhaseFilter}>
          <SelectTrigger className="h-9 w-full sm:w-[160px] rounded-xl">
            <SelectValue placeholder="All Phases" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Phases</SelectItem>
            {PHASES.map((phase) => (
              <SelectItem key={phase.id} value={phase.id}>
                {phase.icon} {phase.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-full sm:w-[140px] rounded-xl">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
          <SelectTrigger className="h-9 w-full sm:w-[140px] rounded-xl">
            <ArrowUpDown className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="urgency">
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Urgency (Default)
              </span>
            </SelectItem>
            <SelectItem value="updated">Recently Updated</SelectItem>
            <SelectItem value="created">Recently Created</SelectItem>
            <SelectItem value="name">Name (A-Z)</SelectItem>
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center gap-1 rounded-xl border border-border p-0.5">
          <Button
            variant={view === "grid" ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7 rounded-lg"
            onClick={() => setView("grid")}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant={view === "list" ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7 rounded-lg"
            onClick={() => setView("list")}
          >
            <List className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Phase pills */}
      <div className="flex flex-wrap gap-2">
        <Badge
          variant={phaseFilter === "all" ? "default" : "outline"}
          className="cursor-pointer rounded-full px-3 py-1 text-xs transition-all hover:bg-primary hover:text-primary-foreground"
          onClick={() => setPhaseFilter("all")}
        >
          All ({projects.length})
        </Badge>
        {PHASES.map((phase) => {
          const count = projects.filter(
            (p) => p.currentPhase === phase.id
          ).length;
          if (count === 0) return null;
          return (
            <Badge
              key={phase.id}
              variant={phaseFilter === phase.id ? "default" : "outline"}
              className="cursor-pointer rounded-full px-3 py-1 text-xs transition-all hover:bg-primary hover:text-primary-foreground"
              onClick={() =>
                setPhaseFilter(phaseFilter === phase.id ? "all" : phase.id)
              }
            >
              {phase.icon} {phase.label} ({count})
            </Badge>
          );
        })}
      </div>

      {/* Urgency Alert Banner - Shows if there are stale projects */}
      {hasStaleProjects && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
          <Clock className="h-5 w-5 text-red-500" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">
              {staleProjectCount} project(s) need attention
            </p>
            <p className="text-xs text-red-600">
              No activity detected in over 7 days. Consider reviewing or updating these projects.
            </p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="border-red-300 text-red-700 hover:bg-red-100"
            onClick={() => setSortBy("urgency")}
          >
            View Priority
          </Button>
        </div>
      )}

      {/* Projects grid/list */}
      {filteredProjects.length > 0 ? (
        <div
          className={cn(
            view === "grid"
              ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
              : "flex flex-col gap-3"
          )}
        >
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              compact={view === "list"}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16">
          <Filter className="h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">
            {projects.length === 0 ? "No projects yet" : "No projects found"}
          </p>
          <p className="text-xs text-muted-foreground">
            {projects.length === 0
              ? "Create your first project to get started"
              : "Try adjusting your filters"}
          </p>
          {projects.length === 0 && (
            <div className="mt-4 flex gap-2">
              <NewProjectDialog
                onProjectCreated={createProject}
                trigger={
                  <Button variant="outline" className="gap-2 rounded-xl">
                    <Plus className="h-4 w-4" />
                    New Project
                  </Button>
                }
              />
              <Button
                variant="ghost"
                className="gap-2 rounded-xl"
                onClick={handleSeedData}
              >
                <Database className="h-4 w-4" />
                Load Demo Data
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
