"use client";

import { use, useState, useCallback, useEffect } from "react";
import { useProject } from "@/lib/hooks";
import { PHASES, PHASE_MAP, PRIORITY_COLORS, STATUS_COLORS, LEGACY_PHASE_MAP, PLATFORM_LABELS, ALL_PLATFORMS } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  GitBranch,
  GitCommit,
  Star,
  AlertCircle,
  ExternalLink,
  Globe,
  Calendar,
  DollarSign,
  Eye,
  CheckCircle2,
  Circle,
  Clock,
  Pencil,
  Trash2,
  TrendingUp,
  BarChart3,
  Loader2,
  Sparkles,
  RefreshCw,
  History,
  Plus,
  X,
  Copy,
  Users,
  Check,
} from "lucide-react";
import { ProjectTimeline } from "@/components/dashboard/project-timeline";
import { AIReviewModal } from "@/components/dashboard/ai-review-modal";
import { DomainLinkButton } from "@/components/dashboard/domain-link-button";
import { GoogleAnalyticsConnect } from "@/components/dashboard/google-analytics-connect";
import { GoogleAnalyticsDashboard } from "@/components/dashboard/google-analytics-dashboard";
import { UserDataConnect } from "@/components/dashboard/user-data-connect";
import { UserDataView } from "@/components/dashboard/user-data-view";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Task, Campaign, CampaignPlatform, ProjectPhase, AIReview, UserDataViewConfig } from "@/types";
import { useIsDemo } from "@/lib/demo-context";
import { toast } from "sonner";

// Inline Users tab component that manages its own view config state
function UserDataConnectTab({
  projectId,
  project,
  onUpdate,
}: {
  projectId: string;
  project: import("@/types").Project;
  onUpdate: (data: Partial<import("@/types").Project>) => void;
}) {
  const [viewConfig, setViewConfig] = useState<UserDataViewConfig | null>(null);
  const [cachedData, setCachedData] = useState<Record<string, unknown> | null>(null);

  // Load cached data when view config is set
  const handleViewConfigChange = async (config: UserDataViewConfig | null) => {
    setViewConfig(config);
    if (config) {
      const res = await fetch(`/api/projects/${projectId}/user-data`);
      if (res.ok) {
        const d = await res.json();
        setCachedData(d.cachedData || null);
      }
    }
  };

  return (
    <div className="space-y-6">
      <UserDataConnect
        project={project}
        onUpdate={onUpdate}
        onViewConfigChange={handleViewConfigChange}
      />
      {viewConfig && cachedData && (
        <UserDataView viewConfig={viewConfig} cachedData={cachedData} />
      )}
    </div>
  );
}

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { project, loading, error, refetch, updateProject, deleteProject, setProject } = useProject(id);
  const router = useRouter();
  const isDemo = useIsDemo();

  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);

  // Kick off the GitHub OAuth flow so VibeDash can read a now-private repo.
  const startGitHubReconnect = useCallback(() => {
    if (!project) return;
    window.location.href = `/api/github/connect?projectId=${project.id}`;
  }, [project]);

  // Show a toast that prompts the user to (re)connect GitHub when a repo has
  // become private and we can no longer read it.
  const showReconnectToast = useCallback(
    (message: string) => {
      toast.error("GitHub access needed", {
        description: message,
        duration: 12000,
        action: {
          label: "Connect GitHub",
          onClick: () => startGitHubReconnect(),
        },
      });
    },
    [startGitHubReconnect]
  );

  // Surface the result of the GitHub OAuth redirect (?github_connected / ?github_error)
  // then strip the query params so a refresh doesn't re-show the toast.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("github_connected");
    const ghError = params.get("github_error");
    if (!connected && !ghError) return;

    if (connected) {
      setGithubNeedsReconnect(false);
      toast.success("GitHub connected", {
        description: "VibeDash can now read your private repository. Run the AI review again.",
      });
    } else if (ghError) {
      const messages: Record<string, string> = {
        denied: "You declined the GitHub authorization.",
        auth_mismatch: "Sign-in mismatch — please try connecting again.",
        token_exchange: "Could not complete the GitHub handshake. Please try again.",
        missing_code: "GitHub did not return an authorization code. Please try again.",
        callback_failed: "Something went wrong finishing the GitHub connection.",
      };
      toast.error("GitHub connection failed", {
        description: messages[ghError] || "Please try connecting GitHub again.",
      });
    }

    params.delete("github_connected");
    params.delete("github_error");
    const qs = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
  }, []);

  const handleSyncGitHub = useCallback(async () => {
    if (!project) return;
    setIsSyncing(true);
    try {
      if (isDemo) {
        await new Promise((r) => setTimeout(r, 1200));
        setProject((prev) =>
          prev
            ? {
                ...prev,
                commits: Math.max(prev.commits || 0, Math.floor(Math.random() * 200) + 50),
                stars: Math.max(prev.stars || 0, Math.floor(Math.random() * 50)),
                openIssues: Math.floor(Math.random() * 15),
                lastSyncedAt: new Date().toISOString(),
              }
            : prev
        );
        toast.success("Synced with GitHub", {
          description: "Project data refreshed from repository",
        });
        return;
      }

      const res = await fetch(`/api/projects/${project.id}/sync-github`, {
        method: "POST",
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (errData.needsReconnect) {
          setGithubNeedsReconnect(true);
          showReconnectToast(errData.error || "This repository is private. Connect GitHub to continue.");
          return;
        }
        throw new Error(errData.error || `Sync failed (${res.status})`);
      }
      const updated = await res.json();
      setProject((prev) => (prev ? { ...prev, ...updated } : prev));
      toast.success("Synced with GitHub", {
        description: "Project data refreshed — name, stats & latest commit updated",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      toast.error("Sync failed", { description: message });
    } finally {
      setIsSyncing(false);
    }
  }, [project, isDemo, setProject, showReconnectToast]);

  // AI Review state
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [isRunningReview, setIsRunningReview] = useState(false);
  // True once we detect the repo is private and we can't read it — drives the
  // persistent "Connect GitHub" banner inside the review modal.
  const [githubNeedsReconnect, setGithubNeedsReconnect] = useState(false);

  const handleRunAIReview = useCallback(async (): Promise<AIReview | null> => {
    if (!project) return null;
    setIsRunningReview(true);
    try {
      if (isDemo) {
        // Simulate network delay for demo mode
        await new Promise(resolve => setTimeout(resolve, 2000));
        const review: AIReview = {
          id: `review-${Date.now()}`,
          projectId: project.id,
          type: "code-review",
          summary: `Analyzed ${project.name} codebase. Found good structure with room for improvement in error handling and test coverage.`,
          completenessScore: Math.floor(Math.random() * 30) + 70,
          bugsFound: ["Minor UI responsiveness issue on mobile"],
          suggestions: ["Add more error handling", "Consider adding unit tests"],
          suggestedTasks: [
            { title: "Improve error handling", description: "Add try-catch blocks and error boundaries to critical user flows.", phase: project.currentPhase, priority: "high" },
            { title: "Add unit tests", description: "Write Jest/Vitest tests for core components and utilities.", phase: project.currentPhase, priority: "medium" },
            { title: "Optimize mobile layout", description: "Fix responsive design issues on screens smaller than 768px.", phase: project.currentPhase, priority: "medium" },
          ],
          recommendedStage: project.currentPhase,
          recommendedProgress: Math.min(100, (project.phaseProgress[project.currentPhase] || 0) + 10),
          shouldUpdate: Math.random() > 0.5,
          createdAt: new Date().toISOString(),
        };
        // Create task objects from suggested tasks
        const aiTasks: Task[] = (review.suggestedTasks || []).map((st, idx) => ({
          id: `ai-task-${Date.now()}-${idx}`,
          projectId: project.id,
          title: `🤖 ${st.title}`,
          description: st.description,
          phase: st.phase,
          status: "todo" as const,
          priority: st.priority,
          createdAt: new Date().toISOString(),
        }));
        // Update project locally with the new review and tasks
        setProject(prev => prev ? {
          ...prev,
          aiReviews: [review, ...(prev.aiReviews || [])],
          tasks: [...(prev.tasks || []), ...aiTasks],
          updatedAt: new Date().toISOString(),
        } : prev);
        toast.success("AI review completed", {
          description: `Completeness score: ${review.completenessScore}% — ${aiTasks.length} tasks added`,
        });
        return review;
      }

      const res = await fetch(`/api/projects/${project.id}/ai-review`, {
        method: "POST",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        if (errorData.needsReconnect) {
          setGithubNeedsReconnect(true);
          showReconnectToast(errorData.error || "This repository is private. Connect GitHub to continue.");
          return null;
        }
        throw new Error(errorData.error || `Review failed (${res.status})`);
      }
      setGithubNeedsReconnect(false);
      const data = await res.json();
      await refetch();
      const taskCount = data.review?.suggestedTasks?.length || 0;
      toast.success("AI review completed", {
        description: `Completeness score: ${data.review?.completenessScore || 0}%${taskCount > 0 ? ` — ${taskCount} tasks added` : ""}`,
      });
      return data.review;
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      toast.error("AI review failed", { description: message });
      return null;
    } finally {
      setIsRunningReview(false);
    }
  }, [project, isDemo, refetch, setProject, showReconnectToast]);

  const handleApplyReview = useCallback(async (review: AIReview) => {
    if (!project) return;
    try {
      if (isDemo) {
        const toStage = review.recommendedStage || project.currentPhase;
        setProject(prev => prev ? {
          ...prev,
          currentPhase: toStage,
          phaseProgress: {
            ...prev.phaseProgress,
            [toStage]: review.recommendedProgress ?? prev.phaseProgress[toStage],
          },
          updatedAt: new Date().toISOString(),
        } : prev);
        toast.success("AI recommendations applied", {
          description: review.recommendedStage
            ? `Moved to ${PHASE_MAP[review.recommendedStage]?.label || review.recommendedStage} at ${review.recommendedProgress}%`
            : "Project updated successfully",
        });
        return;
      }

      const res = await fetch(`/api/projects/${project.id}/phase`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase: review.recommendedStage,
          phaseProgress: review.recommendedProgress,
          phaseProgressMap: review.stageProgressMap,
          source: "ai-review",
          sourceId: review.id,
        }),
      });
      if (!res.ok) throw new Error("Failed to apply AI suggestions");
      await refetch();
      toast.success("AI recommendations applied", {
        description: review.recommendedStage
          ? `Moved to ${PHASE_MAP[review.recommendedStage]?.label || review.recommendedStage} at ${review.recommendedProgress}%`
          : "Project updated successfully",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "An unexpected error occurred";
      toast.error("Failed to apply review", { description: message });
    }
  }, [project, isDemo, refetch, setProject]);

  // Edit project dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStatus, setEditStatus] = useState<"active" | "paused" | "completed">("active");
  const [editPriority, setEditPriority] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [editDomain, setEditDomain] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Delete dialog state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Add task dialog state
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskPhase, setTaskPhase] = useState<ProjectPhase>("idea");
  const [taskPriority, setTaskPriority] = useState<"low" | "medium" | "high">("medium");
  const [taskDueDate, setTaskDueDate] = useState("");
  const [taskSaving, setTaskSaving] = useState(false);

  // Task preview state
  const [previewTask, setPreviewTask] = useState<Task | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopyTask = (task: Task) => {
    const text = [
      task.title,
      task.description,
      `Phase: ${(PHASE_MAP[LEGACY_PHASE_MAP[task.phase] || task.phase] || PHASE_MAP["idea"])?.label}`,
      `Priority: ${task.priority}`,
      `Status: ${task.status}`,
      task.dueDate ? `Due: ${new Date(task.dueDate).toLocaleDateString()}` : "",
    ].filter(Boolean).join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Task copied to clipboard");
  };

  // Add campaign dialog state
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [campaignPlatform, setCampaignPlatform] = useState<CampaignPlatform>("google");
  const [campaignBudget, setCampaignBudget] = useState("");
  const [campaignStatus, setCampaignStatus] = useState<"draft" | "active" | "paused" | "completed">("draft");
  const [campaignSaving, setCampaignSaving] = useState(false);

  // --- Handlers ---

  const openEditDialog = () => {
    if (!project) return;
    setEditName(project.name);
    setEditDescription(project.description);
    setEditStatus(project.status);
    setEditPriority(project.priority);
    setEditDomain(project.domain || "");
    setEditDeadline(project.deadline ? project.deadline.slice(0, 10) : "");
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!project || !editName.trim()) return;
    setEditSaving(true);
    try {
      await updateProject({
        name: editName.trim(),
        description: editDescription.trim(),
        status: editStatus,
        priority: editPriority,
        domain: editDomain.trim() || undefined,
        deadline: editDeadline ? new Date(editDeadline).toISOString() : undefined,
      });
      setEditOpen(false);
    } catch (err) {
      console.error("Failed to update project:", err);
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteProject();
      router.push("/dashboard/projects");
    } catch (err) {
      console.error("Failed to delete project:", err);
      setDeleting(false);
    }
  };

  const handleAddTask = async () => {
    if (!project || !taskTitle.trim()) return;
    setTaskSaving(true);
    try {
      const newTask: Task = {
        id: `task-${Date.now()}`,
        projectId: project.id,
        title: taskTitle.trim(),
        description: taskDescription.trim(),
        phase: taskPhase,
        status: "todo",
        priority: taskPriority,
        dueDate: taskDueDate || undefined,
        createdAt: new Date().toISOString(),
      };
      await updateProject({
        tasks: [...(project.tasks || []), newTask],
      });
      setTaskOpen(false);
      setTaskTitle("");
      setTaskDescription("");
      setTaskPhase("idea");
      setTaskPriority("medium");
      setTaskDueDate("");
    } catch (err) {
      console.error("Failed to add task:", err);
    } finally {
      setTaskSaving(false);
    }
  };

  const handleToggleTaskStatus = async (taskId: string) => {
    if (!project) return;
    const statusCycle: Record<string, "todo" | "in-progress" | "done"> = {
      todo: "in-progress",
      "in-progress": "done",
      done: "todo",
    };
    const updatedTasks = project.tasks.map((t) =>
      t.id === taskId ? { ...t, status: statusCycle[t.status] } : t
    );
    await updateProject({ tasks: updatedTasks });
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!project) return;
    const updatedTasks = project.tasks.filter((t) => t.id !== taskId);
    await updateProject({ tasks: updatedTasks });
  };

  const handleAddCampaign = async () => {
    if (!project || !campaignName.trim()) return;
    setCampaignSaving(true);
    try {
      const newCampaign: Campaign = {
        id: `campaign-${Date.now()}`,
        projectId: project.id,
        platform: campaignPlatform,
        name: campaignName.trim(),
        status: campaignStatus,
        budget: parseFloat(campaignBudget) || 0,
        spent: 0,
        impressions: 0,
        clicks: 0,
        conversions: 0,
        startDate: new Date().toISOString().slice(0, 10),
      };
      await updateProject({
        campaigns: [...(project.campaigns || []), newCampaign],
      });
      setCampaignOpen(false);
      setCampaignName("");
      setCampaignPlatform("google");
      setCampaignBudget("");
      setCampaignStatus("draft");
    } catch (err) {
      console.error("Failed to add campaign:", err);
    } finally {
      setCampaignSaving(false);
    }
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    if (!project) return;
    const updatedCampaigns = project.campaigns.filter((c) => c.id !== campaignId);
    await updateProject({ campaigns: updatedCampaigns });
  };

  const handleToggleCampaignStatus = async (campaignId: string) => {
    if (!project) return;
    const statusCycle: Record<string, "draft" | "active" | "paused" | "completed"> = {
      draft: "active",
      active: "paused",
      paused: "active",
      completed: "draft",
    };
    const updatedCampaigns = project.campaigns.map((c) =>
      c.id === campaignId ? { ...c, status: statusCycle[c.status] } : c
    );
    await updateProject({ campaigns: updatedCampaigns });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-lg font-medium">Project not found</p>
        <Link href="/dashboard/projects" className="mt-2 text-sm text-violet-500">
          ← Back to projects
        </Link>
      </div>
    );
  }

  // Handle legacy phases by mapping them to new 6-stage pipeline
  const mappedPhase = LEGACY_PHASE_MAP[project.currentPhase] || project.currentPhase;
  const phase = PHASE_MAP[mappedPhase] || PHASE_MAP["idea"];
  const totalProgress = Object.values(project.phaseProgress || {}).reduce(
    (a, b) => a + b,
    0
  );
  const overallProgress = Math.round(totalProgress / 6);

  const statusIcons = {
    todo: Circle,
    "in-progress": Clock,
    done: CheckCircle2,
  };

  return (
    <div className="space-y-6">
      {/* Back & Header */}
      <div className="space-y-3">
        <Link
          href="/dashboard/projects"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div
                className="h-4 w-4 shrink-0 rounded-full"
                style={{ backgroundColor: project.color }}
              />
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                {project.name}
              </h1>
              <Badge
                variant="secondary"
                className={cn("text-xs", STATUS_COLORS[project.status])}
              >
                {project.status}
              </Badge>
              <Badge
                variant="secondary"
                className={cn("text-xs", PRIORITY_COLORS[project.priority])}
              >
                {project.priority}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {project.description}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <GoogleAnalyticsConnect
              project={project}
              onUpdate={(data) => setProject((prev) => prev ? { ...prev, ...data } : prev)}
            />
            <DomainLinkButton
              domain={project.domain}
              onDomainChange={async (domain) => {
                await updateProject({ domain });
              }}
              size="md"
            />
            <Button variant="outline" size="sm" className="gap-2 rounded-xl" onClick={openEditDialog}>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 rounded-xl text-red-500 hover:text-red-500"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
              <span className="text-lg">{phase.icon}</span>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Current Phase</p>
              <p className="text-sm font-semibold">{phase.label}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
              <DollarSign className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Revenue</p>
              <p className="text-sm font-semibold">
                ${project.revenue.toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
              <Eye className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Monthly Visitors</p>
              <p className="text-sm font-semibold">
                {project.monthlyVisitors.toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10">
              <GitCommit className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Commits</p>
              <p className="text-sm font-semibold">{project.commits}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-500/10">
              <BarChart3 className="h-5 w-5 text-pink-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Overall Progress</p>
              <p className="text-sm font-semibold">{overallProgress}%</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList className="rounded-xl w-max sm:w-auto">
            <TabsTrigger value="overview" className="rounded-lg">
              Overview
            </TabsTrigger>
            <TabsTrigger value="timeline" className="rounded-lg">
              <History className="h-4 w-4 mr-1" />
              Timeline
            </TabsTrigger>
            <TabsTrigger value="ai-reviews" className="rounded-lg">
              <Sparkles className="h-4 w-4 mr-1" />
              AI Reviews
            </TabsTrigger>
            <TabsTrigger value="tasks" className="rounded-lg">
              Tasks
            </TabsTrigger>
            <TabsTrigger value="analytics" className="rounded-lg">
              <BarChart3 className="h-4 w-4 mr-1" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="marketing" className="rounded-lg">
              Marketing
            </TabsTrigger>
            <TabsTrigger value="users" className="rounded-lg">
              <Users className="h-4 w-4 mr-1" />
              Users
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Phase Progress */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Phase Progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {PHASES.map((ph) => {
                  const progress = project.phaseProgress?.[ph.id] || 0;
                  const isCurrent = project.currentPhase === ph.id;
                  const subTasks = project.phaseSubTasks?.[ph.id] || [];
                  const completedTasks = subTasks.filter(t => t.completed).length;
                  return (
                    <div
                      key={ph.id}
                      className={cn(
                        "rounded-xl border p-4 transition-all",
                        isCurrent
                          ? "border-violet-500/30 bg-violet-500/5"
                          : "border-border"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{ph.icon}</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold">
                                {ph.label}
                              </span>
                              {isCurrent && (
                                <Badge className="h-5 bg-violet-500 text-[10px] text-white">
                                  Current
                                </Badge>
                              )}
                              {progress === 100 && (
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {ph.description}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-medium">{progress}%</span>
                          {subTasks.length > 0 && (
                            <p className="text-[10px] text-muted-foreground">
                              {completedTasks}/{subTasks.length} tasks
                            </p>
                          )}
                        </div>
                      </div>
                      <Progress value={progress} className="mt-3 h-2" />
                      
                      {/* Sub-tasks for current phase */}
                      {isCurrent && subTasks.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-border/50">
                          <p className="text-xs font-medium mb-2">Checklist:</p>
                          <ul className="space-y-1">
                            {subTasks.map((task) => (
                              <li key={task.id} className="flex items-center gap-2 text-xs">
                                <span className={cn(
                                  "h-3.5 w-3.5 rounded border flex items-center justify-center text-[8px]",
                                  task.completed 
                                    ? "bg-green-500 border-green-500 text-white" 
                                    : "border-muted-foreground"
                                )}>
                                  {task.completed && "✓"}
                                </span>
                                <span className={cn(
                                  task.completed && "line-through text-muted-foreground"
                                )}>
                                  {task.title}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* GitHub & Activity */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Repository Info</CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 rounded-xl"
                      disabled={isSyncing}
                      onClick={handleSyncGitHub}
                    >
                      <RefreshCw className={cn("h-3.5 w-3.5", isSyncing && "animate-spin")} />
                      {isSyncing ? "Syncing…" : "Sync"}
                    </Button>
                  </div>
                  {project.lastSyncedAt && (
                    <p className="text-xs text-muted-foreground">
                      Last synced {formatDistanceToNow(new Date(project.lastSyncedAt), { addSuffix: true })}
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Repo</span>
                    <a
                      href={project.githubUrl}
                      className="flex items-center gap-1 text-sm font-medium text-violet-500"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <GitBranch className="h-3.5 w-3.5" />
                      {project.githubRepo}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold">{project.commits}</p>
                      <p className="text-xs text-muted-foreground">Commits</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{project.stars}</p>
                      <p className="text-xs text-muted-foreground">Stars</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{project.openIssues}</p>
                      <p className="text-xs text-muted-foreground">Open Issues</p>
                    </div>
                  </div>
                  <Separator />
                  <div className="flex flex-wrap gap-1.5">
                    {(project.techStack || []).map((tech) => (
                      <Badge
                        key={tech}
                        variant="outline"
                        className="text-xs font-normal"
                      >
                        {tech}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Latest Commit */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Latest Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  {project.lastCommit ? (
                    <div className="space-y-3">
                      <div className="rounded-xl bg-muted/50 p-4">
                        <p className="text-sm font-medium">
                          {project.lastCommit.message}
                        </p>
                        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="font-mono text-violet-500">
                            {project.lastCommit.sha}
                          </span>
                          <span>by {project.lastCommit.author}</span>
                          <span>
                            {formatDistanceToNow(
                              new Date(project.lastCommit.date),
                              { addSuffix: true }
                            )}
                          </span>
                        </div>
                      </div>
                      {project.domain && (
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-muted-foreground" />
                          <a
                            href={project.domain.startsWith('http') ? project.domain : `https://${project.domain}`}
                            className="text-sm text-violet-500"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {project.domain}
                          </a>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No commits yet
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Google Analytics in overview */}
            {project.googleAnalytics?.propertyId && (
              <GoogleAnalyticsDashboard
                project={project}
                onUpdate={(data) => setProject((prev) => prev ? { ...prev, ...data } : prev)}
              />
            )}
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-4">
          {project.googleAnalytics?.propertyId ? (
            <GoogleAnalyticsDashboard
              project={project}
              onUpdate={(data) => setProject((prev) => prev ? { ...prev, ...data } : prev)}
            />
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <BarChart3 className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-semibold mb-1">Connect Google Analytics</h3>
                <p className="text-sm text-muted-foreground mb-4 max-w-md">
                  Link your Google Analytics account to see live visitor data,
                  daily trends, and top pages for this project.
                </p>
                <GoogleAnalyticsConnect
                  project={project}
                  onUpdate={(data) => setProject((prev) => prev ? { ...prev, ...data } : prev)}
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline" className="space-y-4">
          <ProjectTimeline project={project} />
        </TabsContent>

        {/* AI Reviews Tab */}
        <TabsContent value="ai-reviews" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">AI Code Reviews</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    AI-powered analysis of your code and project progress
                  </p>
                </div>
                <Button 
                  className="gap-2 rounded-xl"
                  disabled={isRunningReview}
                  onClick={() => setIsReviewModalOpen(true)}
                >
                  {isRunningReview ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {isRunningReview ? "Analyzing..." : "Run AI Review"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {(project.aiReviews?.length ?? 0) > 0 ? (
                <div className="space-y-3">
                  {project.aiReviews.map((review) => (
                    <div
                      key={review.id}
                      className="rounded-xl border border-border p-4 transition-all hover:bg-muted/50"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "flex h-10 w-10 items-center justify-center rounded-xl",
                            review.type === "code-review" ? "bg-amber-500/10" : "bg-violet-500/10"
                          )}>
                            {review.type === "code-review" ? (
                              <Sparkles className="h-5 w-5 text-amber-500" />
                            ) : (
                              <GitCommit className="h-5 w-5 text-violet-500" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              {review.type === "code-review" ? "Code Review" : "Commit Analysis"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                        {review.completenessScore > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {review.completenessScore}% complete
                          </Badge>
                        )}
                      </div>
                      
                      <p className="text-sm mt-3">{review.summary}</p>
                      
                      {review.shouldUpdate && review.recommendedStage && (
                        <div className="mt-3 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                          <RefreshCw className="h-4 w-4" />
                          <span>
                            Recommends: Move to {PHASE_MAP[review.recommendedStage]?.label || review.recommendedStage} at {review.recommendedProgress}%
                          </span>
                        </div>
                      )}
                      
                      {(review.bugsFound?.length ?? 0) > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-medium text-red-600">Issues Found:</p>
                          <ul className="mt-1 space-y-1">
                            {review.bugsFound.map((bug, i) => (
                              <li key={i} className="text-xs text-red-600 flex items-start gap-1">
                                <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                                <span>{bug}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-sm font-medium">No AI reviews yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Run an AI review to analyze your code and get progress insights
                  </p>
                  <Button 
                    className="mt-4 gap-2 rounded-xl"
                    disabled={isRunningReview}
                    onClick={() => setIsReviewModalOpen(true)}
                  >
                    {isRunningReview ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {isRunningReview ? "Analyzing..." : "Run First AI Review"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Tasks</CardTitle>
                <Button size="sm" className="gap-2 rounded-xl" onClick={() => {
                  setTaskPhase(project.currentPhase);
                  setTaskOpen(true);
                }}>
                  <Plus className="h-3 w-3" />
                  Add Task
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {(project.tasks?.length ?? 0) > 0 ? (
                project.tasks.map((task) => {
                  const StatusIcon = statusIcons[task.status];
                  return (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 rounded-xl border border-border p-3 transition-all hover:bg-muted/50 cursor-pointer"
                      onClick={() => setPreviewTask(task)}
                    >
                      <button
                        onClick={(e) => { e.stopPropagation(); handleToggleTaskStatus(task.id); }}
                        className="shrink-0"
                        title={`Status: ${task.status} (click to cycle)`}
                      >
                        <StatusIcon
                          className={cn(
                            "h-4 w-4",
                            task.status === "done"
                              ? "text-green-500"
                              : task.status === "in-progress"
                              ? "text-violet-500"
                              : "text-muted-foreground"
                          )}
                        />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          "text-sm font-medium",
                          task.status === "done" && "line-through text-muted-foreground"
                        )}>{task.title}</p>
                        {task.description && (
                          <p className="text-xs text-muted-foreground truncate">
                            {task.description}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {(PHASE_MAP[LEGACY_PHASE_MAP[task.phase] || task.phase] || PHASE_MAP["idea"])?.icon} {(PHASE_MAP[LEGACY_PHASE_MAP[task.phase] || task.phase] || PHASE_MAP["idea"])?.label}
                      </Badge>
                      <Badge variant="outline" className={cn("text-[10px] shrink-0", PRIORITY_COLORS[task.priority])}>
                        {task.priority}
                      </Badge>
                      {task.dueDate && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {new Date(task.dueDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 shrink-0 text-red-400 hover:text-red-500"
                        onClick={(e) => { e.stopPropagation(); handleDeleteTask(task.id); }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No tasks yet. Add your first task to get started.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* GitHub Tab */}
        <TabsContent value="github" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Repository Info</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 rounded-xl"
                    disabled={isSyncing}
                    onClick={handleSyncGitHub}
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", isSyncing && "animate-spin")} />
                    {isSyncing ? "Syncing…" : "Sync"}
                  </Button>
                </div>
                {project.lastSyncedAt && (
                  <p className="text-xs text-muted-foreground">
                    Last synced {formatDistanceToNow(new Date(project.lastSyncedAt), { addSuffix: true })}
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Repo</span>
                  <a
                    href={project.githubUrl}
                    className="flex items-center gap-1 text-sm font-medium text-violet-500"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <GitBranch className="h-3.5 w-3.5" />
                    {project.githubRepo}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <Separator />
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold">{project.commits}</p>
                    <p className="text-xs text-muted-foreground">Commits</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{project.stars}</p>
                    <p className="text-xs text-muted-foreground">Stars</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{project.openIssues}</p>
                    <p className="text-xs text-muted-foreground">
                      Open Issues
                    </p>
                  </div>
                </div>
                <Separator />
                <div className="flex flex-wrap gap-1.5">
                  {(project.techStack || []).map((tech) => (
                    <Badge
                      key={tech}
                      variant="outline"
                      className="text-xs font-normal"
                    >
                      {tech}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Latest Commit</CardTitle>
              </CardHeader>
              <CardContent>
                {project.lastCommit ? (
                  <div className="space-y-3">
                    <div className="rounded-xl bg-muted/50 p-4">
                      <p className="text-sm font-medium">
                        {project.lastCommit.message}
                      </p>
                      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="font-mono text-violet-500">
                          {project.lastCommit.sha}
                        </span>
                        <span>by {project.lastCommit.author}</span>
                        <span>
                          {formatDistanceToNow(
                            new Date(project.lastCommit.date),
                            { addSuffix: true }
                          )}
                        </span>
                      </div>
                    </div>
                    {project.domain && (
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <a
                          href={project.deploymentUrl}
                          className="text-sm text-violet-500"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {project.domain}
                        </a>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No commits yet
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Marketing Tab */}
        <TabsContent value="marketing" className="space-y-4">
          {/* Campaign summary stats */}
          {(project.campaigns?.length ?? 0) > 0 && (
            <div className="grid gap-4 sm:grid-cols-4">
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-2xl font-bold">
                    ${project.campaigns.reduce((sum, c) => sum + c.budget, 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">Total Budget</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-2xl font-bold">
                    {project.campaigns.reduce((sum, c) => sum + c.impressions, 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">Total Impressions</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-2xl font-bold">
                    {project.campaigns.reduce((sum, c) => sum + c.clicks, 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">Total Clicks</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-2xl font-bold">
                    {project.campaigns.reduce((sum, c) => sum + c.conversions, 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">Total Conversions</p>
                </CardContent>
              </Card>
            </div>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Ad Campaigns</CardTitle>
                <Button size="sm" className="gap-2 rounded-xl" onClick={() => setCampaignOpen(true)}>
                  <Plus className="h-3.5 w-3.5" />
                  New Campaign
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {(project.campaigns?.length ?? 0) > 0 ? (
                <div className="space-y-3">
                  {project.campaigns.map((campaign) => (
                    <div
                      key={campaign.id}
                      className="rounded-xl border border-border p-4 transition-all hover:bg-muted/50"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Badge
                            variant="secondary"
                            className="text-xs capitalize"
                          >
                            {PLATFORM_LABELS[campaign.platform] || campaign.platform}
                          </Badge>
                          <span className="text-sm font-medium">
                            {campaign.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleToggleCampaignStatus(campaign.id)}>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs capitalize cursor-pointer",
                                campaign.status === "active" && "border-green-500/30 text-green-500",
                                campaign.status === "paused" && "border-yellow-500/30 text-yellow-500",
                                campaign.status === "completed" && "border-blue-500/30 text-blue-500"
                              )}
                            >
                              {campaign.status}
                            </Badge>
                          </button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-red-400 hover:text-red-500"
                            onClick={() => handleDeleteCampaign(campaign.id)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-4 gap-4 text-center">
                        <div>
                          <p className="text-sm font-semibold">
                            ${campaign.spent}/{campaign.budget}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Budget
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-semibold">
                            {campaign.impressions.toLocaleString()}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Impressions
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-semibold">
                            {campaign.clicks.toLocaleString()}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Clicks
                          </p>
                        </div>
                        <div>
                          <p className="text-sm font-semibold">
                            {campaign.conversions}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Conversions
                          </p>
                        </div>
                      </div>
                      {campaign.budget > 0 && (
                        <div className="mt-2">
                          <Progress
                            value={(campaign.spent / campaign.budget) * 100}
                            className="h-1"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-sm font-medium">No campaigns yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Create your first marketing campaign to track performance
                  </p>
                  <Button
                    className="mt-4 gap-2 rounded-xl"
                    size="sm"
                    onClick={() => setCampaignOpen(true)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Create First Campaign
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-6">
          <UserDataConnectTab projectId={project.id} project={project} onUpdate={(data) => setProject((prev) => prev ? { ...prev, ...data } : prev)} />
        </TabsContent>
      </Tabs>

      {/* Edit Project Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>
              Update your project details below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Project name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Project description"
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={editStatus} onValueChange={(v) => setEditStatus(v as typeof editStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={editPriority} onValueChange={(v) => setEditPriority(v as typeof editPriority)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-domain">Domain</Label>
                <Input
                  id="edit-domain"
                  value={editDomain}
                  onChange={(e) => setEditDomain(e.target.value)}
                  placeholder="example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-deadline">Deadline</Label>
                <Input
                  id="edit-deadline"
                  type="date"
                  value={editDeadline}
                  onChange={(e) => setEditDeadline(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditSave} disabled={editSaving || !editName.trim()}>
              {editSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{project.name}&quot;? This action cannot be undone. All tasks, campaigns, and reviews will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Task Dialog */}
      <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Task</DialogTitle>
            <DialogDescription>
              Create a new task for this project.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="task-title">Title</Label>
              <Input
                id="task-title"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                placeholder="Task title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-description">Description</Label>
              <Textarea
                id="task-description"
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                placeholder="Task description (optional)"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phase</Label>
                <Select value={taskPhase} onValueChange={(v) => setTaskPhase(v as ProjectPhase)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PHASES.map((ph) => (
                      <SelectItem key={ph.id} value={ph.id}>
                        {ph.icon} {ph.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={taskPriority} onValueChange={(v) => setTaskPriority(v as "low" | "medium" | "high")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-due-date">Due Date (optional)</Label>
              <Input
                id="task-due-date"
                type="date"
                value={taskDueDate}
                onChange={(e) => setTaskDueDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTaskOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddTask} disabled={taskSaving || !taskTitle.trim()}>
              {taskSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Campaign Dialog */}
      <Dialog open={campaignOpen} onOpenChange={setCampaignOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>New Campaign</DialogTitle>
            <DialogDescription>
              Create a new marketing campaign for this project.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="campaign-name">Campaign Name</Label>
              <Input
                id="campaign-name"
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="e.g., Summer Launch Campaign"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Platform</Label>
                <Select value={campaignPlatform} onValueChange={(v) => setCampaignPlatform(v as CampaignPlatform)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_PLATFORMS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {PLATFORM_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={campaignStatus} onValueChange={(v) => setCampaignStatus(v as typeof campaignStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="campaign-budget">Budget ($)</Label>
              <Input
                id="campaign-budget"
                type="number"
                min="0"
                step="0.01"
                value={campaignBudget}
                onChange={(e) => setCampaignBudget(e.target.value)}
                placeholder="500"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCampaignOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddCampaign} disabled={campaignSaving || !campaignName.trim()}>
              {campaignSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Preview Dialog */}
      <Dialog open={!!previewTask} onOpenChange={(open) => { if (!open) setPreviewTask(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <DialogTitle className="text-base">{previewTask?.title}</DialogTitle>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 shrink-0"
                onClick={() => previewTask && handleCopyTask(previewTask)}
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </DialogHeader>
          {previewTask && (
            <div className="space-y-4 py-2">
              {previewTask.description && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Description</p>
                  <p className="text-sm whitespace-pre-wrap">{previewTask.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Phase</p>
                  <Badge variant="outline" className="text-xs">
                    {(PHASE_MAP[LEGACY_PHASE_MAP[previewTask.phase] || previewTask.phase] || PHASE_MAP["idea"])?.icon}{" "}
                    {(PHASE_MAP[LEGACY_PHASE_MAP[previewTask.phase] || previewTask.phase] || PHASE_MAP["idea"])?.label}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Priority</p>
                  <Badge variant="outline" className={cn("text-xs", PRIORITY_COLORS[previewTask.priority])}>
                    {previewTask.priority}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Status</p>
                  <Badge variant="outline" className="text-xs capitalize">
                    {previewTask.status === "done" ? "✅" : previewTask.status === "in-progress" ? "🔄" : "⭕"} {previewTask.status}
                  </Badge>
                </div>
                {previewTask.dueDate && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Due Date</p>
                    <p className="text-sm">
                      {new Date(previewTask.dueDate).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Created</p>
                <p className="text-sm">{formatDistanceToNow(new Date(previewTask.createdAt), { addSuffix: true })}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* AI Review Modal */}
      <AIReviewModal
        project={project}
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        onRequestReview={handleRunAIReview}
        onApplyReview={handleApplyReview}
        loading={isRunningReview}
        needsReconnect={githubNeedsReconnect}
        onReconnect={startGitHubReconnect}
      />
    </div>
  );
}
