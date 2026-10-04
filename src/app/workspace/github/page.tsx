"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useProjects } from "@/lib/hooks";
import { Project } from "@/types";
import { NewProjectDialog } from "@/components/dashboard/new-project-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  GitBranch,
  GitCommit,
  Star,
  AlertCircle,
  ExternalLink,
  Globe,
  RefreshCcw,
  Clock,
  CheckCircle2,
  Link2,
  Loader2,
  Plus,
  Unlink,
  Database,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export default function GitHubPage() {
  const { projects, loading, createProject, updateProject, refetch } =
    useProjects();

  const [connectOpen, setConnectOpen] = useState(false);
  const [repoUrl, setRepoUrl] = useState("");
  const [connectingProjectId, setConnectingProjectId] = useState<string | null>(
    null
  );
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const hasSynced = useRef(false);

  const connectedProjects = projects.filter((p) => p.githubRepo);
  const unconnectedProjects = projects.filter((p) => !p.githubRepo);

  const totalCommits = connectedProjects.reduce((a, p) => a + (p.commits || 0), 0);
  const totalStars = connectedProjects.reduce((a, p) => a + (p.stars || 0), 0);
  const totalIssues = connectedProjects.reduce(
    (a, p) => a + (p.openIssues || 0),
    0
  );

  // Sync GitHub stats for a single project (lightweight, no AI required)
  const syncProjectGitHub = useCallback(async (projectId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/sync-github`, {
        method: "POST",
      });
      if (!res.ok) {
        console.error(`Failed to sync GitHub stats for project ${projectId}`);
      }
    } catch (err) {
      console.error("GitHub sync error:", err);
    }
  }, []);

  // Sync all connected projects
  const handleSyncAll = useCallback(async () => {
    setSyncing(true);
    try {
      const connected = projects.filter((p) => p.githubRepo);
      await Promise.allSettled(
        connected.map((p) => syncProjectGitHub(p.id))
      );
      await refetch();
    } catch (err) {
      console.error("Sync all error:", err);
    } finally {
      setSyncing(false);
    }
  }, [projects, syncProjectGitHub, refetch]);

  // Auto-sync on first load when there are connected projects with no data
  useEffect(() => {
    if (!loading && !hasSynced.current && connectedProjects.length > 0) {
      const needsSync = connectedProjects.some(
        (p) => !p.lastSyncedAt || p.commits === 0
      );
      if (needsSync) {
        hasSynced.current = true;
        handleSyncAll();
      }
    }
  }, [loading, connectedProjects, handleSyncAll]);

  const handleConnectRepo = async (projectId: string, repo: string) => {
    setConnecting(true);
    try {
      const repoPath = repo
        .replace("https://github.com/", "")
        .replace(/\/$/, "");
      await updateProject(projectId, {
        githubRepo: repoPath,
        githubUrl: `https://github.com/${repoPath}`,
      });
      setConnectOpen(false);
      setRepoUrl("");
      setConnectingProjectId(null);

      // Sync GitHub stats immediately after connecting
      await syncProjectGitHub(projectId);
      await refetch();
    } catch (err) {
      console.error("Failed to connect repo:", err);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnectRepo = async (projectId: string) => {
    try {
      await updateProject(projectId, {
        githubRepo: "",
        githubUrl: "",
        commits: 0,
        stars: 0,
        openIssues: 0,
        lastCommit: undefined,
        lastSyncedAt: undefined,
      });
    } catch (err) {
      console.error("Failed to disconnect repo:", err);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            GitHub Integration
          </h1>
          <p className="text-sm text-muted-foreground">
            Monitor all your repositories and development activity
          </p>
        </div>
        <div className="flex gap-2">
          {projects.length === 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 rounded-xl"
              onClick={handleSeedData}
            >
              <Database className="h-3.5 w-3.5" />
              Seed Data
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-2 rounded-xl"
            onClick={handleSyncAll}
            disabled={syncing}
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing..." : "Sync All"}
          </Button>
          <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                className="gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white"
              >
                <Link2 className="h-3.5 w-3.5" />
                Connect Repo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Connect GitHub Repository</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                {unconnectedProjects.length > 0 ? (
                  <>
                    <div className="space-y-2">
                      <Label>Select Project</Label>
                      <div className="space-y-2">
                        {unconnectedProjects.map((p) => (
                          <div
                            key={p.id}
                            className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all ${
                              connectingProjectId === p.id
                                ? "border-violet-500 bg-violet-500/5"
                                : "border-border hover:border-violet-500/50"
                            }`}
                            onClick={() => setConnectingProjectId(p.id)}
                          >
                            <div
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: p.color }}
                            />
                            <div>
                              <p className="text-sm font-medium">{p.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {p.description}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Repository URL or path</Label>
                      <Input
                        placeholder="username/repo-name or https://github.com/..."
                        value={repoUrl}
                        onChange={(e) => setRepoUrl(e.target.value)}
                        className="rounded-xl"
                      />
                    </div>
                    <Button
                      className="w-full gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white"
                      disabled={
                        !connectingProjectId || !repoUrl.trim() || connecting
                      }
                      onClick={() =>
                        connectingProjectId &&
                        handleConnectRepo(connectingProjectId, repoUrl)
                      }
                    >
                      {connecting && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      Connect Repository
                    </Button>
                  </>
                ) : (
                  <div className="text-center py-6">
                    <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
                    <p className="text-sm font-medium">
                      All projects are connected!
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Create a new project to connect a repository
                    </p>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Overview stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
              <GitBranch className="h-5 w-5 text-violet-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Repositories</p>
              <p className="text-xl font-bold">{connectedProjects.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10">
              <GitCommit className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Commits</p>
              <p className="text-xl font-bold">
                {totalCommits.toLocaleString()}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-500/10">
              <Star className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Stars</p>
              <p className="text-xl font-bold">{totalStars}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 pt-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
              <AlertCircle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Open Issues</p>
              <p className="text-xl font-bold">{totalIssues}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Connected repositories */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">
          Connected Repositories ({connectedProjects.length})
        </h2>
        {connectedProjects.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <GitBranch className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm font-medium">No repositories connected</p>
              <p className="text-xs text-muted-foreground">
                Connect a GitHub repo to start tracking
              </p>
            </CardContent>
          </Card>
        ) : (
          connectedProjects.map((project) => (
            <Card
              key={project.id}
              className="transition-all hover:shadow-md"
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div
                      className="mt-1 h-3 w-3 rounded-full"
                      style={{ backgroundColor: project.color }}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold">
                          {project.name}
                        </h3>
                        <a
                          href={project.githubUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-violet-500 hover:underline"
                        >
                          {project.githubRepo}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {project.description}
                      </p>

                      {/* Tech stack */}
                      {project.techStack?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {project.techStack.map((tech) => (
                            <Badge
                              key={tech}
                              variant="outline"
                              className="text-[10px] font-normal"
                            >
                              {tech}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Stats row */}
                      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <GitCommit className="h-3 w-3" />
                          {project.commits || 0} commits
                        </span>
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3" />
                          {project.stars || 0} stars
                        </span>
                        <span className="flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" />
                          {project.openIssues || 0} issues
                        </span>
                        {project.domain && (
                          <span className="flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            {project.domain}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="gap-1 border-green-500/30 text-green-500"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Connected
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-red-500"
                      onClick={() => handleDisconnectRepo(project.id)}
                    >
                      <Unlink className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Last commit */}
                {project.lastCommit && (
                  <>
                    <Separator className="my-4" />
                    <div className="flex items-center gap-3 rounded-lg bg-muted/50 px-3 py-2">
                      <GitCommit className="h-4 w-4 shrink-0 text-violet-500" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs">
                          <span className="font-mono text-violet-500">
                            {project.lastCommit.sha}
                          </span>{" "}
                          <span className="font-medium">
                            {project.lastCommit.message}
                          </span>
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(
                          new Date(project.lastCommit.date),
                          { addSuffix: true }
                        )}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Unconnected projects */}
      {unconnectedProjects.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">
            Projects Without Repos ({unconnectedProjects.length})
          </h2>
          {unconnectedProjects.map((project) => (
            <Card key={project.id} className="border-dashed">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: project.color }}
                    />
                    <div>
                      <h3 className="text-sm font-semibold">{project.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        {project.description}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 rounded-xl"
                    onClick={() => {
                      setConnectingProjectId(project.id);
                      setConnectOpen(true);
                    }}
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    Connect
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
