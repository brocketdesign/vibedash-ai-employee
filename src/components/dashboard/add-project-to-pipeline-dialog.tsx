"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PHASE_MAP, LEGACY_PHASE_MAP } from "@/lib/constants";
import { Project, ProjectPhase } from "@/types";
import { Plus, Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AddProjectToPipelineDialogProps {
  targetPhase: ProjectPhase;
  projects: Project[];
  onAddProject: (projectId: string, phase: ProjectPhase) => Promise<void>;
  trigger?: React.ReactNode;
}

export function AddProjectToPipelineDialog({
  targetPhase,
  projects,
  onAddProject,
  trigger,
}: AddProjectToPipelineDialogProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [movingId, setMovingId] = useState<string | null>(null);

  const phase = PHASE_MAP[targetPhase];

  // Show projects that are NOT already in this phase
  const availableProjects = projects.filter((p) => {
    const mappedPhase = LEGACY_PHASE_MAP[p.currentPhase] || p.currentPhase;
    return mappedPhase !== targetPhase;
  });

  const filteredProjects = availableProjects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.description?.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = async (projectId: string) => {
    setMovingId(projectId);
    try {
      await onAddProject(projectId, targetPhase);
      setMovingId(null);
      setOpen(false);
      setSearch("");
    } catch (err) {
      console.error("Failed to add project to pipeline:", err);
      setMovingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearch(""); }}>
      <DialogTrigger asChild>
        {trigger || (
          <Button
            variant="ghost"
            className="h-8 w-full gap-2 rounded-xl text-xs text-muted-foreground"
          >
            <Plus className="h-3 w-3" />
            Add Project
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{phase?.icon}</span>
            Add Project to {phase?.label}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 pt-1">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 rounded-xl"
            />
          </div>

          {/* Project list */}
          <ScrollArea className="max-h-[350px]">
            <div className="space-y-2">
              {filteredProjects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <p className="text-sm">
                    {availableProjects.length === 0
                      ? "All projects are already in this phase"
                      : "No projects match your search"}
                  </p>
                </div>
              ) : (
                filteredProjects.map((project) => {
                  const currentPhaseInfo =
                    PHASE_MAP[LEGACY_PHASE_MAP[project.currentPhase] || project.currentPhase] ||
                    PHASE_MAP["idea"];
                  const isMoving = movingId === project.id;

                  return (
                    <button
                      key={project.id}
                      disabled={isMoving || movingId !== null}
                      onClick={() => handleAdd(project.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-all",
                        "hover:shadow-md hover:border-violet-500/30 hover:bg-accent/50",
                        "disabled:opacity-50 disabled:cursor-not-allowed"
                      )}
                    >
                      <div
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: project.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">
                            {project.name}
                          </span>
                        </div>
                        {project.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                            {project.description}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant="secondary"
                        className="shrink-0 gap-1 text-[10px]"
                      >
                        {currentPhaseInfo.icon} {currentPhaseInfo.label}
                      </Badge>
                      {isMoving && (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-violet-500" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>

          <p className="text-[11px] text-muted-foreground text-center">
            {availableProjects.length} project{availableProjects.length !== 1 ? "s" : ""} available to add
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
