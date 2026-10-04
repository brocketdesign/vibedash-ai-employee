"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PHASES } from "@/lib/constants";
import { DashboardStats, ProjectPhase } from "@/types";
import { RefreshCw } from "lucide-react";

interface PhaseDistributionProps {
  stats: DashboardStats;
  onRefresh?: () => Promise<void>;
}

export function PhaseDistribution({ stats, onRefresh }: PhaseDistributionProps) {
  const [refreshing, setRefreshing] = useState(false);

  const total = Math.max(
    Object.values(stats.projectsByPhase).reduce((a, b) => a + b, 0),
    1
  );

  // Find the leading phase (most projects)
  const leadingPhaseId = Object.entries(stats.projectsByPhase).reduce(
    (best, [id, count]) => (count > (stats.projectsByPhase[best as ProjectPhase] ?? 0) ? id : best),
    "idea"
  );
  const leadingPhase = PHASES.find((p) => p.id === leadingPhaseId);

  const handleRefresh = async () => {
    if (!onRefresh || refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold shrink-0">
            Phase Distribution
          </CardTitle>
          <div className="flex items-center gap-2 min-w-0">
            {leadingPhase && stats.projectsByPhase[leadingPhaseId as ProjectPhase] > 0 && (
              <Badge variant="secondary" className="gap-1 text-xs truncate">
                <span>{leadingPhase.icon}</span>
                <span className="truncate">{leadingPhase.label}</span>
              </Badge>
            )}
            {onRefresh && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleRefresh}
                disabled={refreshing}
                title="Refresh phase data"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${
                    refreshing ? "animate-spin" : ""
                  }`}
                />
              </Button>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {total} project{total !== 1 ? "s" : ""} across 6 stages
        </p>
      </CardHeader>
      <CardContent className="space-y-3 pt-1">
        {PHASES.map((phase) => {
          const count = stats.projectsByPhase[phase.id] ?? 0;
          const percentage = Math.round((count / total) * 100);
          return (
            <div key={phase.id} className="flex items-center gap-3">
              <span className="w-5 text-center text-sm leading-none">{phase.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="mb-1 flex items-center justify-between">
                  <span className="truncate text-xs font-medium">{phase.label}</span>
                  <div className="ml-2 flex shrink-0 items-center gap-1.5">
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {count} project{count !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-2 rounded-full ${phase.color} transition-all duration-700 ease-out`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
