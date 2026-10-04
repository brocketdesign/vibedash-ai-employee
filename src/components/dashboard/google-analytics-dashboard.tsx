"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  RefreshCw,
  Users,
  TrendingUp,
  BarChart3,
  Eye,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Project, GoogleAnalyticsData } from "@/types";

interface GoogleAnalyticsDashboardProps {
  project: Project;
  onUpdate: (data: Partial<Project>) => void;
}

export function GoogleAnalyticsDashboard({
  project,
  onUpdate,
}: GoogleAnalyticsDashboardProps) {
  const [analyticsData, setAnalyticsData] =
    useState<GoogleAnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const ga = project.googleAnalytics;
  if (!ga?.propertyId) return null;

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/google-analytics/data?projectId=${project.id}`
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to fetch analytics data");
      }
      const data: GoogleAnalyticsData = await res.json();
      setAnalyticsData(data);
      setHasLoaded(true);

      // Update parent with latest numbers
      onUpdate({
        googleAnalytics: {
          ...ga,
          lastFetchedAt: data.fetchedAt,
          monthlyVisitorsGA: data.monthlyVisitors,
          totalVisitorsGA: data.totalVisitors,
        },
        monthlyVisitors: data.monthlyVisitors,
      });

      toast.success("Analytics data refreshed");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error("Failed to fetch analytics", { description: msg });
    } finally {
      setIsLoading(false);
    }
  }, [project.id, ga, onUpdate]);

  const monthlyVisitors = analyticsData?.monthlyVisitors ?? ga.monthlyVisitorsGA ?? 0;
  const totalVisitors = analyticsData?.totalVisitors ?? ga.totalVisitorsGA ?? 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4 text-blue-500" />
            Google Analytics
          </CardTitle>
          <div className="flex items-center gap-2">
            {ga.lastFetchedAt && (
              <span className="text-xs text-muted-foreground">
                Updated{" "}
                {formatDistanceToNow(new Date(ga.lastFetchedAt), {
                  addSuffix: true,
                })}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchData}
              disabled={isLoading}
              className="h-7 px-2"
            >
              {isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{ga.propertyName}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Key metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Users className="h-3.5 w-3.5" />
              Monthly Visitors
            </div>
            <p className="text-2xl font-bold">
              {monthlyVisitors.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <TrendingUp className="h-3.5 w-3.5" />
              Total Visitors
            </div>
            <p className="text-2xl font-bold">
              {totalVisitors.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">Last 12 months</p>
          </div>
        </div>

        {/* Daily visitors chart (simple bar visualization) */}
        {analyticsData?.dailyVisitors && analyticsData.dailyVisitors.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Eye className="h-3.5 w-3.5" />
                Daily Visitors (30 days)
              </h4>
              <div className="flex h-20 items-end gap-[2px]">
                {analyticsData.dailyVisitors.map((day, i) => {
                  const max = Math.max(
                    ...analyticsData.dailyVisitors.map((d) => d.visitors),
                    1
                  );
                  const height = Math.max((day.visitors / max) * 100, 2);
                  return (
                    <div
                      key={i}
                      className="flex-1 rounded-t bg-blue-500/70 transition-all hover:bg-blue-500"
                      style={{ height: `${height}%` }}
                      title={`${day.date}: ${day.visitors.toLocaleString()} visitors`}
                    />
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* Top pages */}
        {analyticsData?.topPages && analyticsData.topPages.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <FileText className="h-3.5 w-3.5" />
                Top Pages
              </h4>
              <div className="space-y-1.5">
                {analyticsData.topPages.slice(0, 5).map((page, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="truncate text-muted-foreground max-w-[200px]">
                      {page.page}
                    </span>
                    <Badge variant="secondary" className="text-xs font-mono">
                      {page.views.toLocaleString()}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Prompt to load data if not yet loaded */}
        {!hasLoaded && !analyticsData && (
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={isLoading}
            className="w-full gap-2"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <BarChart3 className="h-4 w-4" />
            )}
            Load Live Analytics Data
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
