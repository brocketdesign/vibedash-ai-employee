# VibeDash — Feature Documentation

> **Vibe Coding Management Dashboard**
> A Next.js dashboard for managing multiple side projects through an 8-phase pipeline — from Idea to Live — with GitHub metrics, AI-powered insights, marketing campaign tracking, and revenue monitoring.

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Data Model](#data-model)
- [Pages & Features](#pages--features)
  - [Landing Page](#1-landing-page)
  - [Login Page](#2-login-page)
  - [Dashboard Home](#3-dashboard-home)
  - [Projects List](#4-projects-list)
  - [Project Detail](#5-project-detail)
  - [Pipeline (Kanban)](#6-pipeline-kanban)
  - [AI Advisor](#7-ai-advisor)
  - [GitHub Integration](#8-github-integration)
  - [Marketing Hub](#9-marketing-hub)
  - [Settings](#10-settings)
- [Shared Components](#shared-components)
- [UI Component Library](#ui-component-library)
- [Implementation Status](#implementation-status)

---

## Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| Next.js | 16.1.6 | App Router framework |
| React | 19.2.3 | UI library |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | v4 | Utility-first styling |
| shadcn/ui | new-york | Pre-built UI components (Radix primitives) |
| Lucide React | — | Icon library |
| Recharts | 3.7.0 | Charting (installed, not yet rendered) |
| MongoDB | 7.1.0 | Database |
| date-fns | — | Date formatting |
| cmdk | — | Command palette component |

---

## Project Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout (fonts, metadata, dark mode)
│   ├── page.tsx                # Marketing landing page
│   ├── globals.css             # Global styles
│   ├── login/page.tsx          # Authentication page
│   └── dashboard/
│       ├── layout.tsx          # Dashboard shell (sidebar + header)
│       ├── page.tsx            # Dashboard home
│       ├── projects/
│       │   ├── page.tsx        # Projects list (grid/list view)
│       │   └── [id]/page.tsx   # Project detail (dynamic route)
│       ├── pipeline/page.tsx   # Kanban board
│       ├── ai-advisor/page.tsx # AI insights & chat
│       ├── github/page.tsx     # GitHub integration
│       ├── marketing/page.tsx  # Marketing hub
│       └── settings/page.tsx   # User settings
├── components/
│   ├── header.tsx              # Top navigation bar
│   ├── sidebar.tsx             # Side navigation
│   ├── theme-provider.tsx      # Dark/light theme context
│   ├── theme-toggle.tsx        # Theme toggle button
│   ├── dashboard/              # Dashboard-specific components
│   └── ui/                     # shadcn/ui primitives
├── lib/
│   ├── constants.ts            # Phase definitions, style maps
│   ├── mock-data.ts            # Static sample data (5 projects)
│   └── utils.ts                # Utility functions (cn)
└── types/
    └── index.ts                # TypeScript interfaces
```

---

## Data Model

### Core Types

| Type | Description |
|---|---|
| `ProjectPhase` | Union of 8 phases: `idea` → `planning` → `free-features` → `development` → `premium-features` → `monetization` → `marketing` → `live` |
| `PhaseInfo` | Phase metadata: id, name, icon (emoji), color (Tailwind class), description, order |
| `Project` | Full project entity with name, description, phase, progress per phase, GitHub fields, tech stack, domain, revenue, visitors, ad spend, tasks, campaigns |
| `Task` | Task with title, status (`todo` / `in-progress` / `done`), phase, due date, priority |
| `Campaign` | Ad campaign per platform with budget, spend, impressions, clicks, conversions |
| `AIInsight` | AI recommendation typed as `suggestion` / `warning` / `opportunity` / `milestone` |
| `DashboardStats` | Aggregate metrics: project count, revenue, ad spend, visitors, commits, phase distribution |
| `User` | User profile with plan tier (`free` / `pro` / `enterprise`) and GitHub connection status |

### Mock Data

5 sample projects are included:

| # | Project | Current Phase | Revenue | Tech Stack |
|---|---|---|---|---|
| 1 | VibeTracker | Marketing | $1,240/mo | Next.js, MongoDB, Tailwind, OpenAI |
| 2 | CodePilotAI | Premium Features | $0 | Python, FastAPI, React, GPT-4 |
| 3 | SnapInvoice | Development | $0 | React Native, Node.js, Tesseract, MongoDB |
| 4 | MealPrepPro | Monetization | $3,850/mo | Next.js, Prisma, OpenAI, Stripe |
| 5 | DevFolioX | Idea | $0 | Astro, Tailwind, GitHub API |

---

## Pages & Features

### 1. Landing Page
**Route:** `/`
**Status:** ✅ Implemented (static)

- Fixed navbar with logo and navigation links (Features / How It Works / Pricing)
- Hero section with gradient text, tagline, and social proof stats (2,400+ users, 12,000+ projects, $1.2M+ revenue)
- Two CTAs: "Try Demo Dashboard" → `/dashboard`, "Sign Up Free" → `/login`
- **Features showcase** — 6 cards: Project Pipeline, GitHub Integration, AI Advisor, Marketing Hub, Revenue Tracking, MongoDB Powered
- **How It Works** — 3-step flow: Connect → Track → Ship
- **Pricing** — 3-tier table: Free ($0), Pro ($19/mo, "Most Popular"), Enterprise ($49/mo)
- Bottom CTA and footer

---

### 2. Login Page
**Route:** `/login`
**Status:** ⚠️ UI only (no authentication logic)

- Toggle between **Sign In** and **Sign Up** modes
- Social login buttons: GitHub, Google (non-functional)
- Email/password form (Name field shown only in sign-up mode)
- Submit button navigates directly to `/dashboard`
- Decorative blurred gradient backgrounds

---

### 3. Dashboard Home
**Route:** `/dashboard`
**Status:** ✅ Implemented (mock data)

- Welcome header with total project count
- **4 stats cards**: Active Projects, Monthly Revenue, Total Visitors, Total Commits (with change indicators)
- **Phase Pipeline**: Horizontal overview of all 8 phases with project dots and counts
- **Project grid**: Top 4 projects rendered as `ProjectCard` components
- **AI Insights Card**: Top 3 AI-generated insights
- **Upcoming Tasks**: Next 5 pending tasks sorted by due date
- **Recent Activity**: Latest 6 commits across all projects with relative timestamps
- **Phase Distribution**: Vertical bar chart showing project count per phase

---

### 4. Projects List
**Route:** `/dashboard/projects`
**Status:** ✅ Implemented (client-side filtering)

- **Search** by project name or description
- **Filter by phase** via dropdown with pill badges for active filters
- **Filter by status** (active / paused / completed)
- **View toggle**: Grid view / List view (compact layout)
- "New Project" button (UI only, no creation flow)
- Empty state shown when no projects match filters

---

### 5. Project Detail
**Route:** `/dashboard/projects/[id]`
**Status:** ✅ Implemented (mock data, read-only)

- Back navigation, project name with status and priority badges
- Edit and Delete buttons (UI only)
- **5 quick-stat cards**: Current Phase, Revenue, Monthly Visitors, Commits, Overall Progress
- **4 tabs**:
  - **Phases**: All 8 phases displayed with individual progress bars, current-phase highlight, completion checkmarks
  - **Tasks**: Task list with status icons (todo/in-progress/done), phase badges, due dates; "Add Task" button (UI only)
  - **GitHub**: Repository info (commits, stars, open issues), tech stack badges, latest commit with SHA and relative time, domain link
  - **Marketing**: Campaign cards per platform with budget progress bars, impressions, clicks, conversions, CTR

---

### 6. Pipeline (Kanban)
**Route:** `/dashboard/pipeline`
**Status:** ✅ Implemented (static layout)

- Horizontal scrollable kanban board with **8 columns** (one per pipeline phase)
- Each column shows projects as cards with:
  - Drag handle icon (visual only — no drag-and-drop implemented)
  - Project name, description, phase progress bar
  - Tech stack badges, revenue, and visitor metrics
- Empty columns show dashed placeholder
- "Add Project" button per column (UI only)
- Cards link to project detail pages

---

### 7. AI Advisor
**Route:** `/dashboard/ai-advisor`
**Status:** ⚠️ UI only (no AI API integration)

- "Pro Feature" badge
- **AI Chat Section**: Mock conversation bubble with sample project analysis, text input and send button, quick-prompt buttons ("What should I focus on?", "Which project has most potential?", etc.)
- **Insight Summary**: Priority distribution (high/medium/low), list of analyzed projects
- **All Insights**: Full list of 6 insights, color-coded by type:
  - 🔵 Suggestion (blue)
  - 🟡 Warning (amber)
  - 🟢 Opportunity (green)
  - 🟣 Milestone (violet)
- Actionable insights include CTA buttons
- "Generate Insights" button (UI only)

---

### 8. GitHub Integration
**Route:** `/dashboard/github`
**Status:** ⚠️ UI only (no real GitHub API)

- **4 overview stat cards**: Repositories, Total Commits, Total Stars, Open Issues
- **Repository list**: Each project displayed as a card with:
  - External link to GitHub URL
  - Tech stack badges
  - Commit, star, and issue counts
  - Domain info with external link
  - "Connected" badge
  - Latest commit SHA, message, and relative timestamp
- "Sync All" and "Connect Repo" buttons (UI only)

---

### 9. Marketing Hub
**Route:** `/dashboard/marketing`
**Status:** ✅ Implemented (mock data)

- **4 stat cards**: Total Ad Spend (with budget progress), Total Impressions, CTR, Conversions (with average CPA)
- **3-tab view**:
  - **All Campaigns**: Every campaign across all projects with spend, impressions, clicks, CTR, conversions, and budget progress bar
  - **By Platform**: Campaigns grouped by platform (Google, Instagram, etc.) with aggregate metrics
  - **By Project**: Campaigns nested under their parent project
- "New Campaign" button (UI only)

---

### 10. Settings
**Route:** `/dashboard/settings`
**Status:** ⚠️ UI only (no persistence)

- **4-tab settings panel**:
  - **Profile**: Avatar upload area, name/email/username/website fields, security section (change password, enable 2FA toggle)
  - **Integrations**: Connection status cards for GitHub (connected), Stripe (disconnect), Google Ads (connect), OpenAI (connect)
  - **Billing**: Current plan display (Free tier), 3-tier pricing cards with feature lists and upgrade buttons
  - **Notifications**: Toggle switches for Project Updates, GitHub Activity, Marketing Alerts, AI Insights, Weekly Summary

---

## Shared Components

### Layout Components

| Component | File | Description |
|---|---|---|
| `Sidebar` | `components/sidebar.tsx` | Fixed left sidebar (hidden on mobile, `lg:w-64`); 7 nav items with active-state highlighting; AI Advisor marked as premium; "Upgrade to Pro" CTA card |
| `Header` | `components/header.tsx` | Sticky top header with backdrop blur; mobile hamburger menu via Sheet; search input (cosmetic); "New Project" button, theme toggle, notification bell (with dot), user avatar dropdown |
| `ThemeProvider` | `components/theme-provider.tsx` | React Context for dark/light/system theme; persists to `localStorage`; toggles class on `<html>` |
| `ThemeToggle` | `components/theme-toggle.tsx` | Button toggling Sun/Moon icons with CSS transitions |

### Dashboard Components

| Component | File | Description |
|---|---|---|
| `StatsCard` | `dashboard/stats-card.tsx` | Reusable metric card with title, value, change indicator (green/red/gray), icon with gradient background |
| `ProjectCard` | `dashboard/project-card.tsx` | Project card with color bar, status/priority badges, phase indicator, progress bar, tech stack, GitHub stats, last commit; supports `compact` mode for list view |
| `PhasePipeline` | `dashboard/phase-pipeline.tsx` | Horizontal mini-kanban showing all 8 phases as columns with project dots and count badges |
| `PhaseDistribution` | `dashboard/phase-distribution.tsx` | Vertical bar chart showing project count per phase using custom CSS bars |
| `AIInsightsCard` | `dashboard/ai-insights-card.tsx` | Displays AI insights color-coded by type; configurable `maxInsights` prop; includes CTA buttons; "Pro" badge |
| `RecentActivity` | `dashboard/recent-activity.tsx` | Latest 6 commits across all projects with project color dot, commit SHA + message, relative timestamp |
| `UpcomingTasks` | `dashboard/upcoming-tasks.tsx` | Up to 5 pending tasks sorted by due date; status icons, project color dot, due date, priority indicator |

---

## UI Component Library

20 shadcn/ui components installed under `src/components/ui/`:

| Component | Component | Component | Component |
|---|---|---|---|
| Avatar | Badge | Button | Calendar |
| Card | Command | Dialog | Dropdown Menu |
| Input | Label | Popover | Progress |
| Scroll Area | Select | Separator | Sheet |
| Tabs | Textarea | Tooltip | — |

---

## Implementation Status

### ✅ Fully Implemented (with mock data)

| Feature | Notes |
|---|---|
| Landing / marketing page | Static content, responsive |
| Dashboard home with stats & widgets | All 6 widget types rendering |
| Project list with filtering | Search, phase filter, status filter, grid/list toggle |
| Project detail with tabs | Phases, Tasks, GitHub, Marketing tabs |
| Pipeline kanban board | 8-column layout with project cards |
| Marketing hub with campaign views | All Campaigns, By Platform, By Project tabs |
| Dark/light theme toggle | Persisted to localStorage |
| Responsive sidebar + mobile sheet menu | Collapses at `lg` breakpoint |
| Phase-based project pipeline (8 phases) | Full type system and UI representation |

### ⚠️ UI Only (no backend logic)

| Feature | What's Missing |
|---|---|
| Login / Sign Up | No Auth integration |
| AI Advisor chat | No OpenAI/LLM API calls |
| AI insight generation | Static insights, no real analysis |
| GitHub repo sync | No GitHub API integration |
| Settings persistence | No save/update functionality |
| Notification system | Bell icon is cosmetic |
| Header search | Input present, no search logic |

### ❌ Not Yet Implemented

| Feature | Notes |
|---|---|

| CRUD operations | New Project, Edit, Delete, Add Task, New Campaign buttons are non-functional |
| Drag-and-drop in kanban | Drag handle icons are visual only |
| Recharts visualizations | Library installed but no charts rendered (CSS bars used instead) |
| File/avatar upload | Upload button is cosmetic |
| Stripe billing integration | UI shown in settings, no payment flow |
| Real ad platform APIs | Google Ads, Facebook, etc. not connected |
| User authentication & sessions | No protected routes or auth middleware |
| API routes | No `app/api/` directory exists |

---

*Last updated: February 7, 2026*
