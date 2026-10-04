"use client";

import { useState } from "react";
import Link from "next/link";
import { Zap, ChevronDown, ChevronRight, ExternalLink, Copy, Check } from "lucide-react";

type Endpoint = {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  description: string;
  params?: { name: string; type: string; required: boolean; description: string }[];
  queryParams?: { name: string; type: string; description: string }[];
  body?: { name: string; type: string; required: boolean; description: string }[];
  response: string;
  example?: string;
};

// Every example on this page points at the deployment it is served from.
const API_BASE = `${(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/+$/, "")}/api/v1`;

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-green-500/20 text-green-400 border-green-500/30",
  POST: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  PATCH: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  DELETE: "bg-red-500/20 text-red-400 border-red-500/30",
};

const endpoints: { category: string; description: string; items: Endpoint[] }[] = [
  {
    category: "Projects",
    description: "Manage your vibe coding projects",
    items: [
      {
        method: "GET",
        path: "/api/v1/projects",
        description: "List all your projects with pagination, filtering, search, and sorting support.",
        queryParams: [
          { name: "status", type: "string", description: "Filter by status: active, paused, completed" },
          { name: "phase", type: "string", description: "Filter by pipeline phase: idea, prototype, free-tier, premium, deploy, live" },
          { name: "priority", type: "string", description: "Filter by priority: low, medium, high, critical" },
          { name: "search", type: "string", description: "Search by project name, description, or GitHub repo" },
          { name: "sortBy", type: "string", description: "Sort field: updatedAt, createdAt, name, revenue, stars, commits, monthlyVisitors (default: updatedAt)" },
          { name: "sortOrder", type: "string", description: "Sort direction: asc or desc (default: desc)" },
          { name: "limit", type: "number", description: "Max results per page (default: 50, max: 100)" },
          { name: "offset", type: "number", description: "Number of results to skip (default: 0)" },
        ],
        response: `{
  "data": [
    {
      "id": "665fa1...",
      "name": "My SaaS App",
      "description": "AI-powered writing assistant",
      "currentPhase": "prototype",
      "phaseProgress": { "idea": 100, "prototype": 45, ... },
      "githubRepo": "user/my-saas",
      "status": "active",
      "priority": "high",
      "revenue": 1200,
      "monthlyVisitors": 5400,
      "createdAt": "2026-01-15T10:00:00Z",
      "updatedAt": "2026-02-18T14:30:00Z"
    }
  ],
  "pagination": {
    "total": 12,
    "limit": 50,
    "offset": 0,
    "hasMore": false
  }
}`,
        example: `curl -H "Authorization: Bearer vd_your_key" \\
  "${API_BASE}/projects?status=active&priority=high&sortBy=revenue&sortOrder=desc"`,
      },
      {
        method: "GET",
        path: "/api/v1/projects/:id",
        description: "Get detailed information about a single project including tasks, campaigns, and sub-tasks.",
        params: [
          { name: "id", type: "string", required: true, description: "The project ID" },
        ],
        response: `{
  "data": {
    "id": "665fa1...",
    "name": "My SaaS App",
    "description": "AI-powered writing assistant",
    "currentPhase": "prototype",
    "phaseProgress": { "idea": 100, "prototype": 45, ... },
    "phaseSubTasks": { "idea": [...], "prototype": [...] },
    "githubRepo": "user/my-saas",
    "techStack": ["Next.js", "TypeScript", "MongoDB"],
    "tasks": [...],
    "campaigns": [...],
    "autoUpdateEnabled": true,
    "createdAt": "2026-01-15T10:00:00Z",
    "updatedAt": "2026-02-18T14:30:00Z"
  }
}`,
        example: `curl -H "Authorization: Bearer vd_your_key" \\
  ${API_BASE}/projects/665fa1...`,
      },
      {
        method: "PATCH",
        path: "/api/v1/projects/:id",
        description:
          "Update a project. Use this to change pipeline phase, status, priority, or other fields. A timeline event is automatically created when the phase changes.",
        params: [
          { name: "id", type: "string", required: true, description: "The project ID" },
        ],
        body: [
          { name: "name", type: "string", required: false, description: "Project name" },
          { name: "description", type: "string", required: false, description: "Project description" },
          { name: "currentPhase", type: "string", required: false, description: "Pipeline phase: idea, prototype, free-tier, premium, deploy, live" },
          { name: "status", type: "string", required: false, description: "Project status: active, paused, completed" },
          { name: "priority", type: "string", required: false, description: "Priority: low, medium, high, critical" },
          { name: "domain", type: "string", required: false, description: "Custom domain" },
          { name: "deploymentUrl", type: "string", required: false, description: "Deployment URL" },
          { name: "deadline", type: "string|null", required: false, description: "Deadline (ISO date string or null)" },
          { name: "autoUpdateEnabled", type: "boolean", required: false, description: "Whether AI auto-updates are enabled" },
        ],
        response: `{
  "data": {
    "id": "665fa1...",
    "name": "My SaaS App",
    "currentPhase": "free-tier",
    "status": "active",
    "priority": "high",
    "updatedAt": "2026-02-18T15:00:00Z"
  },
  "message": "Project updated successfully"
}`,
        example: `curl -X PATCH \\
  -H "Authorization: Bearer vd_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{"currentPhase": "free-tier", "priority": "high"}' \\
  ${API_BASE}/projects/665fa1...`,
      },
    ],
  },
  {
    category: "AI Reviews",
    description: "Access and trigger AI-powered code reviews and analysis",
    items: [
      {
        method: "GET",
        path: "/api/v1/projects/:id/reviews",
        description: "Get all AI reviews for a project, including code analysis, bug detection, and stage recommendations.",
        params: [
          { name: "id", type: "string", required: true, description: "The project ID" },
        ],
        response: `{
  "data": {
    "projectId": "665fa1...",
    "projectName": "My SaaS App",
    "reviews": [
      {
        "id": "rev-1708...",
        "type": "code-review",
        "summary": "Overall good structure...",
        "completenessScore": 72,
        "bugsFound": ["Unhandled promise rejection in auth.ts"],
        "suggestions": ["Add input validation to API routes"],
        "recommendedStage": "free-tier",
        "recommendedProgress": 75,
        "shouldUpdate": true,
        "createdAt": "2026-02-17T10:00:00Z"
      }
    ],
    "totalReviews": 1
  }
}`,
        example: `curl -H "Authorization: Bearer vd_your_key" \\
  ${API_BASE}/projects/665fa1.../reviews`,
      },
      {
        method: "POST",
        path: "/api/v1/projects/:id/trigger-review",
        description: "Trigger a new AI code review for a project. Fetches the latest code from the linked GitHub repo, analyzes it with AI, and returns an actionable review with completeness scores, bugs found, and stage recommendations. Optionally auto-applies the recommended stage change.",
        params: [
          { name: "id", type: "string", required: true, description: "The project ID" },
        ],
        body: [
          { name: "autoApply", type: "boolean", required: false, description: "If true, automatically apply the AI-recommended phase change (default: false)" },
        ],
        response: `{
  "data": {
    "review": {
      "id": "review-1708...",
      "type": "code-review",
      "summary": "The project has solid authentication and core CRUD...",
      "completenessScore": 72,
      "bugsFound": ["Unhandled promise rejection in auth.ts"],
      "suggestions": ["Add rate limiting to public endpoints"],
      "recommendedStage": "free-tier",
      "recommendedProgress": 75,
      "stageProgressMap": { "idea": 100, "prototype": 100, "free-tier": 75, ... },
      "shouldUpdate": true,
      "createdAt": "2026-02-18T12:00:00Z"
    },
    "projectId": "665fa1...",
    "projectName": "My SaaS App",
    "aiProvider": "grok"
  },
  "message": "AI code review completed successfully"
}`,
        example: `curl -X POST \\
  -H "Authorization: Bearer vd_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{"autoApply": true}' \\
  ${API_BASE}/projects/665fa1.../trigger-review`,
      },
    ],
  },
  {
    category: "Timeline",
    description: "Track project history and events",
    items: [
      {
        method: "GET",
        path: "/api/v1/projects/:id/timeline",
        description: "Get timeline events for a project including stage changes, commits, AI reviews, and milestones.",
        params: [
          { name: "id", type: "string", required: true, description: "The project ID" },
        ],
        queryParams: [
          { name: "type", type: "string", description: "Filter by event type: creation, stage-change, commit-sync, ai-review, deadline, milestone" },
          { name: "limit", type: "number", description: "Max events to return (default: 50, max: 100)" },
        ],
        response: `{
  "data": {
    "projectId": "665fa1...",
    "projectName": "My SaaS App",
    "events": [
      {
        "id": "evt-1708...",
        "type": "stage-change",
        "title": "Moved to free-tier (via API)",
        "description": "Pipeline changed from \\"prototype\\" to \\"free-tier\\" via external API",
        "date": "2026-02-18T15:00:00Z",
        "metadata": { "fromStage": "prototype", "toStage": "free-tier" }
      }
    ],
    "totalEvents": 1
  }
}`,
        example: `curl -H "Authorization: Bearer vd_your_key" \\
  "${API_BASE}/projects/665fa1.../timeline?type=stage-change"`,
      },
    ],
  },
  {
    category: "Campaigns",
    description: "Full CRUD for marketing campaigns across all projects",
    items: [
      {
        method: "GET",
        path: "/api/v1/campaigns",
        description: "List all marketing campaigns across all projects with filtering, search, sorting and pagination.",
        queryParams: [
          { name: "projectId", type: "string", description: "Filter by project ID" },
          { name: "platform", type: "string", description: "Filter by platform: google, facebook, instagram, twitter, tiktok, linkedin, youtube, pinterest, snapchat, reddit, threads" },
          { name: "status", type: "string", description: "Filter by status: draft, active, paused, completed" },
          { name: "search", type: "string", description: "Search by campaign name, platform, or project name" },
          { name: "sortBy", type: "string", description: "Sort field: startDate, budget, spent, impressions, clicks, conversions, name (default: startDate)" },
          { name: "sortOrder", type: "string", description: "Sort direction: asc or desc (default: desc)" },
          { name: "limit", type: "number", description: "Max results per page (default: 50, max: 100)" },
          { name: "offset", type: "number", description: "Number of results to skip (default: 0)" },
        ],
        response: `{
  "data": [
    {
      "id": "camp-1708...",
      "projectId": "665fa1...",
      "projectName": "My SaaS App",
      "platform": "google",
      "name": "Launch Campaign Q1",
      "status": "active",
      "budget": 5000,
      "spent": 2340,
      "impressions": 125000,
      "clicks": 3200,
      "conversions": 156,
      "startDate": "2026-01-01T00:00:00Z",
      "endDate": "2026-03-31T23:59:59Z"
    }
  ],
  "pagination": { "total": 8, "limit": 50, "offset": 0, "hasMore": false }
}`,
        example: `curl -H "Authorization: Bearer vd_your_key" \\
  "${API_BASE}/campaigns?platform=google&status=active&sortBy=conversions&sortOrder=desc"`,
      },
      {
        method: "POST",
        path: "/api/v1/campaigns",
        description: "Create a new marketing campaign on a project. A timeline event is automatically recorded.",
        body: [
          { name: "projectId", type: "string", required: true, description: "The project this campaign belongs to" },
          { name: "name", type: "string", required: true, description: "Campaign name" },
          { name: "platform", type: "string", required: true, description: "Platform: google, facebook, instagram, twitter, tiktok, linkedin, youtube, pinterest, snapchat, reddit, threads" },
          { name: "budget", type: "number", required: false, description: "Campaign budget (default: 0)" },
          { name: "status", type: "string", required: false, description: "Initial status: draft, active, paused, completed (default: draft)" },
          { name: "startDate", type: "string", required: false, description: "Start date (ISO string, default: now)" },
          { name: "endDate", type: "string", required: false, description: "End date (ISO string)" },
        ],
        response: `{
  "data": {
    "id": "camp-1708...",
    "projectId": "665fa1...",
    "platform": "google",
    "name": "Launch Campaign Q1",
    "status": "draft",
    "budget": 5000,
    "spent": 0,
    "impressions": 0,
    "clicks": 0,
    "conversions": 0,
    "startDate": "2026-01-01T00:00:00Z"
  },
  "message": "Campaign created successfully"
}`,
        example: `curl -X POST \\
  -H "Authorization: Bearer vd_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{"projectId":"665fa1...","name":"Launch Campaign Q1","platform":"google","budget":5000}' \\
  ${API_BASE}/campaigns`,
      },
      {
        method: "GET",
        path: "/api/v1/campaigns/:id",
        description: "Get a single campaign by its ID, including project info.",
        params: [
          { name: "id", type: "string", required: true, description: "The campaign ID (e.g. camp-1708...)" },
        ],
        response: `{
  "data": {
    "id": "camp-1708...",
    "projectId": "665fa1...",
    "projectName": "My SaaS App",
    "platform": "google",
    "name": "Launch Campaign Q1",
    "status": "active",
    "budget": 5000,
    "spent": 2340,
    "impressions": 125000,
    "clicks": 3200,
    "conversions": 156,
    "startDate": "2026-01-01T00:00:00Z",
    "aiAnalysis": { ... }
  }
}`,
        example: `curl -H "Authorization: Bearer vd_your_key" \\
  ${API_BASE}/campaigns/camp-1708...`,
      },
      {
        method: "PATCH",
        path: "/api/v1/campaigns/:id",
        description: "Update campaign fields like name, status, budget, platform, dates, or metrics.",
        params: [
          { name: "id", type: "string", required: true, description: "The campaign ID" },
        ],
        body: [
          { name: "name", type: "string", required: false, description: "Campaign name" },
          { name: "platform", type: "string", required: false, description: "Campaign platform" },
          { name: "status", type: "string", required: false, description: "Status: draft, active, paused, completed" },
          { name: "budget", type: "number", required: false, description: "Campaign budget" },
          { name: "spent", type: "number", required: false, description: "Amount spent" },
          { name: "impressions", type: "number", required: false, description: "Total impressions" },
          { name: "clicks", type: "number", required: false, description: "Total clicks" },
          { name: "conversions", type: "number", required: false, description: "Total conversions" },
          { name: "startDate", type: "string", required: false, description: "Start date (ISO string)" },
          { name: "endDate", type: "string|null", required: false, description: "End date (ISO string or null)" },
        ],
        response: `{
  "data": {
    "id": "camp-1708...",
    "projectId": "665fa1...",
    "projectName": "My SaaS App",
    "name": "Launch Campaign Q1",
    "status": "completed",
    "budget": 5000,
    "spent": 4800,
    ...
  },
  "message": "Campaign updated successfully"
}`,
        example: `curl -X PATCH \\
  -H "Authorization: Bearer vd_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{"status":"completed","spent":4800}' \\
  ${API_BASE}/campaigns/camp-1708...`,
      },
      {
        method: "DELETE",
        path: "/api/v1/campaigns/:id",
        description: "Delete a campaign by ID.",
        params: [
          { name: "id", type: "string", required: true, description: "The campaign ID" },
        ],
        response: `{
  "data": { "id": "camp-1708..." },
  "message": "Campaign deleted successfully"
}`,
        example: `curl -X DELETE \\
  -H "Authorization: Bearer vd_your_key" \\
  ${API_BASE}/campaigns/camp-1708...`,
      },
      {
        method: "POST",
        path: "/api/v1/campaigns/:id/results",
        description: "Send performance results/metrics for a campaign. Supports absolute mode (set exact values) or additive mode (add to existing). Returns derived metrics like CTR, conversion rate, and cost per conversion.",
        params: [
          { name: "id", type: "string", required: true, description: "The campaign ID" },
        ],
        body: [
          { name: "spent", type: "number", required: false, description: "Amount spent" },
          { name: "impressions", type: "number", required: false, description: "Impressions count" },
          { name: "clicks", type: "number", required: false, description: "Click count" },
          { name: "conversions", type: "number", required: false, description: "Conversion count" },
          { name: "status", type: "string", required: false, description: "Update status: draft, active, paused, completed" },
          { name: "endDate", type: "string", required: false, description: "Campaign end date (ISO string)" },
          { name: "mode", type: "string", required: false, description: "Update mode: 'absolute' (default) sets exact values, 'additive' adds to existing totals" },
        ],
        response: `{
  "data": {
    "id": "camp-1708...",
    "projectId": "665fa1...",
    "projectName": "My SaaS App",
    "spent": 2340,
    "impressions": 125000,
    "clicks": 3200,
    "conversions": 156,
    "derivedMetrics": {
      "ctr": 2.56,
      "conversionRate": 4.88,
      "costPerClick": 0.73,
      "costPerConversion": 15.00
    }
  },
  "message": "Campaign results updated (absolute mode)"
}`,
        example: `curl -X POST \\
  -H "Authorization: Bearer vd_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{"spent":500,"impressions":25000,"clicks":800,"conversions":32,"mode":"additive"}' \\
  ${API_BASE}/campaigns/camp-1708.../results`,
      },
      {
        method: "POST",
        path: "/api/v1/campaigns/:id/analyze",
        description: "Trigger AI analysis of a campaign using uploaded screenshots. Uses Grok Vision to analyze ad creatives and performance dashboards, returning engagement scores, sentiment, key findings, and budget recommendations.",
        params: [
          { name: "id", type: "string", required: true, description: "The campaign ID" },
        ],
        body: [
          { name: "images", type: "string[]", required: true, description: "Array of base64 data URL images (max 4). Format: data:image/png;base64,..." },
        ],
        response: `{
  "data": {
    "campaignId": "camp-1708...",
    "projectId": "665fa1...",
    "analysis": {
      "summary": "Strong visual engagement with clear CTAs...",
      "engagementScore": 78,
      "sentiment": "positive",
      "keyFindings": ["High click-through creative", "CTA placement is optimal"],
      "suggestedBudget": 6000,
      "estimatedImpressions": 200000,
      "estimatedClicks": 5200,
      "estimatedConversions": 260,
      "recommendations": ["Test video format", "Expand to Instagram"],
      "createdAt": "2026-02-18T12:00:00Z"
    }
  },
  "message": "Campaign AI analysis completed"
}`,
        example: `curl -X POST \\
  -H "Authorization: Bearer vd_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{"images":["data:image/png;base64,iVBOR..."]}' \\
  ${API_BASE}/campaigns/camp-1708.../analyze`,
      },
    ],
  },
  {
    category: "Campaign Statistics",
    description: "Aggregated marketing analytics across all campaigns",
    items: [
      {
        method: "GET",
        path: "/api/v1/campaigns/stats",
        description: "Get comprehensive campaign statistics including totals, averages, platform breakdowns, project breakdowns, and top performing campaigns. Supports filtering by platform and project.",
        queryParams: [
          { name: "platform", type: "string", description: "Filter stats by platform: google, facebook, instagram, etc." },
          { name: "projectId", type: "string", description: "Filter stats to a specific project" },
        ],
        response: `{
  "data": {
    "totalCampaigns": 14,
    "byStatus": { "draft": 2, "active": 6, "paused": 3, "completed": 3 },
    "totalBudget": 45000,
    "totalSpent": 32400,
    "budgetRemaining": 12600,
    "totalImpressions": 890000,
    "totalClicks": 21500,
    "totalConversions": 1240,
    "averageCtr": 2.42,
    "averageConversionRate": 5.77,
    "averageCostPerClick": 1.51,
    "averageCostPerConversion": 26.13,
    "byPlatform": {
      "google": { "campaigns": 5, "budget": 20000, "spent": 15200, "impressions": 450000, "clicks": 12000, "conversions": 680 },
      "facebook": { "campaigns": 4, "budget": 12000, "spent": 9800, ... }
    },
    "byProject": {
      "665fa1...": { "projectName": "My SaaS App", "campaigns": 3, "totalSpent": 8500, "totalConversions": 420 }
    },
    "topCampaigns": [
      { "id": "camp-...", "name": "Google Q1", "platform": "google", "projectName": "My SaaS", "spent": 5200, "conversions": 320, "clicks": 4500, "impressions": 120000 }
    ]
  }
}`,
        example: `curl -H "Authorization: Bearer vd_your_key" \\
  "${API_BASE}/campaigns/stats?platform=google"`,
      },
    ],
  },
  {
    category: "Pipelines",
    description: "Pipeline phase definitions and project distribution",
    items: [
      {
        method: "GET",
        path: "/api/v1/pipelines",
        description: "Get all pipeline phases with their labels, descriptions, and default sub-tasks. Use this to understand the available phases when moving projects between stages.",
        response: `{
  "data": [
    {
      "id": "idea",
      "label": "Idea / Vibe Lock",
      "icon": "💡",
      "color": "bg-yellow-500",
      "description": "Concept validation, initial prompt crafting...",
      "order": 0,
      "defaultSubTasks": ["Define core problem statement", ...]
    },
    {
      "id": "prototype",
      "label": "Prototyping / MVP Build",
      "icon": "🗂️",
      "order": 1,
      ...
    }
  ],
  "total": 6
}`,
        example: `curl -H "Authorization: Bearer vd_your_key" \\
  ${API_BASE}/pipelines`,
      },
      {
        method: "GET",
        path: "/api/v1/pipelines/projects",
        description: "Get all pipeline phases with the projects currently in each phase. Shows a Kanban-style overview of your entire pipeline. Supports filtering by status, priority, phase, and search.",
        queryParams: [
          { name: "status", type: "string", description: "Filter projects by status: active, paused, completed" },
          { name: "priority", type: "string", description: "Filter projects by priority: low, medium, high, critical" },
          { name: "phase", type: "string", description: "Show only a specific phase: idea, prototype, free-tier, premium, deploy, live" },
          { name: "search", type: "string", description: "Search projects by name or description" },
        ],
        response: `{
  "data": [
    {
      "phase": {
        "id": "idea",
        "label": "Idea / Vibe Lock",
        "icon": "💡",
        "color": "bg-yellow-500",
        "description": "Concept validation...",
        "order": 0
      },
      "projects": [
        {
          "id": "665fa1...",
          "name": "New AI Tool",
          "description": "AI-powered code generator",
          "status": "active",
          "priority": "high",
          "phaseProgress": { "idea": 60, ... },
          "githubRepo": "user/ai-tool",
          "revenue": 0,
          "updatedAt": "2026-02-18T14:30:00Z"
        }
      ],
      "projectCount": 1
    },
    {
      "phase": { "id": "prototype", "label": "Prototyping / MVP Build", ... },
      "projects": [...],
      "projectCount": 3
    }
  ],
  "summary": {
    "totalProjects": 12,
    "phaseCounts": { "idea": 1, "prototype": 3, "free-tier": 3, "premium": 2, "deploy": 1, "live": 2 }
  }
}`,
        example: `curl -H "Authorization: Bearer vd_your_key" \\
  "${API_BASE}/pipelines/projects?status=active"`,
      },
    ],
  },
  {
    category: "Statistics",
    description: "Get aggregated dashboard stats",
    items: [
      {
        method: "GET",
        path: "/api/v1/stats",
        description: "Get aggregated statistics across all your projects including counts, revenue, commits, and breakdowns by phase and priority.",
        response: `{
  "data": {
    "totalProjects": 12,
    "activeProjects": 8,
    "completedProjects": 2,
    "pausedProjects": 2,
    "totalRevenue": 4250,
    "totalCommits": 1847,
    "totalStars": 342,
    "totalVisitors": 15600,
    "projectsByPhase": {
      "idea": 2, "prototype": 3, "free-tier": 2,
      "premium": 1, "deploy": 1, "live": 1
    },
    "projectsByPriority": {
      "low": 2, "medium": 5, "high": 3, "critical": 2
    }
  }
}`,
        example: `curl -H "Authorization: Bearer vd_your_key" \\
  ${API_BASE}/stats`,
      },
    ],
  },
];

// ── Markdown generation helpers ──────────────────────────────────────────────

function endpointToMarkdown(ep: Endpoint): string {
  const lines: string[] = [];
  lines.push(`### \`${ep.method} ${ep.path}\``);
  lines.push("");
  lines.push(ep.description);
  lines.push("");

  if (ep.params && ep.params.length > 0) {
    lines.push("**Path Parameters**");
    lines.push("");
    lines.push("| Name | Type | Required | Description |");
    lines.push("|------|------|----------|-------------|");
    for (const p of ep.params) {
      lines.push(`| \`${p.name}\` | ${p.type} | ${p.required ? "✓" : ""} | ${p.description} |`);
    }
    lines.push("");
  }

  if (ep.queryParams && ep.queryParams.length > 0) {
    lines.push("**Query Parameters**");
    lines.push("");
    lines.push("| Name | Type | Description |");
    lines.push("|------|------|-------------|");
    for (const p of ep.queryParams) {
      lines.push(`| \`${p.name}\` | ${p.type} | ${p.description} |`);
    }
    lines.push("");
  }

  if (ep.body && ep.body.length > 0) {
    lines.push("**Request Body (JSON)**");
    lines.push("");
    lines.push("| Name | Type | Required | Description |");
    lines.push("|------|------|----------|-------------|");
    for (const p of ep.body) {
      lines.push(`| \`${p.name}\` | ${p.type} | ${p.required ? "✓" : ""} | ${p.description} |`);
    }
    lines.push("");
  }

  lines.push("**Response**");
  lines.push("");
  lines.push("```json");
  lines.push(ep.response);
  lines.push("```");
  lines.push("");

  if (ep.example) {
    lines.push("**Example**");
    lines.push("");
    lines.push("```bash");
    lines.push(ep.example);
    lines.push("```");
    lines.push("");
  }

  return lines.join("\n");
}

function categoryToMarkdown(group: { category: string; description: string; items: Endpoint[] }): string {
  const lines: string[] = [];
  lines.push(`## ${group.category}`);
  lines.push("");
  lines.push(group.description);
  lines.push("");
  for (const ep of group.items) {
    lines.push(endpointToMarkdown(ep));
  }
  return lines.join("\n");
}

function allDocsToMarkdown(): string {
  const lines: string[] = [];
  lines.push("# VibeDash API Reference");
  lines.push("");
  lines.push("Complete REST API reference for managing your vibe coding projects programmatically.");
  lines.push("");
  lines.push("## Authentication");
  lines.push("");
  lines.push("All API requests require an API key passed via the `Authorization` or `x-api-key` header:");
  lines.push("");
  lines.push("```bash");
  lines.push('curl -H "Authorization: Bearer vd_your_api_key_here" \\');
  lines.push(`  ${API_BASE}/projects`);
  lines.push("```");
  lines.push("");
  lines.push("## Base URL");
  lines.push("");
  lines.push("```");
  lines.push(API_BASE);
  lines.push("```");
  lines.push("");
  lines.push("## Endpoints");
  lines.push("");
  for (const group of endpoints) {
    lines.push(categoryToMarkdown(group));
  }
  return lines.join("\n");
}

// ── Copy-as-Markdown button ────────────────────────────────────────────────────

function CopyMarkdownButton({ markdown, label = "Copy as Markdown" }: { markdown: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5 text-green-400" />
          <span className="text-green-400">Copied!</span>
        </>
      ) : (
        <>
          <Copy className="h-3.5 w-3.5" />
          {label}
        </>
      )}
    </button>
  );
}

// ── CodeBlock ──────────────────────────────────────────────────────────────────

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group">
      <pre className="rounded-xl bg-zinc-900 border border-zinc-800 p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap text-zinc-300">
        {code}
      </pre>
      <button
        onClick={copy}
        className="absolute top-2 right-2 p-1.5 rounded-lg bg-zinc-800 border border-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-green-400" />
        ) : (
          <Copy className="h-3.5 w-3.5 text-zinc-400" />
        )}
      </button>
    </div>
  );
}

function EndpointCard({ endpoint }: { endpoint: Endpoint }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border border-zinc-800 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center gap-3 p-4 hover:bg-zinc-900/50 transition-colors text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <span
          className={`px-2 py-0.5 rounded-md text-xs font-bold border ${METHOD_COLORS[endpoint.method]}`}
        >
          {endpoint.method}
        </span>
        <code className="text-sm font-mono text-zinc-300">{endpoint.path}</code>
        <span className="text-sm text-zinc-500 ml-2 hidden sm:inline">
          — {endpoint.description.slice(0, 60)}
          {endpoint.description.length > 60 ? "..." : ""}
        </span>
        <span className="ml-auto">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-zinc-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-zinc-500" />
          )}
        </span>
      </button>

      {expanded && (
        <div className="border-t border-zinc-800 p-4 space-y-4 bg-zinc-950/50">
          <p className="text-sm text-zinc-400">{endpoint.description}</p>

          {endpoint.params && endpoint.params.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                Path Parameters
              </h4>
              <div className="space-y-1">
                {endpoint.params.map((p) => (
                  <div key={p.name} className="flex items-center gap-2 text-sm">
                    <code className="text-violet-400 font-mono">{p.name}</code>
                    <span className="text-zinc-600 text-xs">{p.type}</span>
                    {p.required && (
                      <span className="text-[10px] text-red-400 border border-red-500/30 rounded px-1">
                        required
                      </span>
                    )}
                    <span className="text-zinc-500 text-xs">— {p.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {endpoint.queryParams && endpoint.queryParams.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                Query Parameters
              </h4>
              <div className="space-y-1">
                {endpoint.queryParams.map((p) => (
                  <div key={p.name} className="flex items-center gap-2 text-sm">
                    <code className="text-violet-400 font-mono">{p.name}</code>
                    <span className="text-zinc-600 text-xs">{p.type}</span>
                    <span className="text-zinc-500 text-xs">— {p.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {endpoint.body && endpoint.body.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                Request Body (JSON)
              </h4>
              <div className="space-y-1">
                {endpoint.body.map((p) => (
                  <div key={p.name} className="flex items-start gap-2 text-sm">
                    <code className="text-violet-400 font-mono shrink-0">{p.name}</code>
                    <span className="text-zinc-600 text-xs shrink-0">{p.type}</span>
                    {p.required && (
                      <span className="text-[10px] text-red-400 border border-red-500/30 rounded px-1 shrink-0">
                        required
                      </span>
                    )}
                    <span className="text-zinc-500 text-xs">— {p.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
              Response
            </h4>
            <CodeBlock code={endpoint.response} />
          </div>

          {endpoint.example && (
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                Example
              </h4>
              <CodeBlock code={endpoint.example} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ApiDocsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 shadow-lg shadow-violet-500/25">
          <Zap className="h-5 w-5 text-white" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">VibeDash API</h1>
      </div>
      <p className="text-zinc-400 mb-8">
        Complete REST API reference for managing your vibe coding projects programmatically.
      </p>

      {/* Auth section */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-3" id="authentication">
          Authentication
        </h2>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-5 space-y-3">
          <p className="text-sm text-zinc-400">
            All API requests require authentication via an API key. You can create API keys from
            your{" "}
            <Link href="/dashboard/api-keys" className="text-violet-400 hover:underline">
              dashboard <ExternalLink className="inline h-3 w-3" />
            </Link>
            .
          </p>
          <p className="text-sm text-zinc-400">
            Pass your key in either the <code className="text-violet-400">Authorization</code>{" "}
            header or the <code className="text-violet-400">x-api-key</code> header:
          </p>
          <CodeBlock
            code={`# Option 1: Authorization header (recommended)
curl -H "Authorization: Bearer vd_your_api_key_here" \\
  ${API_BASE}/projects

# Option 2: x-api-key header
curl -H "x-api-key: vd_your_api_key_here" \\
  ${API_BASE}/projects`}
          />
        </div>
      </section>

      {/* Base URL */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-3" id="base-url">
          Base URL
        </h2>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-5">
          <p className="text-sm text-zinc-400 mb-2">
            All endpoints are prefixed with <code className="text-violet-400">/api/v1</code>:
          </p>
          <code className="text-sm font-mono text-zinc-300">
            {API_BASE}
          </code>
        </div>
      </section>

      {/* Error codes */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-3" id="errors">
          Error Handling
        </h2>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-5">
          <p className="text-sm text-zinc-400 mb-3">
            The API uses standard HTTP status codes. Error responses include a JSON body:
          </p>
          <CodeBlock
            code={`{
  "error": "Short error code",
  "message": "Human-readable description of the error"
}`}
          />
          <div className="mt-4 space-y-1">
            <div className="flex items-center gap-3 text-sm">
              <code className="text-green-400 font-mono w-10">200</code>
              <span className="text-zinc-400">Success</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <code className="text-amber-400 font-mono w-10">400</code>
              <span className="text-zinc-400">Bad request (validation error)</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <code className="text-red-400 font-mono w-10">401</code>
              <span className="text-zinc-400">Unauthorized (missing or invalid API key)</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <code className="text-red-400 font-mono w-10">404</code>
              <span className="text-zinc-400">Resource not found</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <code className="text-red-400 font-mono w-10">500</code>
              <span className="text-zinc-400">Internal server error</span>
            </div>
          </div>
        </div>
      </section>

      {/* Rate Limits */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-3" id="rate-limits">
          Rate Limits
        </h2>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-5">
          <p className="text-sm text-zinc-400">
            API requests are limited to <strong className="text-zinc-200">100 requests/minute</strong> per
            API key. If you exceed this limit, you&apos;ll receive a 429 status code.
          </p>
        </div>
      </section>

      {/* Endpoints */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold" id="endpoints">
            Endpoints
          </h2>
          <CopyMarkdownButton markdown={allDocsToMarkdown()} label="Copy all as Markdown" />
        </div>
        <div className="space-y-8">
          {endpoints.map((group) => (
            <div key={group.category}>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-lg font-semibold">{group.category}</h3>
                <CopyMarkdownButton markdown={categoryToMarkdown(group)} />
              </div>
              <p className="text-sm text-zinc-500 mb-3">{group.description}</p>
              <div className="space-y-2">
                {group.items.map((ep, i) => (
                  <EndpointCard key={i} endpoint={ep} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-16 pt-8 border-t border-zinc-800 text-center">
        <p className="text-xs text-zinc-600">
          VibeDash API v1 &middot;{" "}
          <Link href="/dashboard" className="text-violet-500 hover:underline">
            Go to Dashboard
          </Link>{" "}
          &middot;{" "}
          <Link href="/dashboard/api-keys" className="text-violet-500 hover:underline">
            Manage API Keys
          </Link>
        </p>
      </footer>
    </div>
  );
}
