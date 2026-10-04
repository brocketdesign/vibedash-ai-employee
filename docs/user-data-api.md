# VibeDash User Data API — Implementation Guide

## Context

This project is connected to **VibeDash**, a personal project management dashboard. VibeDash calls this endpoint on demand to pull data, then passes it through an AI to **generate a fully custom, multi-tab dashboard view** tailored to your project.

You need to implement **one API endpoint** that VibeDash calls to retrieve user and application data.

---

## The Endpoint

```
GET /api/vibedash/users
```

This route must:
1. Validate the `Authorization: Bearer <token>` header against the `VIBEDASH_TOKEN` environment variable
2. Return a JSON payload describing the project's users **and all meaningful application-level data**

---

## Environment Variable Required

The following variable must be set in `.env` (or `.env.local`):

```
VIBEDASH_TOKEN=vd_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

This token is provided by VibeDash. Do **not** hardcode it in source code.

---

## Authentication Logic

```typescript
const token = request.headers.get("authorization")?.replace("Bearer ", "");
if (!token || token !== process.env.VIBEDASH_TOKEN) {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}
```

---

## Response Schema

Return a JSON object with the following shape. All fields marked **required** must be present.

> **Important — make your data rich and specific to your application.**
> VibeDash AI reads the entire JSON payload and builds a multi-tab dashboard from it. Generic user counts alone (`totalUsers`, `premiumUsers`) are a bare minimum — the more application-specific data you include, the more interesting and useful the generated view will be.
>
> An image-generation app should include `totalImagesGenerated`, `avgImagesPerUser`, `totalStorageUsedMB`, etc.
> A SaaS tool should include `activeSubscriptions`, `monthlyRecurringRevenue`, `churnRatePercent`, etc.
>
> Every key you add inside `metrics` and every array you add inside `charts` will automatically become a stat card, chart, or table tab in the generated dashboard.

```typescript
{
  // ── Required ──────────────────────────────────────────────────────────────
  meta: {
    projectName: string;       // Human-readable name of this project
    fetchedAt: string;         // ISO 8601 timestamp of when data was gathered
  };

  summary: {
    totalUsers: number;        // All registered users (ever)
    premiumUsers: number;      // Users on a paid plan
    newUsersToday: number;     // Registered today (UTC)
    newUsersThisWeek: number;  // Registered in the last 7 days
    newUsersThisMonth: number; // Registered in the last 30 days
  };

  // ── Strongly recommended — app-specific scalar metrics ────────────────────
  // These become individual stat cards in the dashboard.
  // Use clear, descriptive camelCase keys. Include as many as are relevant.
  metrics?: {
    [key: string]: number | string;
    // e.g.:
    // totalImagesGenerated: 48320,
    // avgImagesPerUser: 14.2,
    // totalStorageUsedMB: 12800,
    // activeSubscriptions: 340,
    // monthlyRecurringRevenue: 8500,
    // churnRatePercent: 2.1,
    // totalPosts: 9200,
    // avgPostsPerUser: 4.6,
    // conversionRate: 8.3,
  };

  // ── Strongly recommended — chart data arrays ───────────────────────────────
  // Each array becomes a chart or table in the generated dashboard.
  // Time-series arrays → line or bar charts.
  // Categorical arrays → bar or pie charts.
  // Object arrays with 2+ keys → table views.
  charts?: {
    userGrowth?: Array<{ date: string; count: number }>;       // daily new users (last 30 days)
    planBreakdown?: Array<{ plan: string; count: number }>;    // users by plan tier
    // Add any arrays relevant to your app, for example:
    // imagesPerDay?: Array<{ date: string; count: number }>;
    // revenuePerMonth?: Array<{ month: string; revenue: number }>;
    // topFeatures?: Array<{ feature: string; usageCount: number }>;
    // storageByUser?: Array<{ plan: string; avgMB: number }>;
    [key: string]: Array<Record<string, unknown>> | undefined;
  };

  // ── Optional — array of individual users ──────────────────────────────────
  // Enables a "Users" table tab in VibeDash. Include extra per-user fields
  // relevant to your application (e.g. imagesGenerated, storageUsedMB, lastActiveAt).
  users?: Array<{
    id: string;
    email?: string;
    plan: string;             // e.g. "free" | "pro" | "enterprise"
    createdAt: string;        // ISO 8601
    [key: string]: unknown;   // any extra per-user fields your app tracks
  }>;
}
```

---

## How VibeDash Generates the Dashboard

When you click **Generate View** in VibeDash, the entire JSON payload above is sent to an AI model. The AI inspects every field and array and produces a **multi-tab dashboard** configuration:

- **Overview tab** — key stat cards drawn from `summary` and `metrics`
- **Growth tab** — line/bar charts from time-series arrays (e.g. `charts.userGrowth`, `charts.imagesPerDay`)
- **Distribution tab** — pie/bar charts from categorical arrays (e.g. `charts.planBreakdown`, `charts.topFeatures`)
- **Users tab** — a paginated table if you include the `users` array
- Additional tabs are created automatically for any other meaningful data groups found in the payload

The generated view configuration is **saved to the VibeDash database** the first time it is generated, so subsequent page loads display the saved view instantly without calling the AI again. You can always click **Regenerate View** to rebuild it with fresh data.

---

## Implementation Examples

The examples below show a **rich** response for an image-generation SaaS app. Adapt the `metrics`, `charts`, and `users` sections to match your own application data.

### Next.js (App Router) — `app/api/vibedash/users/route.ts`

```typescript
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  // 1. Auth
  if (request.method !== "GET") return Response.json({ error: "Method Not Allowed" }, { status: 405 });
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  if (!token || token !== process.env.VIBEDASH_TOKEN) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Fetch data — replace with your real DB queries
  const now = new Date();
  const today = new Date(now); today.setUTCHours(0, 0, 0, 0);
  const week = new Date(Date.now() - 7 * 86_400_000);
  const month = new Date(Date.now() - 30 * 86_400_000);

  const [totalUsers, premiumUsers, newUsersToday, newUsersThisWeek, newUsersThisMonth] =
    await Promise.all([
      db.users.count(),
      db.users.count({ where: { plan: { not: "free" } } }),
      db.users.count({ where: { createdAt: { gte: today } } }),
      db.users.count({ where: { createdAt: { gte: week } } }),
      db.users.count({ where: { createdAt: { gte: month } } }),
    ]);

  // App-specific aggregates — tailor these to your own data model
  const totalImagesGenerated = await db.images.count();
  const totalStorageUsedMB = await db.images.aggregate({ _sum: { fileSizeMB: true } })
    .then((r) => r._sum.fileSizeMB ?? 0);
  const activeSubscriptions = premiumUsers; // or query a subscriptions table
  const monthlyRecurringRevenue = await db.subscriptions.aggregate({ _sum: { monthlyAmount: true } })
    .then((r) => r._sum.monthlyAmount ?? 0);

  // Chart data arrays
  // Daily new users (last 30 days)
  const userGrowthRaw = await db.users.groupBy({
    by: ["createdAt"],
    _count: true,
    where: { createdAt: { gte: month } },
    orderBy: { createdAt: "asc" },
  });
  const userGrowth = userGrowthRaw.map((r) => ({
    date: r.createdAt.toISOString().slice(0, 10),
    count: r._count,
  }));

  // Plan breakdown
  const planBreakdown = [
    { plan: "free", count: totalUsers - premiumUsers },
    { plan: "pro", count: premiumUsers },
  ];

  // Daily images generated (last 30 days) — app-specific
  const imagesPerDayRaw = await db.images.groupBy({
    by: ["createdAt"],
    _count: true,
    where: { createdAt: { gte: month } },
    orderBy: { createdAt: "asc" },
  });
  const imagesPerDay = imagesPerDayRaw.map((r) => ({
    date: r.createdAt.toISOString().slice(0, 10),
    count: r._count,
  }));

  // Recent users for the Users table tab (omit emails if not needed)
  const recentUsers = await db.users.findMany({
    take: 100,
    orderBy: { createdAt: "desc" },
    select: { id: true, plan: true, createdAt: true, imagesGenerated: true },
  });

  // 3. Return the full payload
  return Response.json({
    meta: {
      projectName: "My Image Generator",
      fetchedAt: new Date().toISOString(),
    },
    summary: {
      totalUsers,
      premiumUsers,
      newUsersToday,
      newUsersThisWeek,
      newUsersThisMonth,
    },
    metrics: {
      // These become individual stat cards in the Overview tab
      totalImagesGenerated,
      avgImagesPerUser: totalUsers > 0 ? Math.round(totalImagesGenerated / totalUsers) : 0,
      totalStorageUsedMB: Math.round(totalStorageUsedMB),
      activeSubscriptions,
      monthlyRecurringRevenue,
      conversionRatePercent: totalUsers > 0
        ? parseFloat(((premiumUsers / totalUsers) * 100).toFixed(1))
        : 0,
    },
    charts: {
      // Time-series arrays → line / bar charts
      userGrowth,           // Growth tab
      imagesPerDay,         // Activity tab
      // Categorical arrays → pie / bar charts
      planBreakdown,        // Distribution tab
    },
    users: recentUsers.map((u) => ({
      id: u.id,
      plan: u.plan,
      createdAt: u.createdAt.toISOString(),
      imagesGenerated: u.imagesGenerated ?? 0,
    })),
  });
}
```

### Next.js (Pages Router) — `pages/api/vibedash/users.ts`

```typescript
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).end();

  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token || token !== process.env.VIBEDASH_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Replace with real DB queries + your own metrics / chart arrays
  return res.status(200).json({
    meta: { projectName: "My App", fetchedAt: new Date().toISOString() },
    summary: { totalUsers: 0, premiumUsers: 0, newUsersToday: 0, newUsersThisWeek: 0, newUsersThisMonth: 0 },
    metrics: { /* your app-specific scalars */ },
    charts: { planBreakdown: [], userGrowth: [] },
  });
}
```

### Express / Node.js

```typescript
router.get("/api/vibedash/users", async (req, res) => {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token || token !== process.env.VIBEDASH_TOKEN) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Replace with real DB queries + your own metrics / chart arrays
  return res.json({
    meta: { projectName: "My App", fetchedAt: new Date().toISOString() },
    summary: { totalUsers: 0, premiumUsers: 0, newUsersToday: 0, newUsersThisWeek: 0, newUsersThisMonth: 0 },
    metrics: { /* your app-specific scalars */ },
    charts: { planBreakdown: [], userGrowth: [] },
  });
});
```

---

## Project-Specific Metrics Guide

Add application-specific fields inside `metrics` and `charts`. VibeDash AI reads every field and creates stat cards, charts, and tables from them. The richer the payload, the more meaningful and tailored the generated dashboard.

**Recommended metrics and chart arrays by project type:**

| Project type | `metrics` keys | `charts` arrays |
|---|---|---|
| Image / AI generation | `totalImagesGenerated`, `avgImagesPerUser`, `totalStorageUsedMB`, `monthlyRecurringRevenue` | `imagesPerDay`, `planBreakdown`, `storageByPlan` |
| Blog / content platform | `totalPosts`, `avgPostsPerUser`, `totalSites`, `publishedThisMonth` | `postsPerDay`, `planBreakdown`, `topCategories` |
| AI character / chat app | `totalCharacters`, `avgCharactersPerUser`, `totalMessages`, `avgMessagesPerUser` | `messagesPerDay`, `planBreakdown`, `characterCreationsByDay` |
| SaaS tool | `activeSubscriptions`, `monthlyRecurringRevenue`, `churnRatePercent`, `avgSessionsPerUser` | `userGrowth`, `revenuePerMonth`, `planBreakdown` |
| E-commerce | `totalOrders`, `avgOrderValue`, `repeatPurchaseRatePercent`, `totalRevenue` | `ordersPerDay`, `revenuePerMonth`, `categoryBreakdown` |

---

## Testing the Endpoint

Once implemented, test it locally before connecting to VibeDash:

```bash
curl -H "Authorization: Bearer $VIBEDASH_TOKEN" http://localhost:3000/api/vibedash/users
```

Expected: `200 OK` with a JSON body matching the schema above.
Expected with wrong/missing token: `401 Unauthorized`.

---

## Connecting to VibeDash

1. Deploy your project (or expose it via a tunnel like `ngrok` for local testing)
2. In VibeDash, open the project → **Users tab** → **Connect**
3. Enter the full URL: `https://yourapp.com/api/vibedash/users`
4. Click **Fetch Data** to pull stats, then **Generate View** to let AI build the dashboard

---

## Security Notes

- Never commit `VIBEDASH_TOKEN` to version control
- The endpoint should be read-only (GET only) — reject other methods
- If you include a `users` array with real email addresses, treat it as sensitive data — only include it if you specifically want user-level table views in VibeDash
- Rate limiting is not required since VibeDash only calls this endpoint on demand (manual fetch)
