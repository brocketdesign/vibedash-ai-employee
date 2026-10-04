// ============================================================
// VibeDash — Constants & Phase Definitions (6-Stage Pipeline)
// ============================================================

import { PhaseInfo, ProjectPhase, SubTask } from "@/types";

// Contact address shown on the landing, terms and privacy pages.
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@example.com";

// New 6-Stage Vibe Coding Pipeline
export const PHASES: PhaseInfo[] = [
  {
    id: "idea",
    label: "Idea / Vibe Lock",
    icon: "💡",
    color: "bg-yellow-500",
    description: "Concept validation, initial prompt crafting, vibe specification",
    order: 0,
    subTasks: [
      "Define core problem statement",
      "Craft initial AI prompts",
      "Validate concept with 3 potential users",
      "Set project scope boundaries",
      "Create vibe document",
    ],
  },
  {
    id: "prototype",
    label: "Prototyping / MVP Build",
    icon: "🗂️",
    color: "bg-blue-500",
    description: "Rapid development, initial prompt runs, core functionality assembly",
    order: 1,
    subTasks: [
      "Initial prompt runs with AI",
      "Core functionality assembly",
      "Basic UI/UX implementation",
      "First working prototype",
      "Vibe check: Does it feel right?",
    ],
  },
  {
    id: "free-tier",
    label: "Core Features / Free Tier",
    icon: "🆓",
    color: "bg-green-500",
    description: "Polish free-tier features, core value proposition, user onboarding",
    order: 2,
    subTasks: [
      "Complete core user flows",
      "Implement user authentication",
      "Add error handling & edge cases",
      "Create onboarding experience",
      "Gather initial user feedback",
    ],
  },
  {
    id: "premium",
    label: "Premium Upsells",
    icon: "💎",
    color: "bg-purple-500",
    description: "Premium/paid features, advanced functionality, value differentiation",
    order: 3,
    subTasks: [
      "Identify premium feature gaps",
      "Implement paid feature gates",
      "Add usage limits & quotas",
      "Create upgrade prompts",
      "Test conversion funnel",
    ],
  },
  {
    id: "deploy",
    label: "Setup & Deploy",
    icon: "🌐",
    color: "bg-orange-500",
    description: "Environment variables, deployment config, monitoring, production readiness",
    order: 4,
    subTasks: [
      "Configure environment variables for production",
      "Set up deployment platform (Vercel/Heroku)",
      "Set up monitoring & alerts",
      "Performance optimization",
      "Configure custom domain (if needed)",
    ],
  },
  {
    id: "live",
    label: "Live & Monetize",
    icon: "🚀",
    color: "bg-teal-500",
    description: "Production launch, marketing, monetization, growth optimization",
    order: 5,
    subTasks: [
      "Launch to public",
      "Set up analytics tracking",
      "Initiate marketing campaigns",
      "Monitor user acquisition",
      "Optimize conversion rates",
    ],
  },
];

// Generate default subtasks for a new project
export function generateDefaultSubTasks(phaseId: ProjectPhase): SubTask[] {
  const phase = PHASES.find((p) => p.id === phaseId);
  if (!phase) return [];
  
  return phase.subTasks.map((title, index) => ({
    id: `${phaseId}-task-${index}`,
    title,
    completed: false,
  }));
}

// Generate default phase progress (0 for all)
export function generateDefaultPhaseProgress(): Record<ProjectPhase, number> {
  return {
    idea: 0,
    prototype: 0,
    "free-tier": 0,
    premium: 0,
    deploy: 0,
    live: 0,
  };
}

// Generate default subtasks for all phases
export function generateDefaultPhaseSubTasks(): Record<ProjectPhase, SubTask[]> {
  return {
    idea: generateDefaultSubTasks("idea"),
    prototype: generateDefaultSubTasks("prototype"),
    "free-tier": generateDefaultSubTasks("free-tier"),
    premium: generateDefaultSubTasks("premium"),
    deploy: generateDefaultSubTasks("deploy"),
    live: generateDefaultSubTasks("live"),
  };
}

export const PHASE_MAP: Record<ProjectPhase, PhaseInfo> = PHASES.reduce(
  (acc, phase) => ({ ...acc, [phase.id]: phase }),
  {} as Record<ProjectPhase, PhaseInfo>
);

// Legacy phase mapping for data migration (if needed)
export const LEGACY_PHASE_MAP: Record<string, ProjectPhase> = {
  "idea": "idea",
  "development": "prototype",
  "free-features": "free-tier",
  "premium-features": "premium",
  "monetization": "live",
  "infrastructure": "deploy",
  "marketing": "live",
  "live": "live",
};

export const PLATFORM_COLORS: Record<string, string> = {
  google: "bg-red-500",
  facebook: "bg-blue-600",
  instagram: "bg-gradient-to-r from-purple-500 to-pink-500",
  twitter: "bg-sky-500",
  tiktok: "bg-black",
  linkedin: "bg-blue-700",
  youtube: "bg-red-600",
  pinterest: "bg-red-700",
  snapchat: "bg-yellow-400",
  reddit: "bg-orange-600",
  threads: "bg-neutral-900",
};

export const PLATFORM_LABELS: Record<string, string> = {
  google: "Google Ads",
  facebook: "Facebook",
  instagram: "Instagram",
  twitter: "X (Twitter)",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  pinterest: "Pinterest",
  snapchat: "Snapchat",
  reddit: "Reddit",
  threads: "Threads",
};

export const ALL_PLATFORMS = [
  "google",
  "facebook",
  "instagram",
  "twitter",
  "tiktok",
  "linkedin",
  "youtube",
  "pinterest",
  "snapchat",
  "reddit",
  "threads",
] as const;

export const PRIORITY_COLORS = {
  low: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  high: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  critical: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

export const STATUS_COLORS = {
  active: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  paused: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
  completed: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
};
