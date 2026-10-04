"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AIInsight } from "@/types";
import { cn } from "@/lib/utils";
import {
  Lightbulb,
  AlertTriangle,
  TrendingUp,
  Trophy,
  ArrowRight,
  Sparkles,
  Crown,
} from "lucide-react";

const insightIcons = {
  suggestion: Lightbulb,
  warning: AlertTriangle,
  opportunity: TrendingUp,
  milestone: Trophy,
};

const insightColors = {
  suggestion: "text-blue-500 bg-blue-500/10 border-blue-500/20",
  warning: "text-amber-500 bg-amber-500/10 border-amber-500/20",
  opportunity: "text-green-500 bg-green-500/10 border-green-500/20",
  milestone: "text-violet-500 bg-violet-500/10 border-violet-500/20",
};

interface AIInsightsCardProps {
  insights: AIInsight[];
  showAll?: boolean;
}

export function AIInsightsCard({
  insights,
  showAll = false,
}: AIInsightsCardProps) {
  const displayedInsights = showAll ? insights : insights.slice(0, 3);

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute right-0 top-0 h-32 w-32 translate-x-8 -translate-y-8 rounded-full bg-gradient-to-br from-violet-500/10 to-indigo-500/10 blur-2xl" />
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500/20 to-indigo-500/20">
              <Sparkles className="h-4 w-4 text-violet-500" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">
                AI Advisor
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                Smart recommendations for your projects
              </p>
            </div>
          </div>
          <Badge
            variant="outline"
            className="gap-1 border-amber-500/30 text-amber-500"
          >
            <Crown className="h-3 w-3" />
            Pro
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {displayedInsights.map((insight) => {
          const Icon = insightIcons[insight.type];
          const colorClass = insightColors[insight.type];
          return (
            <div
              key={insight.id}
              className={cn(
                "rounded-xl border p-3 transition-all hover:shadow-sm",
                colorClass
              )}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {insight.title}
                    </span>
                    <Badge variant="outline" className="h-4 text-[9px] font-normal">
                      {insight.projectName}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {insight.description}
                  </p>
                  {insight.actionable && insight.action && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-1 h-7 gap-1 px-2 text-xs"
                    >
                      {insight.action}
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
