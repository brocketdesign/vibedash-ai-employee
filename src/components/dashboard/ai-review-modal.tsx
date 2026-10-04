"use client";

import { useState, useEffect } from "react";
import { AIReview, Project, ProjectPhase } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Sparkles, 
  CheckCircle, 
  CheckCircle2,
  AlertCircle, 
  Lightbulb, 
  GitCommit,
  ArrowRight,
  Loader2,
  RefreshCw,
  X,
  Layers,
  Clock,
  Circle,
  ListTodo,
  Lock,
  Github
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PHASE_MAP, LEGACY_PHASE_MAP } from "@/lib/constants";
import { formatDistanceToNow } from "date-fns";

interface AIReviewModalProps {
  project: Project;
  isOpen: boolean;
  onClose: () => void;
  onApplyReview: (review: AIReview) => Promise<void> | void;
  onRequestReview: () => Promise<AIReview | null>;
  loading?: boolean;
  /** True when the repo is private and GitHub access is needed to read it. */
  needsReconnect?: boolean;
  /** Launches the GitHub OAuth flow to (re)grant access to private repos. */
  onReconnect?: () => void;
}

export function AIReviewModal({
  project,
  isOpen,
  onClose,
  onApplyReview,
  onRequestReview,
  loading = false,
  needsReconnect = false,
  onReconnect,
}: AIReviewModalProps) {
  const [selectedReview, setSelectedReview] = useState<AIReview | null>(null);
  const [localReviews, setLocalReviews] = useState<AIReview[]>(project.aiReviews || []);
  const [isRunningReview, setIsRunningReview] = useState(false);
  
  // Update local reviews when project prop changes (for when parent re-renders with fresh data)
  useEffect(() => {
    setLocalReviews(project.aiReviews || []);
  }, [project.aiReviews]);
  
  // Reset selected review when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedReview(null);
      setLocalReviews(project.aiReviews || []);
    }
  }, [isOpen, project.aiReviews]);
  
  // Use local reviews if we have them, otherwise fall back to project prop
  // This ensures we show newly created reviews immediately
  const reviews = localReviews.length > 0 ? localReviews : (project.aiReviews || []);
  const latestReview = reviews[0];

  const [isApplying, setIsApplying] = useState(false);

  const handleApply = async () => {
    if (selectedReview || latestReview) {
      setIsApplying(true);
      try {
        await onApplyReview(selectedReview || latestReview);
        // Small delay to ensure state updates propagate before closing
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error("Failed to apply review:", error);
      } finally {
        setIsApplying(false);
        onClose();
      }
    }
  };

  const handleRunReview = async () => {
    setIsRunningReview(true);
    try {
      const newReview = await onRequestReview();
      if (newReview) {
        // Immediately update local state with the new review
        setLocalReviews(prev => [newReview, ...prev]);
        setSelectedReview(newReview);
      }
    } catch (error) {
      console.error("Failed to run AI review:", error);
    } finally {
      setIsRunningReview(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            <DialogTitle>AI Code Review</DialogTitle>
          </div>
          <DialogDescription>
            AI-powered analysis of your project code and progress
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 overflow-y-auto px-6">
          <div className="space-y-4 py-2">
            {/* Review Request Button */}
            <div className="flex items-center justify-between rounded-lg border p-3 shrink-0">
              <div className="flex items-center gap-3">
                <GitCommit className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{project.githubRepo || "No repo linked"}</p>
                  <p className="text-xs text-muted-foreground">
                    {reviews.length} review{reviews.length !== 1 ? 's' : ''} completed
                  </p>
                </div>
              </div>
            <Button
              onClick={handleRunReview}
              disabled={loading || isRunningReview || !project.githubUrl}
              size="sm"
              className="gap-2"
            >
              {loading || isRunningReview ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              {loading || isRunningReview ? "Analyzing..." : "Run AI Review"}
            </Button>
            </div>

            {/* Private-repo reconnect prompt */}
            {needsReconnect && (
              <div className="flex flex-col gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/40 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <Lock className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                  <div>
                    <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                      This repository is private
                    </p>
                    <p className="text-xs text-amber-700/80 dark:text-amber-300/80">
                      VibeDash needs GitHub access to read your code and generate a report. Reconnect to grant access.
                    </p>
                  </div>
                </div>
                {onReconnect && (
                  <Button
                    onClick={onReconnect}
                    size="sm"
                    className="gap-2 shrink-0 bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    <Github className="h-4 w-4" />
                    Connect GitHub
                  </Button>
                )}
              </div>
            )}

            {/* Reviews List */}
            {reviews.length > 0 ? (
              <div className="space-y-3">
                {reviews.map((review) => (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    isSelected={selectedReview?.id === review.id}
                    isLatest={review.id === latestReview?.id}
                    onClick={() => setSelectedReview(review)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No AI reviews yet</p>
                <p className="text-xs">Click "Run AI Review" to analyze your code</p>
              </div>
            )}

            {/* Review Details */}
            {(selectedReview || latestReview) && (
              <ReviewDetails review={selectedReview || latestReview} />
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 flex-col sm:flex-row px-6 py-4 border-t shrink-0">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
            <X className="h-4 w-4 mr-2" />
            Close
          </Button>
          {(selectedReview || latestReview)?.shouldUpdate && !(selectedReview || latestReview)?.appliedAt && (selectedReview || latestReview)?.recommendedStage && (
            <Button 
              onClick={handleApply} 
              disabled={isApplying}
              className="gap-2 w-full sm:w-auto bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
            >
              {isApplying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              {isApplying ? "Applying..." : "Apply AI Update"}: {
                (() => {
                  const review = (selectedReview || latestReview)!;
                  const mappedPhase = LEGACY_PHASE_MAP[review.recommendedStage!] || review.recommendedStage!;
                  return PHASE_MAP[mappedPhase]?.label || review.recommendedStage;
                })()
              } @ {(selectedReview || latestReview)?.recommendedProgress}%
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReviewCard({
  review,
  isSelected,
  isLatest,
  onClick,
}: {
  review: AIReview;
  isSelected: boolean;
  isLatest: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-lg border p-3 transition-all",
        isSelected && "border-violet-500 bg-violet-50/50 dark:bg-violet-950/50",
        !isSelected && "hover:border-violet-200 hover:bg-violet-50/30 dark:hover:border-violet-800 dark:hover:bg-violet-950/30"
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          {review.type === "code-review" ? (
            <Sparkles className="h-4 w-4 text-amber-500" />
          ) : (
            <GitCommit className="h-4 w-4 text-violet-500" />
          )}
          <span className="text-sm font-medium">
            {review.type === "code-review" ? "Code Review" : "Commit Analysis"}
          </span>
          {isLatest && (
            <Badge variant="secondary" className="text-[10px]">Latest</Badge>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
        </span>
      </div>

      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
        {review.summary}
      </p>

      {review.shouldUpdate && !review.appliedAt && review.recommendedStage && (
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="outline" className="text-[10px] bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300">
            <ArrowRight className="h-3 w-3 mr-1" />
            Suggests: {(PHASE_MAP[LEGACY_PHASE_MAP[review.recommendedStage] || review.recommendedStage] || PHASE_MAP["idea"])?.label || review.recommendedStage}
          </Badge>
          <Badge variant="outline" className="text-[10px] bg-violet-100 text-violet-900 border-violet-300 dark:bg-violet-900/30 dark:text-violet-300">
            {review.recommendedProgress}% progress
          </Badge>
        </div>
      )}
      {review.appliedAt && (
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="outline" className="text-[10px] bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-300">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Applied {formatDistanceToNow(new Date(review.appliedAt), { addSuffix: true })}
          </Badge>
        </div>
      )}
    </div>
  );
}

function ReviewDetails({ review }: { review: AIReview }) {
  // Get stage progress map from review
  const stageProgress = review.stageProgressMap;
  
  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Analysis Details</h4>
        {review.completenessScore > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Completeness</span>
            <span className="text-sm font-medium">{review.completenessScore}%</span>
          </div>
        )}
      </div>

      {review.completenessScore > 0 && (
        <Progress value={review.completenessScore} className="h-2" />
      )}

      {/* Pipeline Progress Overview */}
      {stageProgress && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-violet-500" />
            <h5 className="text-sm font-medium">Complete Pipeline Assessment</h5>
          </div>
          <div className="space-y-2">
            {(["idea", "prototype", "free-tier", "premium", "deploy", "live"] as const).map((stage) => {
              const progress = stageProgress[stage] || 0;
              const isCurrentStage = stage === review.recommendedStage;
              const isCompleted = progress === 100;
              
              return (
                <div key={stage} className={cn(
                  "flex items-center gap-3 p-2 rounded-lg transition-colors",
                  isCurrentStage && "bg-violet-50 border border-violet-200 dark:bg-violet-950/50 dark:border-violet-800",
                  !isCurrentStage && isCompleted && "bg-green-50/50 dark:bg-green-950/30",
                  !isCurrentStage && !isCompleted && progress > 0 && "bg-amber-50/50 dark:bg-amber-950/30",
                  !isCurrentStage && progress === 0 && "bg-muted/30"
                )}>
                  <div className="flex items-center gap-2 w-28 shrink-0">
                    <span className="text-base">{PHASE_MAP[stage]?.icon}</span>
                    <span className={cn(
                      "text-xs font-medium",
                      isCurrentStage ? "text-violet-900 dark:text-violet-200" : "text-muted-foreground"
                    )}>
                      {PHASE_MAP[stage]?.label}
                    </span>
                    {isCurrentStage && (
                      <Badge variant="secondary" className="text-[8px] h-4 px-1">NOW</Badge>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Progress 
                        value={progress} 
                        className={cn(
                          "h-1.5 flex-1",
                          isCompleted ? "bg-green-200 dark:bg-green-900" : isCurrentStage ? "bg-violet-200 dark:bg-violet-900" : "bg-muted"
                        )}
                      />
                      <span className={cn(
                        "text-xs font-medium w-10 text-right",
                        isCompleted ? "text-green-600 dark:text-green-400" : isCurrentStage ? "text-violet-700 dark:text-violet-300" : "text-muted-foreground"
                      )}>
                        {progress}%
                      </span>
                    </div>
                  </div>
                  <div className="w-6 flex justify-center">
                    {isCompleted ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : progress > 0 ? (
                      <Clock className="h-4 w-4 text-amber-500" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground/50" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {review.bugsFound.length > 0 && (
        <div>
          <div className="flex items-center gap-2 text-red-600 mb-2">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm font-medium">Issues Found ({review.bugsFound.length})</span>
          </div>
          <ul className="space-y-1">
            {review.bugsFound.map((bug, i) => (
              <li key={i} className="text-xs text-red-600 flex items-start gap-1">
                <span>•</span>
                <span>{bug}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {review.suggestions.length > 0 && (
        <div>
          <div className="flex items-center gap-2 text-amber-600 mb-2">
            <Lightbulb className="h-4 w-4" />
            <span className="text-sm font-medium">Suggestions ({review.suggestions.length})</span>
          </div>
          <ul className="space-y-1">
            {review.suggestions.map((suggestion, i) => (
              <li key={i} className="text-xs text-amber-600 flex items-start gap-1">
                <span>•</span>
                <span>{suggestion}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {review.suggestedTasks && review.suggestedTasks.length > 0 && (
        <div>
          <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400 mb-2">
            <ListTodo className="h-4 w-4" />
            <span className="text-sm font-medium">AI-Suggested Tasks ({review.suggestedTasks.length})</span>
          </div>
          <div className="space-y-2">
            {review.suggestedTasks.map((task, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-2.5 rounded-lg border bg-violet-50/50 border-violet-200 dark:bg-violet-950/30 dark:border-violet-800"
              >
                <Sparkles className="h-3.5 w-3.5 text-violet-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-violet-900 dark:text-violet-200">{task.title}</p>
                  {task.description && (
                    <p className="text-[11px] text-violet-700/70 dark:text-violet-300/70 mt-0.5">{task.description}</p>
                  )}
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-900/50 dark:text-violet-300 dark:border-violet-700">
                      {PHASE_MAP[task.phase]?.icon} {PHASE_MAP[task.phase]?.label || task.phase}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[9px] h-4 px-1.5",
                        task.priority === "high"
                          ? "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700"
                          : task.priority === "medium"
                          ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700"
                          : "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700"
                      )}
                    >
                      {task.priority}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            These tasks have been automatically added to your project
          </p>
        </div>
      )}

      {review.commitsAnalyzed && review.commitsAnalyzed.length > 0 && (
        <div>
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <GitCommit className="h-4 w-4" />
            <span className="text-sm font-medium">Analyzed Commits</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {review.commitsAnalyzed.map((sha) => (
              <code key={sha} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">
                {sha.substring(0, 7)}
              </code>
            ))}
          </div>
        </div>
      )}

      {review.shouldUpdate && !review.appliedAt && review.recommendedStage && (
        <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-950/40 rounded-lg border border-amber-200 dark:border-amber-800">
          <ArrowRight className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <span className="text-sm text-amber-800 dark:text-amber-200">
            AI recommends moving to <strong>{PHASE_MAP[review.recommendedStage]?.label || review.recommendedStage}</strong> at {review.recommendedProgress}% progress
          </span>
        </div>
      )}
      {review.appliedAt && review.recommendedStage && (
        <div className="flex items-center gap-2 p-2 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg border border-emerald-200 dark:border-emerald-800">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          <span className="text-sm text-emerald-800 dark:text-emerald-200">
            Applied: moved to <strong>{PHASE_MAP[review.recommendedStage]?.label || review.recommendedStage}</strong> at {review.recommendedProgress}%
          </span>
        </div>
      )}
    </div>
  );
}
