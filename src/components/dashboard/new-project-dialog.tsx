"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PHASES, generateDefaultPhaseSubTasks, generateDefaultPhaseProgress } from "@/lib/constants";
import { ProjectPhase, Project, GitHubRepo } from "@/types";
import { Plus, X, Loader2, Github, Search, Star, GitFork, Check } from "lucide-react";

const PROJECT_COLORS = [
  "#8B5CF6",
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EC4899",
  "#EF4444",
  "#06B6D4",
  "#F97316",
];

interface NewProjectDialogProps {
  onProjectCreated: (project: Partial<Project>) => Promise<unknown>;
  trigger?: React.ReactNode;
}

export function NewProjectDialog({
  onProjectCreated,
  trigger,
}: NewProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("github");

  // GitHub repos state
  const [githubRepos, setGithubRepos] = useState<GitHubRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [reposError, setReposError] = useState<string | null>(null);
  const [repoSearch, setRepoSearch] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [githubRepo, setGithubRepo] = useState("");
  const [techStackInput, setTechStackInput] = useState("");
  const [techStack, setTechStack] = useState<string[]>([]);
  const [currentPhase, setCurrentPhase] = useState<ProjectPhase>("idea");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [domain, setDomain] = useState("");

  // Fetch unsynced GitHub repos when dialog opens
  useEffect(() => {
    if (open) {
      fetchUnsyncedRepos();
    }
  }, [open]);

  const fetchUnsyncedRepos = async () => {
    setLoadingRepos(true);
    setReposError(null);
    try {
      const res = await fetch("/api/github/repos/unsynced");
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch repos");
      }
      const repos = await res.json();
      setGithubRepos(repos);
    } catch (err) {
      setReposError(err instanceof Error ? err.message : "Failed to load repos");
    } finally {
      setLoadingRepos(false);
    }
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setGithubRepo("");
    setTechStackInput("");
    setTechStack([]);
    setCurrentPhase("idea");
    setPriority("medium");
    setColor(PROJECT_COLORS[0]);
    setDomain("");
    setSelectedRepo(null);
    setRepoSearch("");
    setActiveTab("github");
  };

  const selectGitHubRepo = (repo: GitHubRepo) => {
    setSelectedRepo(repo);
    setName(repo.name);
    setDescription(repo.description || "");
    setGithubRepo(repo.full_name);
    // Pre-fill tech stack from language & topics
    const stack: string[] = [];
    if (repo.language) stack.push(repo.language);
    if (repo.topics) {
      repo.topics.forEach((t) => {
        if (!stack.includes(t)) stack.push(t);
      });
    }
    setTechStack(stack);
    // Switch to details tab so user can review / adjust
    setActiveTab("details");
  };

  const deselectRepo = () => {
    setSelectedRepo(null);
    setName("");
    setDescription("");
    setGithubRepo("");
    setTechStack([]);
  };

  const addTech = () => {
    const trimmed = techStackInput.trim();
    if (trimmed && !techStack.includes(trimmed)) {
      setTechStack([...techStack, trimmed]);
      setTechStackInput("");
    }
  };

  const removeTech = (tech: string) => {
    setTechStack(techStack.filter((t) => t !== tech));
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;

    setSaving(true);
    try {
      const phaseSubTasks = generateDefaultPhaseSubTasks();
      const phaseProgress = generateDefaultPhaseProgress();
      phaseProgress[currentPhase] = 10;

      await onProjectCreated({
        name: name.trim(),
        description: description.trim(),
        githubRepo: githubRepo.trim(),
        githubUrl: githubRepo.trim()
          ? `https://github.com/${githubRepo.trim()}`
          : "",
        techStack,
        currentPhase,
        phaseProgress,
        phaseSubTasks,
        priority,
        color,
        domain: domain.trim(),
        status: "active",
        autoUpdateEnabled: true,
        timeline: [{
          id: `evt-${Date.now()}`,
          projectId: "temp",
          type: "creation",
          title: "Project Created",
          description: `Project started in ${PHASES.find(p => p.id === currentPhase)?.label} stage`,
          date: new Date().toISOString(),
        }],
        aiReviews: [],
      });
      resetForm();
      setOpen(false);
    } catch (err) {
      console.error("Failed to create project:", err);
    } finally {
      setSaving(false);
    }
  };

  const filteredRepos = githubRepos.filter(
    (repo) =>
      repo.name.toLowerCase().includes(repoSearch.toLowerCase()) ||
      repo.full_name.toLowerCase().includes(repoSearch.toLowerCase()) ||
      (repo.description || "").toLowerCase().includes(repoSearch.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/25">
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="github" className="gap-2">
              <Github className="h-4 w-4" />
              Import from GitHub
            </TabsTrigger>
            <TabsTrigger value="details" className="gap-2">
              <Plus className="h-4 w-4" />
              {selectedRepo ? "Project Details" : "Manual Entry"}
            </TabsTrigger>
          </TabsList>

          {/* GitHub Import Tab */}
          <TabsContent value="github" className="space-y-3 pt-2">
            {selectedRepo ? (
              <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-violet-500" />
                    <span className="text-sm font-medium">{selectedRepo.full_name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={deselectRepo}
                  >
                    Change
                  </Button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Selected — switch to &quot;Project Details&quot; tab to customize and create.
                </p>
              </div>
            ) : (
              <>
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search your repositories..."
                    value={repoSearch}
                    onChange={(e) => setRepoSearch(e.target.value)}
                    className="pl-9 rounded-xl"
                  />
                </div>

                {/* Repos list */}
                {loadingRepos ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
                    <span className="text-sm text-muted-foreground">Loading your GitHub repos...</span>
                  </div>
                ) : reposError ? (
                  <div className="rounded-xl border border-dashed border-orange-500/30 bg-orange-500/5 p-6 text-center">
                    <Github className="mx-auto h-8 w-8 text-orange-500/60 mb-2" />
                    <p className="text-sm font-medium text-orange-600 dark:text-orange-400">{reposError}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Connect your GitHub account in Settings, or use &quot;Manual Entry&quot; instead.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 rounded-xl"
                      onClick={() => setActiveTab("details")}
                    >
                      Enter Manually
                    </Button>
                  </div>
                ) : filteredRepos.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border/50 p-6 text-center">
                    <p className="text-sm text-muted-foreground">
                      {repoSearch
                        ? "No matching repositories found."
                        : "All your GitHub repos are already synced!"}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 rounded-xl"
                      onClick={() => setActiveTab("details")}
                    >
                      Create Manually
                    </Button>
                  </div>
                ) : (
                  <ScrollArea className="h-[340px]">
                    <div className="space-y-2 pr-3">
                      {filteredRepos.map((repo) => (
                        <button
                          key={repo.id}
                          onClick={() => selectGitHubRepo(repo)}
                          className="w-full text-left rounded-xl border border-border bg-card p-3 transition-all hover:border-violet-500/40 hover:shadow-md hover:shadow-violet-500/5 hover:-translate-y-0.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <Github className="h-4 w-4 shrink-0 text-muted-foreground" />
                                <span className="text-sm font-semibold truncate">
                                  {repo.full_name}
                                </span>
                              </div>
                              {repo.description && (
                                <p className="mt-1 text-xs text-muted-foreground line-clamp-2 ml-6">
                                  {repo.description}
                                </p>
                              )}
                              <div className="mt-2 flex items-center gap-3 ml-6">
                                {repo.language && (
                                  <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                                    {repo.language}
                                  </Badge>
                                )}
                                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                  <Star className="h-3 w-3" />
                                  {repo.stargazers_count}
                                </span>
                                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                  <GitFork className="h-3 w-3" />
                                  {repo.forks_count}
                                </span>
                              </div>
                              {repo.topics && repo.topics.length > 0 && (
                                <div className="mt-1.5 flex flex-wrap gap-1 ml-6">
                                  {repo.topics.slice(0, 4).map((topic) => (
                                    <Badge
                                      key={topic}
                                      variant="outline"
                                      className="h-4 px-1.5 text-[9px]"
                                    >
                                      {topic}
                                    </Badge>
                                  ))}
                                  {repo.topics.length > 4 && (
                                    <span className="text-[9px] text-muted-foreground">
                                      +{repo.topics.length - 4} more
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                            <Plus className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </>
            )}
          </TabsContent>

          {/* Details / Manual Entry Tab */}
          <TabsContent value="details" className="space-y-4 pt-2">
            {/* Selected repo banner */}
            {selectedRepo && (
              <div className="flex items-center gap-2 rounded-xl border border-violet-500/20 bg-violet-500/5 px-3 py-2">
                <Github className="h-4 w-4 text-violet-500 shrink-0" />
                <span className="text-xs font-medium truncate">
                  Importing from {selectedRepo.full_name}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-6 text-xs px-2"
                  onClick={deselectRepo}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}

            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Project Name *</Label>
              <Input
                id="name"
                placeholder="My Awesome Project"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-xl"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="desc">Description</Label>
              <Textarea
                id="desc"
                placeholder="Brief description of your project"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[80px] rounded-xl"
              />
            </div>

            {/* GitHub Repo */}
            <div className="space-y-2">
              <Label htmlFor="repo">GitHub Repository</Label>
              <Input
                id="repo"
                placeholder="username/repo-name"
                value={githubRepo}
                onChange={(e) => setGithubRepo(e.target.value)}
                className="rounded-xl"
                readOnly={!!selectedRepo}
              />
            </div>

            {/* Domain */}
            <div className="space-y-2">
              <Label htmlFor="domain">Domain (optional)</Label>
              <Input
                id="domain"
                placeholder="myproject.com"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="rounded-xl"
              />
            </div>

            {/* Tech Stack */}
            <div className="space-y-2">
              <Label>Tech Stack</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. Next.js"
                  value={techStackInput}
                  onChange={(e) => setTechStackInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTech();
                    }
                  }}
                  className="rounded-xl"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={addTech}
                  className="rounded-xl"
                >
                  Add
                </Button>
              </div>
              {techStack.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {techStack.map((tech) => (
                    <Badge
                      key={tech}
                      variant="secondary"
                      className="gap-1 rounded-full"
                    >
                      {tech}
                      <X
                        className="h-3 w-3 cursor-pointer"
                        onClick={() => removeTech(tech)}
                      />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Phase & Priority row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Starting Phase</Label>
                <Select
                  value={currentPhase}
                  onValueChange={(v) => setCurrentPhase(v as ProjectPhase)}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PHASES.map((phase) => (
                      <SelectItem key={phase.id} value={phase.id}>
                        {phase.icon} {phase.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {/* Show suggested subtasks for selected phase */}
                <div className="mt-2 rounded-lg bg-muted/50 p-3">
                  <p className="text-xs font-medium mb-2 text-muted-foreground">
                    Suggested checklist for this stage:
                  </p>
                  <ul className="space-y-1">
                    {PHASES.find(p => p.id === currentPhase)?.subTasks.slice(0, 3).map((task, i) => (
                      <li key={i} className="text-xs flex items-start gap-1.5">
                        <span className="text-violet-500 mt-0.5">○</span>
                        <span className="text-muted-foreground">{task}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={priority}
                  onValueChange={(v) =>
                    setPriority(v as "low" | "medium" | "high" | "critical")
                  }
                >
                  <SelectTrigger className="rounded-xl">
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

            {/* Color */}
            <div className="space-y-2">
              <Label>Project Color</Label>
              <div className="flex gap-2">
                {PROJECT_COLORS.map((c) => (
                  <button
                    key={c}
                    className={`h-7 w-7 rounded-full border-2 transition-all ${
                      color === c
                        ? "border-white scale-110 shadow-lg"
                        : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>

            {/* Submit */}
            <Button
              className="w-full gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white"
              onClick={handleSubmit}
              disabled={!name.trim() || saving}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Creating..." : selectedRepo ? "Import & Create Project" : "Create Project"}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
