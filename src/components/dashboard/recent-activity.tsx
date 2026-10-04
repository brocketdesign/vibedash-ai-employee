"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Project } from "@/types";
import { GitCommit, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

interface RecentActivityProps {
  projects: Project[];
}

export function RecentActivity({ projects }: RecentActivityProps) {
  const activities = projects
    .filter((p) => p.lastCommit)
    .sort(
      (a, b) =>
        new Date(b.lastCommit!.date).getTime() -
        new Date(a.lastCommit!.date).getTime()
    )
    .slice(0, 6);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">
            Recent Activity
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            GitHub
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 overflow-hidden">
        {activities.map((project) => (
          <Link
            key={project.id}
            href={`/workspace/projects/${project.id}`}
            className="flex items-start gap-3 rounded-lg border border-border/50 bg-muted/30 p-3 transition-all hover:bg-muted/50 hover:border-violet-500/30 overflow-hidden"
          >
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/10">
              <GitCommit className="h-3.5 w-3.5 text-violet-500" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <div
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: project.color }}
                />
                <span className="text-xs font-semibold truncate">{project.name}</span>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                <span className="font-mono text-[10px] text-violet-500">
                  {project.lastCommit!.sha}
                </span>{" "}
                {project.lastCommit!.message}
              </p>
              <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock className="h-2.5 w-2.5" />
                {formatDistanceToNow(new Date(project.lastCommit!.date), {
                  addSuffix: true,
                })}
              </div>
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
