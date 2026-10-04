"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Task } from "@/types";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Clock, AlertCircle } from "lucide-react";

interface UpcomingTasksProps {
  projects: { name: string; color: string; tasks: Task[] }[];
}

const statusIcons = {
  todo: Circle,
  "in-progress": Clock,
  done: CheckCircle2,
};

const priorityDots = {
  low: "bg-slate-400",
  medium: "bg-yellow-400",
  high: "bg-red-400",
};

export function UpcomingTasks({ projects }: UpcomingTasksProps) {
  const allTasks = projects
    .flatMap((p) =>
      p.tasks
        .filter((t) => t.status !== "done")
        .map((t) => ({
          ...t,
          projectName: p.name,
          projectColor: p.color,
        }))
    )
    .sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    })
    .slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">
            Upcoming Tasks
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {allTasks.length} pending
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {allTasks.map((task) => {
          const StatusIcon = statusIcons[task.status];
          return (
            <div
              key={task.id}
              className="flex items-center gap-3 rounded-lg border border-border/50 px-3 py-2.5 transition-all hover:bg-muted/50"
            >
              <StatusIcon
                className={cn(
                  "h-4 w-4 shrink-0",
                  task.status === "in-progress"
                    ? "text-violet-500"
                    : "text-muted-foreground"
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{task.title}</p>
                <div className="mt-0.5 flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <div
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: task.projectColor }}
                    />
                    <span className="text-[10px] text-muted-foreground">
                      {task.projectName}
                    </span>
                  </div>
                  {task.dueDate && (
                    <span className="text-[10px] text-muted-foreground">
                      Due {new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  )}
                </div>
              </div>
              <div
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  priorityDots[task.priority]
                )}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
