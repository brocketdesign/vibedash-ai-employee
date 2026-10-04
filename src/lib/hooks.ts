"use client";

import { useState, useEffect, useCallback } from "react";
import { Project, DashboardStats, ProjectPhase, AIReview, Top3Action } from "@/types";
import { useIsDemo } from "@/lib/demo-context";
import { mockProjects, mockStats, mockTop3Actions } from "@/lib/mock-data";

// Generate mock AI review for demo mode
function generateMockAIReview(project: Project): AIReview {
  return {
    id: `review-${Date.now()}`,
    projectId: project.id,
    type: "code-review",
    summary: `Analyzed ${project.name} codebase. Found good structure with room for improvement.`,
    completenessScore: Math.floor(Math.random() * 30) + 70, // 70-100
    bugsFound: ["Minor UI responsiveness issue on mobile"],
    suggestions: ["Add more error handling", "Consider adding unit tests"],
    recommendedStage: project.currentPhase,
    recommendedProgress: Math.min(100, (project.phaseProgress[project.currentPhase] || 0) + 10),
    shouldUpdate: Math.random() > 0.5,
    createdAt: new Date().toISOString(),
  };
}

// ---- Projects ----

export function useProjects() {
  const isDemo = useIsDemo();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    if (isDemo) {
      setProjects(mockProjects);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await fetch("/api/projects");
      if (!res.ok) throw new Error("Failed to fetch projects");
      const data = await res.json();
      setProjects(data);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [isDemo]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const createProject = async (project: Partial<Project>) => {
    if (isDemo) {
      // In demo mode, simulate locally without API
      const created = { ...project, id: `proj-demo-${Date.now()}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), status: "active" } as Project;
      setProjects((prev) => [created, ...prev]);
      return created;
    }
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(project),
    });
    if (!res.ok) throw new Error("Failed to create project");
    const created = await res.json();
    setProjects((prev) => [created, ...prev]);
    return created;
  };

  const updateProject = async (id: string, data: Partial<Project>) => {
    if (isDemo) {
      setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...data } : p)));
      return { id, ...data } as Project;
    }
    const res = await fetch(`/api/projects/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to update project");
    const updated = await res.json();
    setProjects((prev) => prev.map((p) => (p.id === id ? updated : p)));
    return updated;
  };

  const deleteProject = async (id: string) => {
    if (isDemo) {
      setProjects((prev) => prev.filter((p) => p.id !== id));
      return;
    }
    const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete project");
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  const moveProjectPhase = async (
    id: string,
    phase: ProjectPhase,
    phaseProgress?: number
  ) => {
    if (isDemo) {
      setProjects((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, currentPhase: phase, phaseProgress: { ...p.phaseProgress, [phase]: phaseProgress ?? p.phaseProgress[phase] } }
            : p
        )
      );
      return;
    }
    const res = await fetch(`/api/projects/${id}/phase`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phase, phaseProgress }),
    });
    if (!res.ok) throw new Error("Failed to update phase");
    const updated = await res.json();
    setProjects((prev) => prev.map((p) => (p.id === id ? updated : p)));
    return updated;
  };

  // Run AI code review on project
  const runAIReview = async (projectId: string) => {
    if (isDemo) {
      const project = projects.find((p) => p.id === projectId);
      if (!project) throw new Error("Project not found");
      
      const review = generateMockAIReview(project);
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? { ...p, aiReviews: [review, ...(p.aiReviews || [])], updatedAt: new Date().toISOString() }
            : p
        )
      );
      return review;
    }
    
    const res = await fetch(`/api/projects/${projectId}/ai-review`, {
      method: "POST",
    });
    if (!res.ok) throw new Error("Failed to run AI review");
    const data = await res.json();
    
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId ? { ...p, ...data.project } : p
      )
    );
    return data.review;
  };

  // Sync commits from GitHub and analyze
  const syncCommits = async (projectId: string, autoApply = false) => {
    if (isDemo) {
      const project = projects.find((p) => p.id === projectId);
      if (!project) throw new Error("Project not found");
      
      // Simulate commit sync
      const review = generateMockAIReview(project);
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? {
                ...p,
                aiReviews: [review, ...(p.aiReviews || [])],
                lastSyncedAt: new Date().toISOString(),
                commits: (p.commits || 0) + 1,
                updatedAt: new Date().toISOString(),
              }
            : p
        )
      );
      return { review, stageChanged: false };
    }
    
    const res = await fetch(`/api/projects/${projectId}/sync-commits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoApply }),
    });
    if (!res.ok) throw new Error("Failed to sync commits");
    const data = await res.json();
    
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projectId ? { ...p, ...data.project } : p
      )
    );
    return { review: data.review, stageChanged: data.stageChanged };
  };

  // Apply AI review suggestions
  const applyAIReview = async (projectId: string, review: AIReview) => {
    if (isDemo) {
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== projectId) return p;
          
          const fromStage = p.currentPhase;
          const toStage = review.recommendedStage || p.currentPhase;
          const isStageChange = fromStage !== toStage;
          
          // Create timeline event
          const timelineEvent = {
            id: `evt-${Date.now()}`,
            projectId,
            type: "stage-change" as const,
            title: isStageChange ? `Advanced to ${toStage}` : `Progress updated in ${toStage}`,
            description: `AI review ${isStageChange ? 'recommended stage change' : 'suggested progress update'}: ${review.recommendedProgress}% complete`,
            date: new Date().toISOString(),
            metadata: {
              fromStage,
              toStage,
              phaseProgress: review.recommendedProgress,
              source: "ai-review",
              sourceId: review.id,
            },
          };
          
          // Mark the applied review as no longer needing update
          const updatedReviews = (p.aiReviews || []).map((r) =>
            r.id === review.id
              ? { ...r, shouldUpdate: false, appliedAt: new Date().toISOString() }
              : r
          );
          
          return {
            ...p,
            currentPhase: toStage,
            phaseProgress: {
              ...p.phaseProgress,
              [toStage]: review.recommendedProgress,
            },
            aiReviews: updatedReviews,
            timeline: [timelineEvent, ...(p.timeline || [])],
            updatedAt: new Date().toISOString(),
          };
        })
      );
      return;
    }
    
    // Update project phase based on AI recommendation with full stage progress map
    const res = await fetch(`/api/projects/${projectId}/phase`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phase: review.recommendedStage,
        phaseProgress: review.recommendedProgress,
        phaseProgressMap: review.stageProgressMap,
        source: "ai-review",
        sourceId: review.id,
        reviewId: review.id, // Used to mark the review as applied
      }),
    });
    if (!res.ok) throw new Error("Failed to apply AI suggestions");
    const updated = await res.json();
    
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? updated : p))
    );
  };

  // Lightweight GitHub stats sync (no AI required)
  const syncGitHubStats = async (projectId: string) => {
    if (isDemo) {
      // Simulate a stats sync in demo mode
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? {
                ...p,
                commits: Math.max(p.commits || 0, Math.floor(Math.random() * 200) + 50),
                stars: Math.max(p.stars || 0, Math.floor(Math.random() * 50)),
                openIssues: Math.floor(Math.random() * 15),
                lastSyncedAt: new Date().toISOString(),
              }
            : p
        )
      );
      return;
    }

    const res = await fetch(`/api/projects/${projectId}/sync-github`, {
      method: "POST",
    });
    if (!res.ok) throw new Error("Failed to sync GitHub stats");
    const updated = await res.json();
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? updated : p))
    );
    return updated;
  };

  return {
    projects,
    loading,
    error,
    refetch: fetchProjects,
    createProject,
    updateProject,
    deleteProject,
    moveProjectPhase,
    runAIReview,
    syncCommits,
    syncGitHubStats,
    applyAIReview,
  };
}

// ---- Single Project ----

export function useProject(id: string) {
  const isDemo = useIsDemo();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProject = useCallback(async () => {
    if (isDemo) {
      const found = mockProjects.find((p) => p.id === id) || null;
      setProject(found);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) throw new Error("Failed to fetch project");
      const data = await res.json();
      setProject(data);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [id, isDemo]);

  useEffect(() => {
    if (id) fetchProject();
  }, [id, fetchProject]);

  const updateProject = async (data: Partial<Project>) => {
    if (isDemo) {
      setProject((prev) => (prev ? { ...prev, ...data, updatedAt: new Date().toISOString() } : prev));
      return { id, ...data } as Project;
    }
    const res = await fetch(`/api/projects/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed to update project");
    const updated = await res.json();
    setProject(updated);
    return updated;
  };

  const deleteProject = async () => {
    if (isDemo) {
      setProject(null);
      return;
    }
    const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Failed to delete project");
    setProject(null);
  };

  return { project, loading, error, refetch: fetchProject, updateProject, deleteProject, setProject };
}

// ---- Plan ----

export function usePlan() {
  const isDemo = useIsDemo();
  const [plan, setPlan] = useState<"free" | "trial" | "pro">("free");
  const [loading, setLoading] = useState(true);

  const fetchPlan = useCallback(async () => {
    if (isDemo) {
      setPlan("free");
      setLoading(false);
      return;
    }
    try {
      const res = await fetch("/api/admin/plan");
      if (res.ok) {
        const data = await res.json();
        const p = data.plan;
        setPlan(p === "pro" ? "pro" : p === "trial" ? "trial" : "free");
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [isDemo]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  return { plan, loading, refetch: fetchPlan };
}

// ---- Stats ----

export function useStats() {
  const isDemo = useIsDemo();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (isDemo) {
      setStats(mockStats);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await fetch("/api/projects/stats");
      if (!res.ok) throw new Error("Failed to fetch stats");
      const data = await res.json();
      setStats(data);
    } catch {
      // fallback remains null
    } finally {
      setLoading(false);
    }
  }, [isDemo]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, refetch: fetchStats };
}

// ---- Today's Top 3 Actions ----

export function useTop3Actions() {
  const isDemo = useIsDemo();
  const [actions, setActions] = useState<Top3Action[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchActions = useCallback(async () => {
    if (isDemo) {
      setActions(mockTop3Actions);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const res = await fetch("/api/ai-advisor/top3");
      if (!res.ok) throw new Error("Failed to fetch top 3");
      const data = await res.json();
      setActions(data.actions || []);
    } catch (err) {
      console.error("Top 3 fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [isDemo]);

  useEffect(() => {
    fetchActions();
  }, [fetchActions]);

  const refresh = async () => {
    if (isDemo) return;
    setRefreshing(true);
    try {
      const res = await fetch("/api/ai-advisor/top3", { method: "POST" });
      if (!res.ok) throw new Error("Failed to refresh");
      const data = await res.json();
      setActions(data.actions || []);
    } catch (err) {
      console.error("Top 3 refresh error:", err);
    } finally {
      setRefreshing(false);
    }
  };

  const markDone = async (actionId: string) => {
    if (isDemo) {
      setActions((prev) =>
        prev.map((a) =>
          a.id === actionId ? { ...a, completedAt: new Date().toISOString() } : a,
        ),
      );
      return;
    }
    try {
      const res = await fetch("/api/ai-advisor/top3", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId, completed: true }),
      });
      if (!res.ok) throw new Error("Failed to mark done");
      const data = await res.json();
      setActions(data.actions || []);
    } catch (err) {
      console.error("Top 3 mark-done error:", err);
    }
  };

  const togglePin = async (actionId: string, pinned: boolean) => {
    if (isDemo) {
      setActions((prev) =>
        prev.map((a) => (a.id === actionId ? { ...a, pinned } : a)),
      );
      return;
    }
    try {
      const res = await fetch("/api/ai-advisor/top3", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionId, pinned }),
      });
      if (!res.ok) throw new Error("Failed to toggle pin");
      const data = await res.json();
      setActions(data.actions || []);
    } catch (err) {
      console.error("Top 3 pin error:", err);
    }
  };

  return { actions, loading, refreshing, refresh, markDone, togglePin };
}
