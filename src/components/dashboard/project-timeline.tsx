"use client";

import { useState, useEffect } from "react";
import { Project, TimelineEvent } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow, format } from "date-fns";
import { 
  GitCommit, 
  Sparkles, 
  Rocket, 
  Calendar, 
  Milestone,
  ChevronRight,
  AlertCircle,
  Clock
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PHASE_MAP, LEGACY_PHASE_MAP } from "@/lib/constants";

interface ProjectTimelineProps {
  project: Project;
  compact?: boolean;
}

const EVENT_ICONS = {
  creation: Calendar,
  "stage-change": Rocket,
  "commit-sync": GitCommit,
  "ai-review": Sparkles,
  deadline: Clock,
  milestone: Milestone,
};

const EVENT_COLORS = {
  creation: "bg-blue-500",
  "stage-change": "bg-green-500",
  "commit-sync": "bg-violet-500",
  "ai-review": "bg-amber-500",
  deadline: "bg-red-500",
  milestone: "bg-pink-500",
};

export function ProjectTimeline({ project, compact = false }: ProjectTimelineProps) {
  const timeline = project.timeline || [];
  
  // Sort by date descending
  const sortedEvents = [...timeline].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  // Calculate days since last activity
  const lastActivity = sortedEvents[0]?.date || project.updatedAt;
  const [daysSinceActivity, setDaysSinceActivity] = useState(0);
  const [isStale, setIsStale] = useState(false);
  
  useEffect(() => {
    const now = Date.now();
    const days = Math.floor(
      (now - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24)
    );
    setDaysSinceActivity(days);
    setIsStale(days > 7);
  }, [lastActivity]);

  if (compact) {
    return (
      <div className="space-y-2">
        {sortedEvents.slice(0, 3).map((event) => {
          const Icon = EVENT_ICONS[event.type];
          return (
            <div key={event.id} className="flex items-center gap-2 text-xs">
              <div className={cn("h-2 w-2 rounded-full", EVENT_COLORS[event.type])} />
              <Icon className="h-3 w-3 text-muted-foreground" />
              <span className="truncate flex-1">{event.title}</span>
              <span className="text-muted-foreground">
                {formatDistanceToNow(new Date(event.date), { addSuffix: true })}
              </span>
            </div>
          );
        })}
        {isStale && (
          <div className="flex items-center gap-2 text-xs text-red-500">
            <AlertCircle className="h-3 w-3" />
            <span>No activity for {daysSinceActivity} days</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">Project Timeline</CardTitle>
          {isStale && (
            <Badge variant="destructive" className="text-xs">
              <AlertCircle className="mr-1 h-3 w-3" />
              Stale ({daysSinceActivity} days)
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative space-y-4">
          {/* Timeline line */}
          <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />
          
          {sortedEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No timeline events yet
            </p>
          ) : (
            sortedEvents.map((event, index) => (
              <TimelineItem 
                key={event.id} 
                event={event} 
                isLast={index === sortedEvents.length - 1}
              />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function TimelineItem({ 
  event, 
  isLast 
}: { 
  event: TimelineEvent; 
  isLast: boolean;
}) {
  const Icon = EVENT_ICONS[event.type];
  const date = new Date(event.date);
  
  return (
    <div className="relative flex gap-4">
      {/* Icon */}
      <div className={cn(
        "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-background",
        EVENT_COLORS[event.type]
      )}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      
      {/* Content */}
      <div className="flex-1 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium">{event.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {event.description}
            </p>
            
            {/* Metadata display */}
                {event.metadata && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {typeof event.metadata.fromStage === "string" && typeof event.metadata.toStage === "string" && (
                      <Badge variant="outline" className="text-xs">
                        <span>{(PHASE_MAP[LEGACY_PHASE_MAP[event.metadata.fromStage] || event.metadata.fromStage] || PHASE_MAP["idea"])?.icon || "📍"}</span>
                        <ChevronRight className="h-3 w-3 mx-1" />
                        <span>{(PHASE_MAP[LEGACY_PHASE_MAP[event.metadata.toStage] || event.metadata.toStage] || PHASE_MAP["idea"])?.icon || "🎯"}</span>
                        <span className="ml-1">{event.metadata.toStage as string}</span>
                      </Badge>
                    )}
                    {typeof event.metadata.completenessScore === "number" && (
                      <Badge variant="outline" className="text-xs">
                        Score: {event.metadata.completenessScore}%
                      </Badge>
                    )}
                    {typeof event.metadata.commitCount === "number" && (
                      <Badge variant="outline" className="text-xs">
                        {event.metadata.commitCount} commits
                      </Badge>
                    )}
                    {typeof event.metadata.bugsFound === "number" && event.metadata.bugsFound > 0 && (
                      <Badge variant="destructive" className="text-xs">
                        {event.metadata.bugsFound} bugs found
                      </Badge>
                    )}
                  </div>
                )}
          </div>
          
          <div className="text-right">
            <p className="text-xs font-medium">
              {format(date, "MMM d")}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {formatDistanceToNow(date, { addSuffix: true })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
