"use client";

import { useState } from "react";
import { PLATFORM_LABELS } from "@/lib/constants";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { Campaign } from "@/types";
import { NewCampaignDialog } from "@/components/dashboard/new-campaign-dialog";
import {
  DollarSign,
  Eye,
  MousePointerClick,
  Target,
  BarChart3,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";

export default function MarketingPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  // Stats derived from real campaigns
  const totalBudget = campaigns.reduce((a, c) => a + c.budget, 0);
  const totalSpent = campaigns.reduce((a, c) => a + c.spent, 0);
  const totalImpressions = campaigns.reduce((a, c) => a + c.impressions, 0);
  const totalClicks = campaigns.reduce((a, c) => a + c.clicks, 0);
  const totalConversions = campaigns.reduce((a, c) => a + c.conversions, 0);
  const avgCTR =
    totalImpressions > 0
      ? ((totalClicks / totalImpressions) * 100).toFixed(1)
      : "0";
  const avgCPA =
    totalConversions > 0 ? (totalSpent / totalConversions).toFixed(2) : "0";

  const handleCampaignCreated = (campaign: Campaign) => {
    setCampaigns((prev) => [campaign, ...prev]);
  };

  const handleRemoveCampaign = (id: string) => {
    setCampaigns((prev) => prev.filter((c) => c.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Marketing Hub</h1>
          <p className="text-sm text-muted-foreground">
            Create campaigns, upload screenshots, and let AI analyze your
            marketing performance
          </p>
        </div>
        <NewCampaignDialog onCampaignCreated={handleCampaignCreated} />
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Total Budget</p>
                <p className="text-2xl font-bold">
                  ${totalBudget.toLocaleString()}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  ${totalSpent.toLocaleString()} spent
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
                <DollarSign className="h-5 w-5 text-red-500" />
              </div>
            </div>
            {totalBudget > 0 && (
              <Progress
                value={(totalSpent / totalBudget) * 100}
                className="mt-3 h-1.5"
              />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">
                  Est. Impressions
                </p>
                <p className="text-2xl font-bold">
                  {totalImpressions.toLocaleString()}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  across {campaigns.length} campaigns
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
                <Eye className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">
                  Click-through Rate
                </p>
                <p className="text-2xl font-bold">{avgCTR}%</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {totalClicks.toLocaleString()} total clicks
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10">
                <MousePointerClick className="h-5 w-5 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Conversions</p>
                <p className="text-2xl font-bold">{totalConversions}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  ${avgCPA} avg. CPA
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500/10">
                <Target className="h-5 w-5 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Campaign list */}
      <div className="space-y-3">
        {campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-20">
            <BarChart3 className="h-10 w-10 text-muted-foreground" />
            <p className="mt-4 text-sm font-medium">No campaigns yet</p>
            <p className="mt-1 max-w-xs text-center text-xs text-muted-foreground">
              Click &quot;New Campaign&quot; to select a platform, upload
              screenshots, and let Grok Vision AI analyze your marketing
              performance.
            </p>
          </div>
        ) : (
          campaigns.map((campaign) => (
            <Card
              key={campaign.id}
              className="transition-all hover:shadow-md"
            >
              <CardContent className="p-5">
                {/* Header row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="secondary"
                      className="text-xs capitalize gap-1.5"
                    >
                      {PLATFORM_LABELS[campaign.platform] || campaign.platform}
                    </Badge>
                    <span className="text-sm font-semibold">
                      {campaign.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs capitalize",
                        campaign.status === "active" &&
                          "border-green-500/30 text-green-500",
                        campaign.status === "paused" &&
                          "border-yellow-500/30 text-yellow-500",
                      )}
                    >
                      {campaign.status}
                    </Badge>
                    <button
                      onClick={() => handleRemoveCampaign(campaign.id)}
                      className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Metrics */}
                <div className="mt-4 grid grid-cols-5 gap-4 text-center">
                  <div>
                    <p className="text-sm font-semibold">
                      ${campaign.budget.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Budget</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      {campaign.impressions.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Impressions
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      {campaign.clicks.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Clicks</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      {campaign.impressions > 0
                        ? (
                            (campaign.clicks / campaign.impressions) *
                            100
                          ).toFixed(1)
                        : "0"}
                      %
                    </p>
                    <p className="text-[10px] text-muted-foreground">CTR</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      {campaign.conversions}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Conversions
                    </p>
                  </div>
                </div>

                {/* AI Analysis panel */}
                {campaign.aiAnalysis && (
                  <div className="mt-4 rounded-xl bg-muted/50 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-violet-500">
                      <Sparkles className="h-3.5 w-3.5" />
                      AI Analysis
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {campaign.aiAnalysis.summary}
                    </p>

                    {/* Engagement */}
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-28">
                        Engagement
                      </span>
                      <Progress
                        value={campaign.aiAnalysis.engagementScore}
                        className="flex-1 h-1.5"
                      />
                      <span className="text-xs font-bold w-8 text-right">
                        {campaign.aiAnalysis.engagementScore}%
                      </span>
                    </div>

                    {/* Recommendations */}
                    {campaign.aiAnalysis.recommendations.length > 0 && (
                      <ul className="space-y-1">
                        {campaign.aiAnalysis.recommendations
                          .slice(0, 3)
                          .map((r, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-2 text-xs text-muted-foreground"
                            >
                              <TrendingUp className="h-3 w-3 text-violet-400 mt-0.5 shrink-0" />
                              {r}
                            </li>
                          ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Screenshot thumbnails */}
                {campaign.screenshotUrls &&
                  campaign.screenshotUrls.length > 0 && (
                    <div className="mt-3 flex gap-2 overflow-x-auto">
                      {campaign.screenshotUrls.map((url, idx) => (
                        <img
                          key={idx}
                          src={url}
                          alt={`Screenshot ${idx + 1}`}
                          className="h-16 w-28 rounded-lg object-cover border border-border shrink-0"
                        />
                      ))}
                    </div>
                  )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}