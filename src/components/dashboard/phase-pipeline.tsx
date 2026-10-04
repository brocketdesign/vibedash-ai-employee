"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PHASES } from "@/lib/constants";
import { Project } from "@/types";
import { cn } from "@/lib/utils";
import { DomainLinkButton } from "./domain-link-button";
import Link from "next/link";

interface PhasePipelineProps {
  projects: Project[];
  onUpdateDomain?: (projectId: string, domain: string) => Promise<void>;
}

export function PhasePipeline({ projects, onUpdateDomain }: PhasePipelineProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Project Pipeline</CardTitle>
      </CardHeader>
      <CardContent className="overflow-hidden">
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
          {PHASES.map((phase) => {
            const phaseProjects = projects.filter(
              (p) => p.currentPhase === phase.id
            );
            return (
              <div
                key={phase.id}
                className="flex min-w-[130px] flex-1 flex-col rounded-xl border border-border bg-muted/30 p-2 sm:p-3"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-sm">{phase.icon}</span>
                  <span className="text-xs font-medium">{phase.label}</span>
                  <Badge variant="secondary" className="ml-auto h-5 px-1.5 text-[10px]">
                    {phaseProjects.length}
                  </Badge>
                </div>
                <div className="flex flex-col gap-1.5">
                  {phaseProjects.map((project) => (
                    <Link
                      key={project.id}
                      href={`/workspace/projects/${project.id}`}
                      className="flex items-center gap-2 rounded-lg bg-card px-2.5 py-2 shadow-sm transition-all hover:shadow-md hover:border-violet-500/30"
                    >
                      <div
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: project.color }}
                      />
                      <span className="truncate text-xs font-medium flex-1">
                        {project.name}
                      </span>
                      <DomainLinkButton
                        domain={project.domain}
                        onDomainChange={onUpdateDomain ? async (domain) => {
                          await onUpdateDomain(project.id, domain);
                        } : undefined}
                        size="sm"
                      />
                    </Link>
                  ))}
                  {phaseProjects.length === 0 && (
                    <div className="flex h-12 items-center justify-center rounded-lg border border-dashed border-border/50">
                      <span className="text-[10px] text-muted-foreground">
                        No projects
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
