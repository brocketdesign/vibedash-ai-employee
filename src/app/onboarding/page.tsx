"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Star,
  GitFork,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
  Github,
  Square,
  CheckSquare,
} from "lucide-react";
import { GitHubRepo, ProjectPhase } from "@/types";
import { PHASES } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface RepoWithPhase extends GitHubRepo {
  selected: boolean;
  phase: ProjectPhase;
}

const steps = [
  { id: "welcome", title: "Welcome", description: "Let's get you set up" },
  { id: "repos", title: "Select Repositories", description: "Choose your GitHub projects" },
  { id: "phases", title: "Assign Phases", description: "Set your pipeline stages" },
  { id: "complete", title: "All Set!", description: "You're ready to go" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [currentStep, setCurrentStep] = useState(0);
  const [repos, setRepos] = useState<RepoWithPhase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isLoaded && !user) {
      router.push("/login");
      return;
    }

    // Check if onboarding is already completed
    if (isLoaded && user) {
      fetch("/api/user/onboarding")
        .then((res) => res.json())
        .then((data) => {
          if (data.completed === true) {
            // Already onboarded, redirect to dashboard
            window.location.href = "/dashboard";
            return;
          }
          
          // Check if user has GitHub connected
          const githubAccount = user.externalAccounts?.find(
            (acc) => acc.provider === "github"
          );

          if (!githubAccount) {
            setError(
              "Please connect your GitHub account first. Go to Settings > Integrations."
            );
            return;
          }

          // Fetch repos
          fetchGitHubRepos();
        })
        .catch((err) => {
          console.error("Failed to check onboarding status:", err);
          // Continue anyway, let user try to onboard
          fetchGitHubRepos();
        });
    }
  }, [isLoaded, user, router]);

  const fetchGitHubRepos = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/github/repos");
      if (!response.ok) throw new Error("Failed to fetch repositories");
      const data = await response.json();
      setRepos(
        data.map((repo: GitHubRepo) => ({
          ...repo,
          selected: false,
          phase: "idea" as ProjectPhase,
        }))
      );
    } catch (err) {
      setError(
        "Could not load your GitHub repositories. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const toggleRepoSelection = (repoId: number) => {
    setRepos((prev) =>
      prev.map((repo) =>
        repo.id === repoId ? { ...repo, selected: !repo.selected } : repo
      )
    );
  };

  const updateRepoPhase = (repoId: number, phase: ProjectPhase) => {
    setRepos((prev) =>
      prev.map((repo) => (repo.id === repoId ? { ...repo, phase } : repo))
    );
  };

  const selectedRepos = repos.filter((r) => r.selected);

  const saveProjects = async () => {
    setSaving(true);
    setError(null);
    try {
      // Create projects from selected repos
      const projectsToCreate = selectedRepos.map((repo) => ({
        name: repo.name,
        description: repo.description || "",
        githubRepo: repo.full_name,
        githubUrl: repo.html_url,
        currentPhase: repo.phase,
        techStack: repo.language ? [repo.language] : [],
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        openIssues: repo.open_issues_count,
      }));

      // Create all projects and check responses
      const projectResponses = await Promise.all(
        projectsToCreate.map((project) =>
          fetch("/api/projects", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(project),
          })
        )
      );

      // Check if all project creations succeeded
      const failedProjects = projectResponses.filter((r) => !r.ok);
      if (failedProjects.length > 0) {
        throw new Error(`Failed to create ${failedProjects.length} projects`);
      }

      // Mark onboarding as complete
      const onboardingResponse = await fetch("/api/user/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: true }),
      });

      if (!onboardingResponse.ok) {
        const errorData = await onboardingResponse.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to save onboarding status");
      }

      // Move to complete step
      setCurrentStep(3);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save projects. Please try again.";
      setError(errorMessage);
      console.error("Save projects error:", err);
    } finally {
      setSaving(false);
    }
  };

  const goToDashboard = () => {
    // Use window.location for a full page navigation
    // This ensures the dashboard layout gets fresh data from the server
    window.location.href = "/dashboard";
  };

  if (!isLoaded || loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p>{error}</p>
            </div>
            <div className="flex gap-2 mt-4">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setError(null);
                  setCurrentStep(0);
                  fetchGitHubRepos();
                }}
              >
                Retry
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  window.location.href = "/dashboard";
                }}
              >
                Go to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-violet-500/5 to-background">
      <div className="mx-auto max-w-4xl px-4 py-12">
        {/* Progress Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border-2 font-semibold text-sm transition-colors",
                    index < currentStep &&
                      "border-violet-500 bg-violet-500 text-white",
                    index === currentStep &&
                      "border-violet-500 text-violet-500",
                    index > currentStep && "border-muted text-muted-foreground"
                  )}
                >
                  {index < currentStep ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    index + 1
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      "h-0.5 w-24 mx-2 transition-colors",
                      index < currentStep ? "bg-violet-500" : "bg-muted"
                    )}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold">{steps[currentStep].title}</h1>
            <p className="text-muted-foreground">
              {steps[currentStep].description}
            </p>
          </div>
        </div>

        {/* Step 1: Welcome */}
        {currentStep === 0 && (
          <div className="transition-all duration-300">
            <Card className="border-2">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-violet-500/10">
                  <Github className="h-10 w-10 text-violet-500" />
                </div>
                <CardTitle className="text-3xl">Welcome to VibeDash!</CardTitle>
                <CardDescription className="text-lg">
                  Let&apos;s connect your GitHub repositories and get your
                  projects organized.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-xl border p-4 text-center">
                    <div className="mb-2 text-2xl">1</div>
                    <p className="font-medium">Select Repos</p>
                    <p className="text-sm text-muted-foreground">
                      Choose from your GitHub
                    </p>
                  </div>
                  <div className="rounded-xl border p-4 text-center">
                    <div className="mb-2 text-2xl">2</div>
                    <p className="font-medium">Assign Phases</p>
                    <p className="text-sm text-muted-foreground">
                      Set pipeline stages
                    </p>
                  </div>
                  <div className="rounded-xl border p-4 text-center">
                    <div className="mb-2 text-2xl">3</div>
                    <p className="font-medium">Start Tracking</p>
                    <p className="text-sm text-muted-foreground">
                      Monitor progress
                    </p>
                  </div>
                </div>
                <Button
                  size="lg"
                  className="w-full"
                  onClick={() => setCurrentStep(1)}
                >
                  Get Started
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 2: Select Repos */}
        {currentStep === 1 && (
          <div className="transition-all duration-300">
            <Card>
              <CardHeader>
                <CardTitle>Select Your GitHub Repositories</CardTitle>
                <CardDescription>
                  Choose the projects you want to track in VibeDash (
                  {selectedRepos.length} selected)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {repos.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No repositories found. Make sure your GitHub account is
                      connected.
                    </p>
                  ) : (
                    repos.map((repo) => (
                      <div
                        key={repo.id}
                        className={cn(
                          "flex items-start gap-3 rounded-xl border p-4 transition-colors cursor-pointer hover:border-violet-500/50",
                          repo.selected &&
                            "border-violet-500 bg-violet-500/5"
                        )}
                        onClick={() => toggleRepoSelection(repo.id)}
                      >
                        <div className="mt-0.5 shrink-0">
                          {repo.selected ? (
                            <CheckSquare className="h-5 w-5 text-violet-500" />
                          ) : (
                            <Square className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold truncate">
                              {repo.name}
                            </h3>
                            {repo.language && (
                              <Badge
                                variant="secondary"
                                className="shrink-0"
                              >
                                {repo.language}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                            {repo.description || "No description"}
                          </p>
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Star className="h-3 w-3" />
                              {repo.stargazers_count}
                            </span>
                            <span className="flex items-center gap-1">
                              <GitFork className="h-3 w-3" />
                              {repo.forks_count}
                            </span>
                            <span>{repo.open_issues_count} issues</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex justify-between mt-6">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep(0)}
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    onClick={() => setCurrentStep(2)}
                    disabled={selectedRepos.length === 0}
                  >
                    Continue
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 3: Assign Phases */}
        {currentStep === 2 && (
          <div className="transition-all duration-300">
            <Card>
              <CardHeader>
                <CardTitle>Assign Pipeline Phases</CardTitle>
                <CardDescription>
                  Choose which phase each project is currently in
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                  {selectedRepos.map((repo) => (
                    <div key={repo.id} className="rounded-xl border p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold">{repo.name}</h3>
                        <Badge variant="outline">
                          {repo.language || "Unknown"}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {PHASES.map((phase) => (
                          <button
                            key={phase.id}
                            onClick={() =>
                              updateRepoPhase(repo.id, phase.id)
                            }
                            className={cn(
                              "rounded-lg border p-2 text-xs text-center transition-colors",
                              repo.phase === phase.id
                                ? "border-violet-500 bg-violet-500/10 text-violet-500"
                                : "hover:border-violet-500/50"
                            )}
                          >
                            <div className="font-medium">{phase.label}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between mt-6">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep(1)}
                  >
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    onClick={saveProjects}
                    disabled={saving}
                    className="bg-gradient-to-r from-violet-500 to-indigo-500"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        Complete Setup
                        <Check className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 4: Complete */}
        {currentStep === 3 && (
          <div className="transition-all duration-300">
            <Card className="border-2 border-violet-500/50">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-violet-500/10">
                  <Check className="h-10 w-10 text-violet-500" />
                </div>
                <CardTitle className="text-3xl">You&apos;re All Set!</CardTitle>
                <CardDescription className="text-lg">
                  Your {selectedRepos.length} projects have been added to
                  VibeDash.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-xl bg-muted p-4">
                  <h3 className="font-semibold mb-2">What&apos;s Next?</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-violet-500" />
                      Track your project progress through the pipeline
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-violet-500" />
                      Monitor GitHub activity and commits
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-violet-500" />
                      Get AI-powered insights and recommendations
                    </li>
                  </ul>
                </div>
                <Button
                  size="lg"
                  className="w-full bg-gradient-to-r from-violet-500 to-indigo-500"
                  onClick={goToDashboard}
                >
                  Go to Dashboard
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
