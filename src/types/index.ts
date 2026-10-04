// ============================================================
// VibeDash — Core Type Definitions
// ============================================================

// New 6-Stage Pipeline (customizable per user/project)
export type ProjectPhase =
  | "idea"           // 💡 Idea / Vibe Lock
  | "prototype"      // 🗂️ Prototyping / MVP Build
  | "free-tier"      // 🆓 Core Features / Free Tier
  | "premium"        // 💎 Premium Upsells
  | "deploy"         // 🌐 Setup & Deploy
  | "live";          // 🚀 Live & Monetize

export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

export interface PhaseInfo {
  id: ProjectPhase;
  label: string;
  icon: string;
  color: string;
  description: string;
  order: number;
  subTasks: string[]; // Suggested checklist items
}

export interface TimelineEvent {
  id: string;
  projectId: string;
  type: "creation" | "stage-change" | "commit-sync" | "ai-review" | "deadline" | "milestone";
  title: string;
  description: string;
  date: string;
  metadata?: Record<string, unknown>;
}

export interface AIReview {
  id: string;
  projectId: string;
  type: "code-review" | "commit-analysis";
  summary: string;
  completenessScore: number; // 0-100
  bugsFound: string[];
  suggestions: string[];
  suggestedTasks?: SuggestedTask[]; // AI-generated task recommendations
  recommendedStage?: ProjectPhase;
  recommendedProgress: number;
  stageProgressMap?: Record<ProjectPhase, number>; // Progress for ALL stages
  shouldUpdate: boolean;
  appliedAt?: string; // When the review was applied
  createdAt: string;
  commitsAnalyzed?: string[];
}

export interface SuggestedTask {
  title: string;
  description: string;
  phase: ProjectPhase;
  priority: "low" | "medium" | "high";
}

export interface Project {
  id: string;
  userId: string; // Clerk ID of the project owner
  name: string;
  description: string;
  currentPhase: ProjectPhase;
  phaseProgress: Record<ProjectPhase, number>; // 0-100 per phase
  phaseSubTasks: Record<ProjectPhase, SubTask[]>; // User's checklist per phase
  githubRepo: string;
  githubUrl: string;
  githubAccessToken?: string; // OAuth token for private repos
  techStack: string[];
  domain?: string;
  deploymentUrl?: string;
  lastCommit?: {
    message: string;
    author: string;
    date: string;
    sha: string;
  };
  recentCommits?: Array<{
    message: string;
    author: string;
    date: string;
    sha: string;
    diff?: string;
  }>;
  lastSyncedAt?: string;
  openIssues: number;
  stars: number;
  commits: number;
  createdAt: string;
  updatedAt: string;
  deadline?: string;
  revenue: number;
  monthlyVisitors: number;
  adSpend: number;
  status: "active" | "paused" | "completed";
  priority: "low" | "medium" | "high" | "critical";
  color: string;
  tasks: Task[];
  campaigns: Campaign[];
  timeline: TimelineEvent[];
  aiReviews: AIReview[];
  autoUpdateEnabled: boolean; // Whether to auto-apply AI suggestions
  // Google Analytics integration
  googleAnalytics?: {
    propertyId: string;      // GA4 property ID (e.g., "properties/123456789")
    propertyName: string;    // Human-readable name
    connectedAt: string;
    lastFetchedAt?: string;
    monthlyVisitorsGA?: number;   // Live monthly active users from GA
    totalVisitorsGA?: number;     // Total visitors from GA
  };
  // User Data Hub integration
  userDataConnection?: {
    externalApiUrl: string;
    connectedAt: string;
    lastFetchedAt?: string;
  };
}

// ============================================================
// User Data Hub — Connect external projects and analyze users
// ============================================================

export interface UserDataConnection {
  projectId: string;
  userId: string;
  externalApiUrl: string;
  connectedAt: string;
  lastFetchedAt?: string;
  cachedData?: Record<string, unknown>;
  viewConfig?: UserDataViewConfig;
  viewGeneratedAt?: string;
}

export interface ViewStatCard {
  type: "stat";
  label: string;
  dataPath: string; // dot-notation path into fetched JSON, e.g. "summary.totalUsers"
  icon: "users" | "crown" | "star" | "trending-up" | "bar-chart" | "zap" | "dollar";
  color: "blue" | "green" | "gold" | "violet" | "rose" | "orange";
  format?: "number" | "percent" | "currency";
}

export interface ViewChart {
  type: "bar" | "line" | "pie";
  title: string;
  dataPath: string; // path to an array in fetched JSON
  xKey: string;
  yKey: string;
}

export interface ViewTable {
  type: "table";
  title: string;
  dataPath: string; // path to an array in fetched JSON
  columns: string[];
}

export interface ViewTab {
  title: string;
  description?: string;
  cards?: ViewStatCard[];
  charts?: ViewChart[];
  tables?: ViewTable[];
}

export interface UserDataViewConfig {
  title: string;
  description?: string;
  /** When present the view renders as a tabbed layout. Each tab groups related cards/charts/tables. */
  tabs?: ViewTab[];
  /** Flat list of cards — used when no tabs are defined. */
  cards: ViewStatCard[];
  /** Flat list of charts — used when no tabs are defined. */
  charts: ViewChart[];
  /** Flat list of tables — used when no tabs are defined. */
  tables: ViewTable[];
  generatedAt: string;
}

export interface GoogleAnalyticsProperty {
  propertyId: string;
  displayName: string;
  websiteUrl?: string;
}

export interface GoogleAnalyticsData {
  monthlyVisitors: number;
  totalVisitors: number;
  dailyVisitors: Array<{ date: string; visitors: number }>;
  topPages: Array<{ page: string; views: number }>;
  fetchedAt: string;
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  phase: ProjectPhase;
  status: "todo" | "in-progress" | "done";
  priority: "low" | "medium" | "high";
  dueDate?: string;
  createdAt: string;
}

export type CampaignPlatform =
  | "google"
  | "facebook"
  | "instagram"
  | "twitter"
  | "tiktok"
  | "linkedin"
  | "youtube"
  | "pinterest"
  | "snapchat"
  | "reddit"
  | "threads";

export interface Campaign {
  id: string;
  projectId: string;
  platform: CampaignPlatform;
  name: string;
  status: "draft" | "active" | "paused" | "completed";
  budget: number;
  spent: number;
  impressions: number;
  clicks: number;
  conversions: number;
  startDate: string;
  endDate?: string;
  screenshotUrls?: string[]; // Base64 data URLs of uploaded screenshots
  aiAnalysis?: CampaignAIAnalysis;
}

export interface CampaignAIAnalysis {
  summary: string;
  engagementScore: number; // 0-100
  sentiment: "positive" | "neutral" | "negative";
  keyFindings: string[];
  suggestedBudget: number;
  estimatedImpressions: number;
  estimatedClicks: number;
  estimatedConversions: number;
  recommendations: string[];
  createdAt: string;
}

export interface AIInsight {
  id: string;
  projectId: string;
  projectName: string;
  type: "suggestion" | "warning" | "opportunity" | "milestone";
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  createdAt: string;
  actionable: boolean;
  action?: string;
}

// ── Revenue Action Streak ─────────────────────────────────

export interface RevenueAction {
  id: string;
  type: "money-step" | "revenue-task";
  label: string;
  projectName?: string;
  completedAt: string; // ISO
}

export interface RevenueStreak {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  lastActionAt: string | null;       // ISO of most recent revenue action
  todayActions: RevenueAction[];     // actions completed today
  streakDates: string[];             // ordered YYYY-MM-DD of consecutive streak days
  updatedAt: string;
}

// ── Today's Top 3 Actions ─────────────────────────────────

export type Top3ImpactTag = "revenue" | "progress" | "unblock";

export interface Top3Action {
  id: string;
  projectId: string;
  projectName: string;
  pipelineStage: ProjectPhase;
  nextStep: string;          // single executable task
  expectedOutcome: string;   // e.g. "unblock", "send proposal", "close deal"
  impactTag: Top3ImpactTag;
  pinned: boolean;           // manual override — pinned by user
  completedAt?: string;      // ISO date when marked done
}

export interface Top3DayEntry {
  id: string;
  userId: string;
  date: string;              // YYYY-MM-DD
  actions: Top3Action[];
  generatedAt: string;
  refreshHour: number;       // 0-23, configurable daily refresh time
}

export interface Top3Settings {
  enabled: boolean;          // master switch
  deliveryEmail: boolean;    // send via email
  deliveryInApp: boolean;    // show in-app notification
  deliveryTime: string;      // HH:mm (24h) — when to send / refresh
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatSession {
  id: string;
  userId: string;
  messages: ChatMessage[];
  summary: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  totalProjects: number;
  activeProjects: number;
  totalRevenue: number;
  totalAdSpend: number;
  totalVisitors: number;
  totalCommits: number;
  projectsByPhase: Record<ProjectPhase, number>;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  plan: "free" | "trial" | "pro" | "enterprise";
  trialStartedAt?: string;
  trialEndsAt?: string;
  githubConnected: boolean;
  onboardingCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

// GitHub Repository type for onboarding
export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  created_at: string;
  updated_at: string;
  topics: string[];
}
