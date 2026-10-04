"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { PHASE_MAP, PRIORITY_COLORS, STATUS_COLORS, LEGACY_PHASE_MAP } from "@/lib/constants";
import { Project, AIReview } from "@/types";
import { cn } from "@/lib/utils";
import {
  GitBranch,
  Star,
  ExternalLink,
  ArrowRight,
  GitCommit,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Clock,
  CheckCircle,
} from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { AIReviewModal } from "./ai-review-modal";
import { DomainLinkButton } from "./domain-link-button";
import { useProjects } from "@/lib/hooks";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface ProjectCardProps {
  project: Project;
  compact?: boolean;
}

export function ProjectCard({ project, compact = false }: ProjectCardProps) {
  // Handle legacy phases by mapping them to new 6-stage pipeline
  const mappedPhase = LEGACY_PHASE_MAP[project.currentPhase] || project.currentPhase;
  const phase = PHASE_MAP[mappedPhase] || PHASE_MAP["idea"];
  const totalProgress = Object.values(project.phaseProgress || {}).reduce(
    (a, b) => a + b,
    0
  );
  const overallProgress = Math.round(totalProgress / 6); // Updated for 6 stages
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const { runAIReview, syncCommits, applyAIReview, updateProject, refetch } = useProjects();
  const [isReviewLoading, setIsReviewLoading] = useState(false);
  const [isSyncLoading, setIsSyncLoading] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isPriorityUpdating, setIsPriorityUpdating] = useState(false);

  const handlePriorityChange = async (newPriority: string) => {
    if (newPriority === project.priority) return;
    setIsPriorityUpdating(true);
    try {
      await updateProject(project.id, { priority: newPriority as Project["priority"] });
      toast.success(`Priority updated to ${newPriority}`);
    } catch (error) {
      console.error("Failed to update priority:", error);
      toast.error("Failed to update priority");
    } finally {
      setIsPriorityUpdating(false);
    }
  };

  // Calculate days since last activity
  const lastActivity = project.lastSyncedAt || project.updatedAt;
  const daysSinceActivity = Math.floor(
    (Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24)
  );
  const isStale = daysSinceActivity > 7;

  // Get latest AI review
  const latestReview = project.aiReviews?.[0];
  const hasReview = !!latestReview;

  const handleRunReview = async (): Promise<AIReview | null> => {
    setIsReviewLoading(true);
    try {
      const review = await runAIReview(project.id);
      return review;
    } catch (error) {
      console.error("Failed to run AI review:", error);
      return null;
    } finally {
      setIsReviewLoading(false);
    }
  };

  const handleSyncCommits = async () => {
    setIsSyncLoading(true);
    try {
      await syncCommits(project.id, false);
    } finally {
      setIsSyncLoading(false);
    }
  };

  const handleApplyReview = async (review: typeof latestReview) => {
    if (!review) return;
    
    setIsApplying(true);
    try {
      await applyAIReview(project.id, review);
      // Force refetch to ensure UI updates with latest data
      await refetch();
      toast.success(`AI update applied to ${project.name}`, {
        description: review.recommendedStage
          ? `Stage set to ${review.recommendedStage} at ${review.recommendedProgress}%`
          : `Progress updated to ${review.recommendedProgress}%`,
      });
    } catch (error) {
      console.error("Failed to apply AI review:", error);
      toast.error("Failed to apply AI update", {
        description: "Please try again or check the console for details.",
      });
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Card className="group relative overflow-hidden transition-all duration-200 hover:shadow-lg hover:shadow-violet-500/5">
      {/* Top color bar */}
      <div
        className="absolute left-0 right-0 top-0 h-1"
        style={{ backgroundColor: project.color }}
      />

      <CardHeader className="pb-3 pt-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: project.color }}
              />
              <CardTitle className="text-base font-semibold truncate">
                <Link
                  href={`/workspace/projects/${project.id}`}
                  className="hover:text-violet-500 transition-colors"
                >
                  {project.name}
                </Link>
              </CardTitle>
            </div>
            {!compact && (
              <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                {project.description}
              </p>
            )}
          </div>
          <div className="flex shrink-0 gap-1.5">
            <Badge
              variant="secondary"
              className={cn("text-xs", STATUS_COLORS[project.status])}
            >
              {project.status}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Badge
                  variant="secondary"
                  className={cn(
                    "text-xs cursor-pointer transition-opacity hover:opacity-80",
                    PRIORITY_COLORS[project.priority],
                    isPriorityUpdating && "opacity-50"
                  )}
                >
                  {project.priority}
                </Badge>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                <DropdownMenuLabel className="text-xs">Set Priority</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup
                  value={project.priority}
                  onValueChange={handlePriorityChange}
                >
                  {(["low", "medium", "high", "critical"] as const).map((p) => (
                    <DropdownMenuRadioItem
                      key={p}
                      value={p}
                      className="text-xs capitalize"
                    >
                      <span className={cn(
                        "mr-2 inline-block h-2 w-2 rounded-full",
                        p === "low" && "bg-slate-400",
                        p === "medium" && "bg-yellow-500",
                        p === "high" && "bg-orange-500",
                        p === "critical" && "bg-red-500"
                      )} />
                      {p}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Current Phase */}
        <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-base">{phase.icon}</span>
            <span className="text-sm font-medium">{phase.label}</span>
          </div>
          <span className="text-xs text-muted-foreground">
            {project.phaseProgress[project.currentPhase]}% done
          </span>
        </div>

        {/* Overall Progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Overall Progress</span>
            <span className="font-medium">{overallProgress}%</span>
          </div>
          <Progress value={overallProgress} className="h-1.5" />
        </div>

        {!compact && (
          <>
            {/* Staleness Warning */}
            {isStale && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 px-3 py-2">
                <Clock className="h-4 w-4 text-red-500 dark:text-red-400" />
                <span className="text-xs text-red-700 dark:text-red-300">
                  No activity for {daysSinceActivity} days - needs attention!
                </span>
              </div>
            )}

            {/* AI Review Preview */}
            {hasReview && latestReview && (() => {
              const isApplied = !latestReview.shouldUpdate || !!latestReview.appliedAt;
              
              return (
              <div className={cn(
                "rounded-lg px-3 py-3 transition-colors duration-300",
                isApplied 
                  ? "bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800"
                  : "bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800"
              )}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {isApplied ? (
                      <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    )}
                    <span className={cn(
                      "text-xs font-semibold",
                      isApplied 
                        ? "text-emerald-900 dark:text-emerald-100"
                        : "text-amber-900 dark:text-amber-100"
                    )}>
                      AI Review: {latestReview.completenessScore}% Complete
                    </span>
                  </div>
                  {isApplied ? (
                    <Badge variant="secondary" className="text-[10px] bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100 border-0">
                      Applied ✓
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px] bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 border-0">
                      Update Available
                    </Badge>
                  )}
                </div>
                
                {/* AI Summary */}
                <p className={cn(
                  "text-xs mb-2 line-clamp-2",
                  isApplied
                    ? "text-emerald-800 dark:text-emerald-200"
                    : "text-amber-800 dark:text-amber-200"
                )}>
                  {latestReview.summary}
                </p>
                
                {/* AI Recommendation */}
                {latestReview.recommendedStage && (
                  <div className="flex items-center gap-2 mb-2 text-xs">
                    <span className={cn(
                      "font-medium",
                      isApplied
                        ? "text-emerald-700 dark:text-emerald-300"
                        : "text-amber-700 dark:text-amber-300"
                    )}>
                      {isApplied ? "Applied stage:" : "AI suggests:"}
                    </span>
                    <Badge variant="outline" className={cn(
                      "text-[10px]",
                      isApplied
                        ? "bg-emerald-100 dark:bg-emerald-900/80 border-emerald-300 dark:border-emerald-600 text-emerald-900 dark:text-emerald-100"
                        : "bg-amber-100 dark:bg-amber-900/80 border-amber-300 dark:border-amber-600 text-amber-900 dark:text-amber-100"
                    )}>
                      {(PHASE_MAP[LEGACY_PHASE_MAP[latestReview.recommendedStage] || latestReview.recommendedStage] || PHASE_MAP["idea"])?.icon}
                      <span className="ml-1">{latestReview.recommendedStage}</span>
                      <span className={cn(
                        "ml-1",
                        isApplied
                          ? "text-emerald-600 dark:text-emerald-300"
                          : "text-amber-600 dark:text-amber-300"
                      )}>({latestReview.recommendedProgress}%)</span>
                    </Badge>
                  </div>
                )}
                
                {/* Mini Pipeline Progress */}
                {latestReview.stageProgressMap && (
                  <div className="mb-3">
                    <p className={cn(
                      "text-[10px] font-medium mb-1.5",
                      isApplied
                        ? "text-emerald-700 dark:text-emerald-300"
                        : "text-amber-700 dark:text-amber-300"
                    )}>Pipeline Progress:</p>
                    <div className="flex items-center gap-0.5 sm:gap-1 flex-wrap">
                      {(["idea", "prototype", "free-tier", "premium", "deploy", "live"] as const).map((stage, idx) => {
                        const progress = latestReview.stageProgressMap![stage] || 0;
                        const isDone = progress === 100;
                        const isCurrent = stage === latestReview.recommendedStage;
                        
                        return (
                          <div key={stage} className="flex items-center">
                            <div 
                              className={cn(
                                "h-5 w-5 rounded-full flex items-center justify-center text-[8px] font-medium border",
                                isDone ? "bg-green-500 border-green-500 text-white" :
                                isCurrent ? "bg-violet-500 border-violet-500 text-white" :
                                progress > 0 ? "bg-amber-400 border-amber-400 text-white" :
                                "bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500"
                              )}
                              title={`${PHASE_MAP[stage]?.label}: ${progress}%`}
                            >
                              {isDone ? "✓" : isCurrent ? progress : progress > 0 ? progress : idx + 1}
                            </div>
                            {idx < 5 && (
                              <div className={cn(
                                "w-3 h-0.5 mx-0.5",
                                isDone ? "bg-green-400" : "bg-gray-300 dark:bg-gray-600"
                              )} />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* AI Suggestions Preview — only show when not yet applied */}
                {!isApplied && latestReview.suggestions && latestReview.suggestions.length > 0 && (
                  <div className="mb-2">
                    <p className="text-[10px] text-amber-700 dark:text-amber-300 font-medium mb-1">Suggestions:</p>
                    <ul className="space-y-0.5">
                      {latestReview.suggestions.slice(0, 2).map((suggestion, i) => (
                        <li key={i} className="text-[10px] text-amber-800 dark:text-amber-200 flex items-start gap-1">
                          <span className="text-amber-500 dark:text-amber-400 mt-0.5">•</span>
                          <span className="line-clamp-1">{suggestion}</span>
                        </li>
                      ))}
                      {latestReview.suggestions.length > 2 && (
                        <li className="text-[10px] text-amber-600 dark:text-amber-400 italic">
                          +{latestReview.suggestions.length - 2} more...
                        </li>
                      )}
                    </ul>
                  </div>
                )}
                
                {/* Action Buttons */}
                <div className="flex gap-2 mt-2">
                  {!isApplied && latestReview.recommendedStage && (
                    <Button 
                      variant="default" 
                      size="sm" 
                      className="flex-1 h-7 text-xs bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600 text-white"
                      onClick={() => handleApplyReview(latestReview)}
                      disabled={isApplying}
                    >
                      {isApplying ? (
                        <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <CheckCircle className="h-3 w-3 mr-1" />
                      )}
                      Apply AI Update
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className={cn(
                      "h-7 text-xs",
                      isApplied
                        ? "border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
                        : "border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50"
                    )}
                    onClick={() => setIsReviewModalOpen(true)}
                  >
                    View Details
                  </Button>
                </div>
              </div>
              );
            })()}

            {/* AI Actions */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1 text-xs"
                onClick={() => setIsReviewModalOpen(true)}
                disabled={isReviewLoading}
              >
                {isReviewLoading ? (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                ) : (
                  <Sparkles className="h-3 w-3" />
                )}
                {hasReview ? "AI Review" : "Run AI Review"}
              </Button>
              
              {project.githubUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={handleSyncCommits}
                  disabled={isSyncLoading}
                >
                  {isSyncLoading ? (
                    <RefreshCw className="h-3 w-3 animate-spin" />
                  ) : (
                    <GitCommit className="h-3 w-3" />
                  )}
                  Sync
                </Button>
              )}
            </div>

            {/* Tech stack */}
            <div className="flex flex-wrap gap-1">
              {project.techStack.map((tech) => (
                <Badge key={tech} variant="outline" className="text-[10px] font-normal">
                  {tech}
                </Badge>
              ))}
            </div>

            {/* GitHub info */}
            <div className="flex items-center justify-between border-t border-border pt-3 gap-2">
              <div className="flex items-center gap-2 sm:gap-4 text-xs text-muted-foreground min-w-0 flex-wrap">
                <span className="flex items-center gap-1">
                  <GitCommit className="h-3 w-3" />
                  {project.commits}
                </span>
                <span className="flex items-center gap-1">
                  <Star className="h-3 w-3" />
                  {project.stars}
                </span>
                <span className="flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {project.openIssues}
                </span>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                  <a
                    href={project.githubUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <GitBranch className="h-3.5 w-3.5" />
                  </a>
                </Button>
                <DomainLinkButton
                  domain={project.domain}
                  onDomainChange={async (domain) => {
                    await updateProject(project.id, { domain });
                  }}
                  size="sm"
                />
              </div>
            </div>

            {/* Last commit */}
            {project.lastCommit && (
              <div className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2">
                <p className="truncate text-xs text-muted-foreground">
                  <span className="font-mono text-[10px] text-violet-500">
                    {project.lastCommit.sha}
                  </span>{" "}
                  {project.lastCommit.message}
                </p>
              </div>
            )}
          </>
        )}

        {/* View Project Link */}
        <Link
          href={`/workspace/projects/${project.id}`}
          className="flex items-center gap-1 text-xs font-medium text-violet-500 opacity-0 transition-all group-hover:opacity-100"
        >
          View Project <ArrowRight className="h-3 w-3" />
        </Link>
      </CardContent>

      {/* AI Review Modal */}
      <AIReviewModal
        project={project}
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        onRequestReview={handleRunReview}
        onApplyReview={handleApplyReview}
        loading={isReviewLoading}
      />
    </Card>
  );
}
