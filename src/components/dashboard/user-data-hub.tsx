"use client";

import { useState, useEffect, useCallback } from "react";
import { useProjects } from "@/lib/hooks";
import { Project, UserDataViewConfig } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Link2, RefreshCw, Sparkles, Loader2, ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { toast } from "sonner";

interface ProjectUserStatus {
  projectId: string;
  connected: boolean;
  externalApiUrl?: string;
  lastFetchedAt?: string;
  hasView: boolean;
  totalUsers?: number;
  premiumUsers?: number;
}

function resolvePath(data: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((obj, key) => {
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      return (obj as Record<string, unknown>)[key];
    }
    return undefined;
  }, data);
}

function ProjectUserCard({
  project,
  status,
  onFetch,
}: {
  project: Project;
  status: ProjectUserStatus | undefined;
  onFetch: (projectId: string) => void;
}) {
  const [isFetching, setIsFetching] = useState(false);

  const handleFetch = async () => {
    setIsFetching(true);
    try {
      onFetch(project.id);
    } finally {
      setIsFetching(false);
    }
  };

  return (
    <Card className="group hover:border-violet-500/30 transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: project.color || "#8b5cf6" }}
            />
            <CardTitle className="text-sm font-semibold">{project.name}</CardTitle>
          </div>
          {status?.connected ? (
            <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-[10px]">
              Connected
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] text-muted-foreground">
              Not connected
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {status?.connected ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-muted/50 p-3 text-center">
                <p className="text-xl font-bold">
                  {status.totalUsers !== undefined ? status.totalUsers.toLocaleString() : "—"}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Total Users</p>
              </div>
              <div className="rounded-xl bg-muted/50 p-3 text-center">
                <p className="text-xl font-bold">
                  {status.premiumUsers !== undefined ? status.premiumUsers.toLocaleString() : "—"}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Premium</p>
              </div>
            </div>
            {status.lastFetchedAt && (
              <p className="text-[10px] text-muted-foreground">
                Last fetched {formatDistanceToNow(new Date(status.lastFetchedAt), { addSuffix: true })}
              </p>
            )}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-xl flex-1"
                disabled={isFetching}
                onClick={handleFetch}
              >
                {isFetching ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Refresh
              </Button>
              <Link href={`/workspace/projects/${project.id}?tab=users`} className="flex-1">
                <Button variant="outline" size="sm" className="gap-1.5 rounded-xl w-full">
                  <ChevronRight className="h-3.5 w-3.5" />
                  View
                </Button>
              </Link>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center py-4 text-center">
            <Users className="h-8 w-8 text-muted-foreground/20 mb-2" />
            <p className="text-xs text-muted-foreground mb-3">
              Connect to track user metrics
            </p>
            <Link href={`/workspace/projects/${project.id}?tab=users`}>
              <Button size="sm" variant="outline" className="gap-1.5 rounded-xl">
                <Link2 className="h-3.5 w-3.5" />
                Set up
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function UserDataHub() {
  const { projects, loading } = useProjects();
  const [statuses, setStatuses] = useState<Record<string, ProjectUserStatus>>({});
  const [isLoadingStatuses, setIsLoadingStatuses] = useState(true);
  const [tokenInfo, setTokenInfo] = useState<{ hasToken: boolean; tokenPrefix?: string; createdAt?: string } | null>(null);
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);
  const [rawToken, setRawToken] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

  const loadTokenInfo = useCallback(async () => {
    const res = await fetch("/api/user/connection-token");
    if (res.ok) setTokenInfo(await res.json());
  }, []);

  const loadStatuses = useCallback(async (projectList: Project[]) => {
    if (projectList.length === 0) {
      setIsLoadingStatuses(false);
      return;
    }
    const results = await Promise.allSettled(
      projectList.map((p) =>
        fetch(`/api/projects/${p.id}/user-data`).then((r) => r.json())
      )
    );

    const map: Record<string, ProjectUserStatus> = {};
    results.forEach((result, i) => {
      const p = projectList[i];
      if (result.status === "fulfilled") {
        const d = result.value;
        const totalUsers = d.cachedData
          ? Number(resolvePath(d.cachedData, "summary.totalUsers") ?? undefined)
          : undefined;
        const premiumUsers = d.cachedData
          ? Number(resolvePath(d.cachedData, "summary.premiumUsers") ?? undefined)
          : undefined;
        map[p.id] = {
          projectId: p.id,
          connected: d.connected,
          externalApiUrl: d.externalApiUrl,
          lastFetchedAt: d.lastFetchedAt,
          hasView: !!d.viewConfig,
          totalUsers: isNaN(totalUsers as number) ? undefined : (totalUsers as number),
          premiumUsers: isNaN(premiumUsers as number) ? undefined : (premiumUsers as number),
        };
      }
    });
    setStatuses(map);
    setIsLoadingStatuses(false);
  }, []);

  useEffect(() => {
    loadTokenInfo();
  }, [loadTokenInfo]);

  useEffect(() => {
    if (!loading) loadStatuses(projects);
  }, [loading, projects, loadStatuses]);

  const handleGenerateToken = async () => {
    setIsGeneratingToken(true);
    try {
      const res = await fetch("/api/user/connection-token", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setRawToken(data.token);
      setTokenInfo({ hasToken: true, tokenPrefix: data.tokenPrefix, createdAt: data.createdAt });
      toast.success("Token generated!", { description: "Copy it now — it won't be shown again." });
    } catch (err) {
      toast.error("Failed to generate token", { description: (err as Error).message });
    } finally {
      setIsGeneratingToken(false);
    }
  };

  const handleCopyToken = async () => {
    if (!rawToken) return;
    await navigator.clipboard.writeText(rawToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleFetch = async (projectId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/user-data/fetch`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // Re-load status for this project
      const statusRes = await fetch(`/api/projects/${projectId}/user-data`);
      if (statusRes.ok) {
        const d = await statusRes.json();
        const totalUsers = d.cachedData
          ? Number(resolvePath(d.cachedData, "summary.totalUsers") ?? undefined)
          : undefined;
        const premiumUsers = d.cachedData
          ? Number(resolvePath(d.cachedData, "summary.premiumUsers") ?? undefined)
          : undefined;
        setStatuses((prev) => ({
          ...prev,
          [projectId]: {
            ...prev[projectId],
            lastFetchedAt: d.lastFetchedAt,
            cachedData: d.cachedData,
            totalUsers: isNaN(totalUsers as number) ? undefined : (totalUsers as number),
            premiumUsers: isNaN(premiumUsers as number) ? undefined : (premiumUsers as number),
          },
        }));
      }
      toast.success("Data refreshed");
    } catch (err) {
      toast.error("Fetch failed", { description: (err as Error).message });
    }
  };

  const connectedCount = Object.values(statuses).filter((s) => s.connected).length;

  return (
    <div className="space-y-6">
      {/* Account token card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-violet-500" />
                VibeDash Connection Token
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                One token for all your projects. Add it as{" "}
                <code className="bg-muted px-1 rounded">VIBEDASH_TOKEN</code> in each project&apos;s env.
              </p>
            </div>
            <Button
              size="sm"
              variant={tokenInfo?.hasToken ? "outline" : "default"}
              className="gap-1.5 rounded-xl"
              disabled={isGeneratingToken}
              onClick={handleGenerateToken}
            >
              {isGeneratingToken ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {tokenInfo?.hasToken ? "Regenerate" : "Generate Token"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {rawToken ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
                <code className="flex-1 text-xs break-all font-mono">{rawToken}</code>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 rounded-lg shrink-0"
                  onClick={handleCopyToken}
                >
                  {copiedToken ? (
                    <span className="text-xs text-green-600">✓</span>
                  ) : (
                    <span className="text-xs">⎘</span>
                  )}
                </Button>
              </div>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                ⚠ Copy this token now — it will not be shown again.
              </p>
            </div>
          ) : tokenInfo?.hasToken ? (
            <div className="flex items-center gap-3 rounded-xl bg-muted/40 px-3 py-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <code className="text-xs text-muted-foreground">{tokenInfo.tokenPrefix}</code>
              {tokenInfo.createdAt && (
                <span className="text-[10px] text-muted-foreground ml-auto">
                  Created {formatDistanceToNow(new Date(tokenInfo.createdAt), { addSuffix: true })}
                </span>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No token yet. Click <strong>Generate Token</strong> to create one.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Stats summary */}
      <div className="flex items-center gap-4">
        <div>
          <p className="text-2xl font-bold">{connectedCount}</p>
          <p className="text-xs text-muted-foreground">Projects connected</p>
        </div>
        <div className="h-8 w-px bg-border" />
        <div>
          <p className="text-2xl font-bold">{projects.length}</p>
          <p className="text-xs text-muted-foreground">Total projects</p>
        </div>
      </div>

      {/* Projects grid */}
      {loading || isLoadingStatuses ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <Users className="h-12 w-12 text-muted-foreground/20 mb-4" />
          <p className="text-sm text-muted-foreground">No projects yet</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectUserCard
              key={project.id}
              project={project}
              status={statuses[project.id]}
              onFetch={handleFetch}
            />
          ))}
        </div>
      )}
    </div>
  );
}
