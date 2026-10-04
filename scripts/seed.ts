#!/usr/bin/env npx tsx
// ============================================================
// VibeDash — Database Seed Script
// Creates a demo user and populates the database with sample data
//
// Usage:
//   npx tsx scripts/seed.ts          # seed (skips if data exists)
//   npx tsx scripts/seed.ts --force  # drop existing data and re-seed
//   npm run seed                     # via package.json script
//   npm run seed:force               # force re-seed
// ============================================================

import { MongoClient, ObjectId } from "mongodb";

// --------------- Config ---------------

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("Error: MONGODB_URI environment variable is not set.");
  console.error("Set it in .env.local or pass it inline: MONGODB_URI=... npx tsx scripts/seed.ts");
  process.exit(1);
}

const DB_NAME = "vibedash";
const FORCE = process.argv.includes("--force");

// --------------- Types ---------------

type ProjectPhase =
  | "idea"
  | "development"
  | "free-features"
  | "premium-features"
  | "monetization"
  | "infrastructure"
  | "marketing"
  | "live";

// --------------- Demo User ---------------
// Note: This demo user has a fixed clerkId for demo purposes
// In production, this would be a real Clerk user ID
const DEMO_CLERK_ID = "demo_user_660000000000000000000001";

const demoUser = {
  _id: new ObjectId("660000000000000000000001"),
  clerkId: DEMO_CLERK_ID,
  email: "demo@example.com",
  name: "Demo User",
  avatar: "https://api.dicebear.com/9.x/bottts-neutral/svg?seed=vibedash",
  plan: "pro" as const,
  githubConnected: true,
  onboardingCompleted: true,
  createdAt: "2025-06-01T00:00:00Z",
  updatedAt: "2025-06-01T00:00:00Z",
};

// --------------- Demo Projects ---------------

const demoProjects = [
  {
    userId: DEMO_CLERK_ID,
    name: "VibeTracker",
    description:
      "AI-powered habit tracking app with social accountability features",
    currentPhase: "marketing" as ProjectPhase,
    phaseProgress: {
      idea: 100,
      development: 100,
      "free-features": 100,
      "premium-features": 85,
      monetization: 100,
      infrastructure: 100,
      marketing: 35,
      live: 0,
    },
    githubRepo: "user/vibetracker",
    githubUrl: "https://github.com/user/vibetracker",
    techStack: ["Next.js", "MongoDB", "Tailwind", "OpenAI"],
    domain: "vibetracker.app",
    deploymentUrl: "https://vibetracker.app",
    lastCommit: {
      message: "feat: add social sharing for streaks",
      author: "demo-user",
      date: "2026-02-05T14:30:00Z",
      sha: "a1b2c3d",
    },
    openIssues: 3,
    stars: 47,
    commits: 234,
    createdAt: "2025-10-15T00:00:00Z",
    updatedAt: "2026-02-05T14:30:00Z",
    revenue: 1240,
    monthlyVisitors: 3200,
    adSpend: 450,
    status: "active",
    priority: "high",
    color: "#8B5CF6",
    tasks: [
      {
        id: "t1",
        projectId: "proj-1",
        title: "Set up Google Ads campaign",
        description:
          "Create search and display campaigns targeting habit tracking keywords",
        phase: "marketing",
        status: "in-progress",
        priority: "high",
        dueDate: "2026-02-10",
        createdAt: "2026-02-01T00:00:00Z",
      },
      {
        id: "t2",
        projectId: "proj-1",
        title: "Create Instagram content calendar",
        description: "Plan 30 days of social media content",
        phase: "marketing",
        status: "todo",
        priority: "medium",
        dueDate: "2026-02-15",
        createdAt: "2026-02-01T00:00:00Z",
      },
      {
        id: "t3",
        projectId: "proj-1",
        title: "Optimize landing page copy",
        description:
          "A/B test headlines and CTAs for better conversion rates",
        phase: "marketing",
        status: "todo",
        priority: "high",
        dueDate: "2026-02-18",
        createdAt: "2026-02-03T00:00:00Z",
      },
    ],
    campaigns: [
      {
        id: "c1",
        projectId: "proj-1",
        platform: "google",
        name: "Habit Tracker - Search",
        status: "active",
        budget: 500,
        spent: 320,
        impressions: 45000,
        clicks: 1200,
        conversions: 85,
        startDate: "2026-01-15",
      },
      {
        id: "c2",
        projectId: "proj-1",
        platform: "instagram",
        name: "VibeTracker Launch",
        status: "active",
        budget: 300,
        spent: 130,
        impressions: 28000,
        clicks: 890,
        conversions: 42,
        startDate: "2026-01-20",
      },
    ],
  },
  {
    userId: DEMO_CLERK_ID,
    name: "CodePilotAI",
    description: "AI code review bot that integrates with GitHub PRs",
    currentPhase: "premium-features" as ProjectPhase,
    phaseProgress: {
      idea: 100,
      development: 100,
      "free-features": 100,
      "premium-features": 40,
      monetization: 10,
      infrastructure: 60,
      marketing: 0,
      live: 0,
    },
    githubRepo: "user/codepilot-ai",
    githubUrl: "https://github.com/user/codepilot-ai",
    techStack: ["Python", "FastAPI", "React", "GPT-4"],
    domain: "codepilotai.dev",
    deploymentUrl: "",
    lastCommit: {
      message: "feat: implement advanced security scanning module",
      author: "demo-user",
      date: "2026-02-04T09:15:00Z",
      sha: "e5f6g7h",
    },
    openIssues: 12,
    stars: 128,
    commits: 567,
    createdAt: "2025-08-20T00:00:00Z",
    updatedAt: "2026-02-04T09:15:00Z",
    revenue: 0,
    monthlyVisitors: 890,
    adSpend: 0,
    status: "active",
    priority: "critical",
    color: "#3B82F6",
    tasks: [
      {
        id: "t4",
        projectId: "proj-2",
        title: "Build team collaboration features",
        description: "Add team workspaces with shared review settings",
        phase: "premium-features",
        status: "in-progress",
        priority: "high",
        dueDate: "2026-02-20",
        createdAt: "2026-01-15T00:00:00Z",
      },
      {
        id: "t5",
        projectId: "proj-2",
        title: "Implement Stripe billing",
        description: "Set up subscription tiers with Stripe",
        phase: "monetization",
        status: "todo",
        priority: "high",
        dueDate: "2026-03-01",
        createdAt: "2026-01-20T00:00:00Z",
      },
      {
        id: "t6",
        projectId: "proj-2",
        title: "Add custom review rules",
        description:
          "Allow users to write custom lint / review rules in YAML",
        phase: "premium-features",
        status: "todo",
        priority: "medium",
        dueDate: "2026-02-28",
        createdAt: "2026-01-22T00:00:00Z",
      },
    ],
    campaigns: [],
  },
  {
    userId: DEMO_CLERK_ID,
    name: "SnapInvoice",
    description:
      "Snap a photo of a receipt and auto-generate professional invoices",
    currentPhase: "development" as ProjectPhase,
    phaseProgress: {
      idea: 100,
      development: 55,
      "free-features": 0,
      "premium-features": 0,
      monetization: 0,
      infrastructure: 15,
      marketing: 0,
      live: 0,
    },
    githubRepo: "user/snap-invoice",
    githubUrl: "https://github.com/user/snap-invoice",
    techStack: ["React Native", "Node.js", "Tesseract", "MongoDB"],
    domain: "",
    deploymentUrl: "",
    lastCommit: {
      message: "feat: OCR receipt scanning with edge detection",
      author: "demo-user",
      date: "2026-02-06T02:00:00Z",
      sha: "i8j9k0l",
    },
    openIssues: 5,
    stars: 22,
    commits: 89,
    createdAt: "2026-01-05T00:00:00Z",
    updatedAt: "2026-02-06T02:00:00Z",
    revenue: 0,
    monthlyVisitors: 0,
    adSpend: 0,
    status: "active",
    priority: "medium",
    color: "#10B981",
    tasks: [
      {
        id: "t7",
        projectId: "proj-3",
        title: "Complete OCR pipeline",
        description: "Finish the receipt scanning and data extraction",
        phase: "development",
        status: "in-progress",
        priority: "high",
        dueDate: "2026-02-15",
        createdAt: "2026-01-10T00:00:00Z",
      },
      {
        id: "t8",
        projectId: "proj-3",
        title: "Design invoice templates",
        description: "Create 5 professional invoice templates",
        phase: "development",
        status: "todo",
        priority: "medium",
        dueDate: "2026-02-22",
        createdAt: "2026-01-12T00:00:00Z",
      },
    ],
    campaigns: [],
  },
  {
    userId: DEMO_CLERK_ID,
    name: "MealPrepPro",
    description:
      "AI meal planning with grocery list generation and nutrition tracking",
    currentPhase: "monetization" as ProjectPhase,
    phaseProgress: {
      idea: 100,
      development: 100,
      "free-features": 100,
      "premium-features": 100,
      monetization: 60,
      infrastructure: 80,
      marketing: 10,
      live: 0,
    },
    githubRepo: "user/mealprepro",
    githubUrl: "https://github.com/user/mealprepro",
    techStack: ["Next.js", "Prisma", "OpenAI", "Stripe"],
    domain: "mealprepro.com",
    deploymentUrl: "https://mealprepro.com",
    lastCommit: {
      message: "fix: correct tax calculation in Stripe checkout",
      author: "demo-user",
      date: "2026-02-03T18:45:00Z",
      sha: "m1n2o3p",
    },
    openIssues: 8,
    stars: 93,
    commits: 412,
    createdAt: "2025-06-10T00:00:00Z",
    updatedAt: "2026-02-03T18:45:00Z",
    revenue: 3850,
    monthlyVisitors: 8400,
    adSpend: 200,
    status: "active",
    priority: "high",
    color: "#F59E0B",
    tasks: [
      {
        id: "t9",
        projectId: "proj-4",
        title: "Set up annual billing option",
        description: "Add yearly subscription with 20% discount",
        phase: "monetization",
        status: "in-progress",
        priority: "high",
        dueDate: "2026-02-12",
        createdAt: "2026-01-25T00:00:00Z",
      },
      {
        id: "t10",
        projectId: "proj-4",
        title: "Launch TikTok recipe content",
        description:
          "Create short-form video content showcasing meal plans",
        phase: "marketing",
        status: "todo",
        priority: "medium",
        dueDate: "2026-02-28",
        createdAt: "2026-02-01T00:00:00Z",
      },
      {
        id: "t11",
        projectId: "proj-4",
        title: "Add referral program",
        description:
          "Give existing users a referral link with 1-month free for both parties",
        phase: "monetization",
        status: "todo",
        priority: "medium",
        dueDate: "2026-03-05",
        createdAt: "2026-02-02T00:00:00Z",
      },
    ],
    campaigns: [
      {
        id: "c3",
        projectId: "proj-4",
        platform: "google",
        name: "Meal Prep Keywords",
        status: "active",
        budget: 200,
        spent: 180,
        impressions: 32000,
        clicks: 950,
        conversions: 65,
        startDate: "2026-01-01",
      },
      {
        id: "c4",
        projectId: "proj-4",
        platform: "facebook",
        name: "Healthy Eating Audiences",
        status: "active",
        budget: 150,
        spent: 95,
        impressions: 18500,
        clicks: 620,
        conversions: 38,
        startDate: "2026-01-20",
      },
    ],
  },
  {
    userId: DEMO_CLERK_ID,
    name: "DevFolioX",
    description:
      "Auto-generate stunning developer portfolios from GitHub profiles",
    currentPhase: "idea" as ProjectPhase,
    phaseProgress: {
      idea: 70,
      development: 0,
      "free-features": 0,
      "premium-features": 0,
      monetization: 0,
      infrastructure: 0,
      marketing: 0,
      live: 0,
    },
    githubRepo: "user/devfoliox",
    githubUrl: "https://github.com/user/devfoliox",
    techStack: ["Astro", "Tailwind", "GitHub API"],
    domain: "",
    deploymentUrl: "",
    lastCommit: {
      message: "chore: initial project setup and research docs",
      author: "demo-user",
      date: "2026-02-01T10:00:00Z",
      sha: "q4r5s6t",
    },
    openIssues: 0,
    stars: 5,
    commits: 12,
    createdAt: "2026-01-28T00:00:00Z",
    updatedAt: "2026-02-01T10:00:00Z",
    revenue: 0,
    monthlyVisitors: 0,
    adSpend: 0,
    status: "active",
    priority: "low",
    color: "#EC4899",
    tasks: [
      {
        id: "t12",
        projectId: "proj-5",
        title: "Complete market research",
        description:
          "Analyze competitors and define unique value proposition",
        phase: "idea",
        status: "in-progress",
        priority: "medium",
        dueDate: "2026-02-08",
        createdAt: "2026-01-28T00:00:00Z",
      },
      {
        id: "t13",
        projectId: "proj-5",
        title: "Create wireframes",
        description:
          "Design initial wireframes for portfolio generator",
        phase: "idea",
        status: "todo",
        priority: "medium",
        dueDate: "2026-02-12",
        createdAt: "2026-01-28T00:00:00Z",
      },
    ],
    campaigns: [],
  },
  {
    userId: DEMO_CLERK_ID,
    name: "CloudCostPilot",
    description:
      "Real-time AWS/GCP cost monitoring with anomaly detection and budget alerts",
    currentPhase: "free-features" as ProjectPhase,
    phaseProgress: {
      idea: 100,
      development: 100,
      "free-features": 45,
      "premium-features": 0,
      monetization: 0,
      infrastructure: 30,
      marketing: 0,
      live: 0,
    },
    githubRepo: "user/cloud-cost-pilot",
    githubUrl: "https://github.com/user/cloud-cost-pilot",
    techStack: ["Go", "React", "Prometheus", "Grafana"],
    domain: "",
    deploymentUrl: "",
    lastCommit: {
      message: "feat: add daily cost digest email notifications",
      author: "demo-user",
      date: "2026-02-07T11:20:00Z",
      sha: "u7v8w9x",
    },
    openIssues: 6,
    stars: 34,
    commits: 156,
    createdAt: "2025-11-01T00:00:00Z",
    updatedAt: "2026-02-07T11:20:00Z",
    revenue: 0,
    monthlyVisitors: 420,
    adSpend: 0,
    status: "active",
    priority: "medium",
    color: "#06B6D4",
    tasks: [
      {
        id: "t14",
        projectId: "proj-6",
        title: "Build cost dashboard widgets",
        description:
          "Create interactive charts for daily/weekly/monthly spend",
        phase: "free-features",
        status: "in-progress",
        priority: "high",
        dueDate: "2026-02-14",
        createdAt: "2026-01-20T00:00:00Z",
      },
      {
        id: "t15",
        projectId: "proj-6",
        title: "Add Slack integration",
        description: "Send cost alerts to Slack channels",
        phase: "free-features",
        status: "todo",
        priority: "medium",
        dueDate: "2026-02-25",
        createdAt: "2026-01-22T00:00:00Z",
      },
    ],
    campaigns: [],
  },
];

// --------------- AI Insights ---------------

const demoInsights = [
  {
    projectId: "proj-1",
    projectName: "VibeTracker",
    type: "opportunity",
    title: "Expand to TikTok Ads",
    description:
      "VibeTracker's target demographic (18-35) is highly active on TikTok. Based on your Instagram campaign performance, a TikTok campaign could increase conversions by 40% with similar budget.",
    priority: "high",
    createdAt: "2026-02-05T12:00:00Z",
    actionable: true,
    action: "Create TikTok ad campaign",
  },
  {
    projectId: "proj-2",
    projectName: "CodePilotAI",
    type: "warning",
    title: "12 Open Issues Need Attention",
    description:
      "CodePilotAI has accumulated 12 open issues on GitHub. Resolving these before launching premium features will improve user trust and reduce churn risk.",
    priority: "high",
    createdAt: "2026-02-04T10:00:00Z",
    actionable: true,
    action: "Review and triage open issues",
  },
  {
    projectId: "proj-4",
    projectName: "MealPrepPro",
    type: "milestone",
    title: "Revenue Milestone: $3,850 MRR",
    description:
      "Congratulations! MealPrepPro has reached $3,850 in monthly recurring revenue. At this growth rate, you'll hit $5K MRR by March. Consider reinvesting 20% into marketing.",
    priority: "medium",
    createdAt: "2026-02-03T16:00:00Z",
    actionable: false,
  },
  {
    projectId: "proj-3",
    projectName: "SnapInvoice",
    type: "suggestion",
    title: "Prioritize Mobile-First Development",
    description:
      "Since SnapInvoice relies on camera/photo input, prioritize mobile UX. Consider using React Native's camera module with real-time edge detection for better receipt capture.",
    priority: "medium",
    createdAt: "2026-02-02T09:00:00Z",
    actionable: true,
    action: "Implement camera-first UX flow",
  },
  {
    projectId: "proj-5",
    projectName: "DevFolioX",
    type: "suggestion",
    title: "Validate Before Building",
    description:
      "Before starting development on DevFolioX, create a landing page and run a small ad campaign to validate demand. This could save weeks of development if the concept needs pivoting.",
    priority: "low",
    createdAt: "2026-02-01T08:00:00Z",
    actionable: true,
    action: "Create validation landing page",
  },
  {
    projectId: "proj-1",
    projectName: "VibeTracker",
    type: "suggestion",
    title: "A/B Test Pricing Page",
    description:
      "Your current pricing conversion rate is 2.6%. A/B testing different pricing layouts and copy could boost this to 4-5%, potentially doubling premium signups.",
    priority: "medium",
    createdAt: "2026-02-05T08:00:00Z",
    actionable: true,
    action: "Set up A/B test for pricing page",
  },
  {
    projectId: "proj-6",
    projectName: "CloudCostPilot",
    type: "opportunity",
    title: "DevOps Community Outreach",
    description:
      "Post CloudCostPilot on Hacker News and r/devops — cost monitoring tools with anomaly detection are trending. Early visibility can drive GitHub stars and beta signups.",
    priority: "medium",
    createdAt: "2026-02-07T14:00:00Z",
    actionable: true,
    action: "Write HN Show post draft",
  },
  {
    projectId: "proj-4",
    projectName: "MealPrepPro",
    type: "warning",
    title: "Ad Spend Efficiency Declining",
    description:
      "Google Ads CPA for MealPrepPro has risen 18% over the last 2 weeks ($2.77 → $3.27). Consider pausing underperforming ad groups and reallocating budget to Facebook where CPA is lower.",
    priority: "high",
    createdAt: "2026-02-06T10:30:00Z",
    actionable: true,
    action: "Audit Google Ads ad groups",
  },
];

// --------------- Activity Log ---------------

const demoActivity = [
  {
    type: "commit",
    projectName: "CloudCostPilot",
    message: "feat: add daily cost digest email notifications",
    timestamp: "2026-02-07T11:20:00Z",
  },
  {
    type: "commit",
    projectName: "SnapInvoice",
    message: "feat: OCR receipt scanning with edge detection",
    timestamp: "2026-02-06T02:00:00Z",
  },
  {
    type: "campaign",
    projectName: "MealPrepPro",
    message: "Facebook campaign 'Healthy Eating Audiences' launched",
    timestamp: "2026-02-05T16:00:00Z",
  },
  {
    type: "commit",
    projectName: "VibeTracker",
    message: "feat: add social sharing for streaks",
    timestamp: "2026-02-05T14:30:00Z",
  },
  {
    type: "milestone",
    projectName: "MealPrepPro",
    message: "Reached $3,850 MRR — on track for $5K by March",
    timestamp: "2026-02-05T08:00:00Z",
  },
  {
    type: "commit",
    projectName: "CodePilotAI",
    message: "feat: implement advanced security scanning module",
    timestamp: "2026-02-04T09:15:00Z",
  },
  {
    type: "phase",
    projectName: "MealPrepPro",
    message: "Advanced to Monetization phase",
    timestamp: "2026-02-03T18:45:00Z",
  },
  {
    type: "project",
    projectName: "DevFolioX",
    message: "New project created",
    timestamp: "2026-01-28T00:00:00Z",
  },
  {
    type: "campaign",
    projectName: "VibeTracker",
    message: "Instagram campaign 'VibeTracker Launch' started",
    timestamp: "2026-01-20T00:00:00Z",
  },
  {
    type: "campaign",
    projectName: "VibeTracker",
    message: "Google Ads campaign 'Habit Tracker - Search' started",
    timestamp: "2026-01-15T00:00:00Z",
  },
];

// --------------- Main ---------------

async function seed() {
  console.log("🌱 VibeDash Seed Script");
  console.log("========================\n");

  const client = new MongoClient(MONGODB_URI as string);

  try {
    await client.connect();
    console.log("✅ Connected to MongoDB\n");

    const db = client.db(DB_NAME);

    // ------- Check existing data -------
    const existingProjects = await db.collection("projects").countDocuments();
    const existingUsers = await db.collection("users").countDocuments();

    if ((existingProjects > 0 || existingUsers > 0) && !FORCE) {
      console.log(
        `⚠️  Database already has ${existingProjects} projects and ${existingUsers} users.`
      );
      console.log("   Run with --force to drop and re-seed.\n");
      return;
    }

    if (FORCE) {
      console.log("🗑️  --force flag detected. Dropping existing collections…");
      await db.collection("users").deleteMany({});
      await db.collection("projects").deleteMany({});
      await db.collection("insights").deleteMany({});
      await db.collection("activity").deleteMany({});
      console.log("   Done.\n");
    }

    // ------- Seed user -------
    console.log("👤 Creating demo user…");
    await db.collection("users").insertOne(demoUser);
    console.log(`   Email:    ${demoUser.email}`);
    console.log(`   Name:     ${demoUser.name}`);
    console.log(`   Plan:     ${demoUser.plan}`);
    console.log("");

    // ------- Seed projects -------
    console.log(`📦 Inserting ${demoProjects.length} projects…`);
    const result = await db.collection("projects").insertMany(demoProjects);
    const insertedIds = Object.values(result.insertedIds);
    demoProjects.forEach((p, i) => {
      console.log(`   [${i + 1}] ${p.name} (${p.currentPhase}) → ${insertedIds[i]}`);
    });
    console.log("");

    // ------- Seed insights -------
    console.log(`💡 Inserting ${demoInsights.length} AI insights…`);
    await db.collection("insights").insertMany(demoInsights);
    console.log("   Done.\n");

    // ------- Seed activity -------
    console.log(`📋 Inserting ${demoActivity.length} activity entries…`);
    await db.collection("activity").insertMany(demoActivity);
    console.log("   Done.\n");

    // ------- Summary -------
    console.log("========================");
    console.log("✅ Seed complete!");
    console.log("");
    console.log("Demo credentials:");
    console.log("  Email:    demo@example.com");
    console.log("  Password: demo1234");
    console.log("");
    console.log("Dashboard stats:");
    const totalRevenue = demoProjects.reduce((a, p) => a + p.revenue, 0);
    const totalAdSpend = demoProjects.reduce((a, p) => a + p.adSpend, 0);
    const totalVisitors = demoProjects.reduce(
      (a, p) => a + p.monthlyVisitors,
      0
    );
    const totalCommits = demoProjects.reduce((a, p) => a + p.commits, 0);
    console.log(`  Projects:     ${demoProjects.length}`);
    console.log(`  Revenue:      $${totalRevenue.toLocaleString()}`);
    console.log(`  Ad Spend:     $${totalAdSpend.toLocaleString()}`);
    console.log(`  Visitors:     ${totalVisitors.toLocaleString()}`);
    console.log(`  Commits:      ${totalCommits.toLocaleString()}`);
    console.log(`  Tasks:        ${demoProjects.reduce((a, p) => a + p.tasks.length, 0)}`);
    console.log(`  Campaigns:    ${demoProjects.reduce((a, p) => a + p.campaigns.length, 0)}`);
    console.log(`  AI Insights:  ${demoInsights.length}`);
    console.log(`  Activity Log: ${demoActivity.length}`);
    console.log("");
  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

seed();
