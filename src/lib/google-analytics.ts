import { OAuth2Client } from "google-auth-library";
import { analyticsadmin } from "@googleapis/analyticsadmin";
import { analyticsdata } from "@googleapis/analyticsdata";
import { connectToDatabase } from "@/lib/mongodb";
import { GoogleAnalyticsData, GoogleAnalyticsProperty } from "@/types";
import { ObjectId } from "mongodb";
import { getAppUrl } from "@/lib/utils";

// ============================================================
// Google Analytics OAuth & Data Service
// ============================================================

const SCOPES = [
  "https://www.googleapis.com/auth/analytics.readonly",
];

const REDIRECT_URI = `${getAppUrl()}/api/google-analytics/callback`;

/**
 * Create an OAuth2 client configured with Google credentials.
 */
export function createOAuth2Client() {
  return new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    REDIRECT_URI
  );
}

/**
 * Generate the Google OAuth consent URL.
 * `state` carries the projectId + userId so we know where to store the token.
 */
export function getAuthUrl(projectId: string, userId: string): string {
  const oauth2Client = createOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: "offline", // We need a refresh_token to fetch data later
    prompt: "consent",
    scope: SCOPES,
    state: JSON.stringify({ projectId, userId }),
  });
}

/**
 * Exchange the authorisation code for tokens and persist them.
 */
export async function exchangeCodeForTokens(
  code: string,
  projectId: string,
  userId: string
) {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  // Store tokens in MongoDB (encrypted in production – here we store as-is)
  const { db } = await connectToDatabase();
  await db.collection("google_analytics_tokens").updateOne(
    { projectId, userId },
    {
      $set: {
        projectId,
        userId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate: tokens.expiry_date,
        updatedAt: new Date().toISOString(),
      },
      $setOnInsert: {
        createdAt: new Date().toISOString(),
      },
    },
    { upsert: true }
  );

  return { oauth2Client, tokens };
}

/**
 * Get an authenticated OAuth2 client for a project (with token refresh).
 */
async function getAuthedClient(projectId: string, userId: string) {
  const { db } = await connectToDatabase();
  const tokenDoc = await db
    .collection("google_analytics_tokens")
    .findOne({ projectId, userId });

  if (!tokenDoc) {
    throw new Error("Google Analytics not connected for this project");
  }

  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({
    access_token: tokenDoc.accessToken,
    refresh_token: tokenDoc.refreshToken,
    expiry_date: tokenDoc.expiryDate,
  });

  // If the token is expired, refresh it
  if (tokenDoc.expiryDate && Date.now() > tokenDoc.expiryDate) {
    const { credentials } = await oauth2Client.refreshAccessToken();
    oauth2Client.setCredentials(credentials);

    await db.collection("google_analytics_tokens").updateOne(
      { projectId, userId },
      {
        $set: {
          accessToken: credentials.access_token,
          expiryDate: credentials.expiry_date,
          updatedAt: new Date().toISOString(),
        },
      }
    );
  }

  return oauth2Client;
}

/**
 * List the user's GA4 properties so they can choose which one to link.
 * Uses accountSummaries endpoint for broader compatibility, then falls
 * back to properties.list if needed.
 */
export async function listGA4Properties(
  projectId: string,
  userId: string
): Promise<GoogleAnalyticsProperty[]> {
  const oauth2Client = await getAuthedClient(projectId, userId);
  const analyticsAdmin = analyticsadmin({
    version: "v1beta",
    auth: oauth2Client,
  });

  // Try accountSummaries first — works across all accounts without a filter
  try {
    const summaries = await analyticsAdmin.accountSummaries.list({
      pageSize: 200,
    });

    const results: GoogleAnalyticsProperty[] = [];
    for (const account of summaries.data.accountSummaries || []) {
      for (const prop of account.propertySummaries || []) {
        results.push({
          propertyId: prop.property || "",
          displayName: prop.displayName || "Unnamed Property",
          websiteUrl: undefined,
        });
      }
    }
    if (results.length > 0) return results;
  } catch (summaryErr) {
    console.warn("accountSummaries.list failed, trying properties.list:", summaryErr);
  }

  // Fallback: properties.list with wildcard filter
  const res = await analyticsAdmin.properties.list({
    filter: "parent:accounts/-",
    pageSize: 200,
  });

  const properties = res.data.properties || [];
  return properties.map((p) => ({
    propertyId: p.name || "",
    displayName: p.displayName || "Unnamed Property",
    websiteUrl: undefined,
  }));
}

/**
 * Fetch analytics data from the GA4 Data API.
 * Returns monthly visitors (last 30 days), total visitors (last 365 days),
 * daily breakdown, and top pages.
 */
export async function fetchAnalyticsData(
  projectId: string,
  userId: string,
  propertyId: string
): Promise<GoogleAnalyticsData> {
  const oauth2Client = await getAuthedClient(projectId, userId);
  const analyticsData = analyticsdata({
    version: "v1beta",
    auth: oauth2Client,
  });

  // Fetch monthly visitors (last 30 days) + total visitors (last 365 days) in parallel
  const [monthlyRes, yearlyRes, dailyRes, topPagesRes] = await Promise.all([
    // Monthly active users (last 30 days)
    analyticsData.properties.runReport({
      property: propertyId,
      requestBody: {
        dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
        metrics: [{ name: "activeUsers" }],
      },
    }),
    // Total visitors (last 365 days)
    analyticsData.properties.runReport({
      property: propertyId,
      requestBody: {
        dateRanges: [{ startDate: "365daysAgo", endDate: "today" }],
        metrics: [{ name: "activeUsers" }],
      },
    }),
    // Daily breakdown (last 30 days)
    analyticsData.properties.runReport({
      property: propertyId,
      requestBody: {
        dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
        dimensions: [{ name: "date" }],
        metrics: [{ name: "activeUsers" }],
        orderBys: [{ dimension: { dimensionName: "date", orderType: "ALPHANUMERIC" } }],
      },
    }),
    // Top pages (last 30 days)
    analyticsData.properties.runReport({
      property: propertyId,
      requestBody: {
        dateRanges: [{ startDate: "30daysAgo", endDate: "today" }],
        dimensions: [{ name: "pagePath" }],
        metrics: [{ name: "screenPageViews" }],
        orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
        limit: "10",
      },
    }),
  ]);

  const monthlyVisitors = parseInt(
    monthlyRes.data.rows?.[0]?.metricValues?.[0]?.value || "0",
    10
  );
  const totalVisitors = parseInt(
    yearlyRes.data.rows?.[0]?.metricValues?.[0]?.value || "0",
    10
  );

  const dailyVisitors = (dailyRes.data.rows || []).map((row) => ({
    date: row.dimensionValues?.[0]?.value || "",
    visitors: parseInt(row.metricValues?.[0]?.value || "0", 10),
  }));

  const topPages = (topPagesRes.data.rows || []).map((row) => ({
    page: row.dimensionValues?.[0]?.value || "",
    views: parseInt(row.metricValues?.[0]?.value || "0", 10),
  }));

  return {
    monthlyVisitors,
    totalVisitors,
    dailyVisitors,
    topPages,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Disconnect Google Analytics from a project.
 */
export async function disconnectGA(projectId: string, userId: string) {
  const { db } = await connectToDatabase();
  await db.collection("google_analytics_tokens").deleteOne({ projectId, userId });
  if (ObjectId.isValid(projectId)) {
    await db.collection("projects").updateOne(
      { _id: new ObjectId(projectId) },
      { $unset: { googleAnalytics: "" } }
    );
  }
}
