"use client";

import { useState } from "react";
import { useProjects } from "@/lib/hooks";
import { NewProjectDialog } from "@/components/dashboard/new-project-dialog";
import { AddProjectToPipelineDialog } from "@/components/dashboard/add-project-to-pipeline-dialog";
import { PHASES, PHASE_MAP, LEGACY_PHASE_MAP } from "@/lib/constants";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  GripVertical,
  Plus,
  Loader2,
  ArrowRight,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { Project, ProjectPhase } from "@/types";
import { DomainLinkButton } from "@/components/dashboard/domain-link-button";

export default function PipelinePage() {
  const { projects, loading, createProject, updateProject, moveProjectPhase, refetch } =
    useProjects();
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);

  const handleMovePhase = async (
    projectId: string,
    newPhase: ProjectPhase
  ) => {
    setMovingId(projectId);
    try {
      await moveProjectPhase(projectId, newPhase, 0);
      setSelectedProject(null);
    } catch (err) {
      console.error("Failed to move project:", err);
    } finally {
      setMovingId(null);
    }
  };

  const getAdjacentPhase = (
    currentPhase: ProjectPhase,
    direction: "prev" | "next"
  ): ProjectPhase | null => {
    // Map legacy phase to new phase
    const mappedPhase = LEGACY_PHASE_MAP[currentPhase] || currentPhase;
    const phase = PHASE_MAP[mappedPhase];
    if (!phase) return null;
    const currentOrder = phase.order;
    const targetOrder =
      direction === "next" ? currentOrder + 1 : currentOrder - 1;
    const target = PHASES.find((p) => p.order === targetOrder);
    return target ? target.id : null;
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
          <h1 className="text-2xl font-bold tracking-tight">Pipeline View</h1>
          <p className="text-sm text-muted-foreground">
            Drag projects through your 8-phase pipeline — from Idea to Live
          </p>
        </div>
        <div className="flex gap-2">
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

      {/* Phase legend */}
      <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-border bg-muted/30 p-2">
        {PHASES.map((phase, i) => (
          <div key={phase.id} className="flex items-center">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs whitespace-nowrap">
              <span>{phase.icon}</span>
              <span className="font-medium">{phase.label}</span>
              <Badge variant="secondary" className="h-4 px-1 text-[9px]">
                {projects.filter((p) => p.currentPhase === phase.id).length}
              </Badge>
            </div>
            {i < PHASES.length - 1 && (
              <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
            )}
          </div>
        ))}
      </div>

      {/* Kanban board */}
      <ScrollArea className="w-full">
        <div className="flex gap-4 pb-4" style={{ minWidth: "max-content" }}>
          {PHASES.map((phase) => {
            const phaseProjects = projects.filter(
              (p) => p.currentPhase === phase.id
            );
            return (
              <div
                key={phase.id}
                className="flex w-[280px] shrink-0 flex-col rounded-2xl border border-border bg-muted/30"
              >
                {/* Column header */}
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{phase.icon}</span>
                    <span className="text-sm font-semibold">
                      {phase.label}
                    </span>
                  </div>
                  <Badge
                    variant="secondary"
                    className="h-5 px-1.5 text-[10px]"
                  >
                    {phaseProjects.length}
                  </Badge>
                </div>

                {/* Column content */}
                <div className="flex flex-col gap-3 p-3 min-h-[120px]">
                  {phaseProjects.map((project) => {
                    const prevPhase = getAdjacentPhase(
                      project.currentPhase,
                      "prev"
                    );
                    const nextPhase = getAdjacentPhase(
                      project.currentPhase,
                      "next"
                    );
                    const isMoving = movingId === project.id;

                    return (
                      <Card
                        key={project.id}
                        className={cn(
                          "cursor-pointer transition-all hover:shadow-lg hover:shadow-violet-500/5 hover:-translate-y-0.5",
                          isMoving && "opacity-50"
                        )}
                        onClick={() => setSelectedProject(project)}
                      >
                        <CardContent className="p-4">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <div
                                className="h-2.5 w-2.5 rounded-full shrink-0"
                                style={{
                                  backgroundColor: project.color,
                                }}
                              />
                              <span className="text-sm font-semibold truncate flex-1">
                                {project.name}
                              </span>
                              <DomainLinkButton
                                domain={project.domain}
                                onDomainChange={async (domain) => {
                                  await updateProject(project.id, { domain });
                                }}
                                size="sm"
                              />
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {project.description}
                            </p>
                            {/* Phase progress */}
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="text-muted-foreground">
                                  Phase progress
                                </span>
                                <span className="font-medium">
                                  {project.phaseProgress?.[
                                    project.currentPhase
                                  ] || 0}
                                  %
                                </span>
                              </div>
                              <Progress
                                value={
                                  project.phaseProgress?.[
                                    project.currentPhase
                                  ] || 0
                                }
                                className="h-1"
                              />
                            </div>
                            {/* Tech stack */}
                            <div className="flex flex-wrap gap-1">
                              {project.techStack
                                ?.slice(0, 3)
                                .map((tech) => (
                                  <Badge
                                    key={tech}
                                    variant="outline"
                                    className="h-4 px-1.5 text-[9px]"
                                  >
                                    {tech}
                                  </Badge>
                                ))}
                            </div>
                            {/* Move buttons */}
                            <div className="flex items-center gap-1 pt-1">
                              {prevPhase && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 gap-1 rounded-lg px-2 text-[10px]"
                                  disabled={isMoving}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMovePhase(
                                      project.id,
                                      prevPhase
                                    );
                                  }}
                                >
                                  <ChevronLeft className="h-3 w-3" />
                                  {PHASE_MAP[prevPhase].icon}
                                </Button>
                              )}
                              <div className="flex-1" />
                              {nextPhase && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 gap-1 rounded-lg px-2 text-[10px]"
                                  disabled={isMoving}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMovePhase(
                                      project.id,
                                      nextPhase
                                    );
                                  }}
                                >
                                  {PHASE_MAP[nextPhase].icon}
                                  <ChevronRight className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                            {/* Metrics */}
                            {(project.revenue > 0 ||
                              project.monthlyVisitors > 0) && (
                              <div className="flex items-center gap-3 border-t border-border pt-2 text-[10px] text-muted-foreground">
                                {project.revenue > 0 && (
                                  <span className="text-emerald-500">
                                    ${project.revenue.toLocaleString()}/mo
                                  </span>
                                )}
                                {project.monthlyVisitors > 0 && (
                                  <span>
                                    {project.monthlyVisitors.toLocaleString()}{" "}
                                    visitors
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}

                  {phaseProjects.length === 0 && (
                    <div className="flex h-24 flex-col items-center justify-center rounded-xl border border-dashed border-border/50 text-muted-foreground">
                      <span className="text-xs">No projects</span>
                    </div>
                  )}

                  <AddProjectToPipelineDialog
                    targetPhase={phase.id}
                    projects={projects}
                    onAddProject={async (projectId, newPhase) => {
                      await moveProjectPhase(projectId, newPhase, 0);
                    }}
                    trigger={
                      <Button
                        variant="ghost"
                        className="h-8 w-full gap-2 rounded-xl text-xs text-muted-foreground"
                      >
                        <Plus className="h-3 w-3" />
                        Add Project
                      </Button>
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Project detail dialog */}
      <Dialog
        open={!!selectedProject}
        onOpenChange={(open) => !open && setSelectedProject(null)}
      >
        {selectedProject && (
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: selectedProject.color }}
                />
                {selectedProject.name}
                <DomainLinkButton
                  domain={selectedProject.domain}
                  onDomainChange={async (domain) => {
                    await updateProject(selectedProject.id, { domain });
                    setSelectedProject({ ...selectedProject, domain });
                  }}
                  size="sm"
                />
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {selectedProject.description}
              </p>

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Current Phase
                </p>
                <Badge variant="secondary" className="gap-1">
                  {(PHASE_MAP[LEGACY_PHASE_MAP[selectedProject.currentPhase] || selectedProject.currentPhase] || PHASE_MAP["idea"]).icon}{" "}
                  {(PHASE_MAP[LEGACY_PHASE_MAP[selectedProject.currentPhase] || selectedProject.currentPhase] || PHASE_MAP["idea"]).label}
                </Badge>
              </div>

              <Separator />

              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Move to Phase
                </p>
                <Select
                  value={selectedProject.currentPhase}
                  onValueChange={(v) =>
                    handleMovePhase(selectedProject.id, v as ProjectPhase)
                  }
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
              </div>

              {selectedProject.techStack?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Tech Stack
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {selectedProject.techStack.map((tech) => (
                      <Badge key={tech} variant="outline" className="text-xs">
                        {tech}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Link
                  href={`/dashboard/projects/${selectedProject.id}`}
                  className="flex-1"
                >
                  <Button
                    variant="outline"
                    className="w-full gap-2 rounded-xl"
                  >
                    View Details
                  </Button>
                </Link>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
