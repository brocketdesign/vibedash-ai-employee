// ============================================================
// VibeDash — Professional Email Templates (Resend)
// ============================================================

import { SENDER_ADDRESS } from "./email-service";

const BRAND = {
  primary: "#7c3aed",     // violet-600
  primaryDark: "#4f46e5", // indigo-600
  accent: "#a78bfa",      // violet-400
  bg: "#f8fafc",          // slate-50
  cardBg: "#ffffff",
  text: "#1e293b",        // slate-800
  textMuted: "#64748b",   // slate-500
  border: "#e2e8f0",      // slate-200
  success: "#22c55e",
  warning: "#f59e0b",
  logo: "VibeDash",
};

function baseLayout(content: string, preheader?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>VibeDash</title>
  ${preheader ? `<span style="display:none;font-size:1px;color:#f8fafc;max-height:0;overflow:hidden">${preheader}</span>` : ""}
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${BRAND.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.bg}">
    <tr>
      <td align="center" style="padding:40px 16px">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
          <!-- Header -->
          <tr>
            <td align="center" style="padding-bottom:32px">
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:linear-gradient(135deg,${BRAND.primary},${BRAND.primaryDark});padding:12px 28px;border-radius:16px">
                    <span style="font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.5px">⚡ ${BRAND.logo}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="background-color:${BRAND.cardBg};border-radius:20px;box-shadow:0 1px 3px rgba(0,0,0,0.08);border:1px solid ${BRAND.border};overflow:hidden">
              ${content}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:32px 20px">
              <p style="margin:0 0 8px;font-size:13px;color:${BRAND.textMuted}">
                You're receiving this because you have notifications enabled on VibeDash.
              </p>
              <p style="margin:0 0 16px;font-size:13px;color:${BRAND.textMuted}">
                <a href="{{dashboardUrl}}/dashboard/settings" style="color:${BRAND.primary};text-decoration:underline">Manage notification preferences</a>
              </p>
              <p style="margin:0;font-size:12px;color:#94a3b8">
                &copy; ${new Date().getFullYear()} VibeDash &middot; Built for vibe coders
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Stat Row Helper ─────────────────────────────────────────
function statCard(label: string, value: string, color?: string): string {
  return `<td align="center" style="padding:12px 8px">
    <p style="margin:0;font-size:28px;font-weight:800;color:${color || BRAND.primary};line-height:1">${value}</p>
    <p style="margin:4px 0 0;font-size:12px;color:${BRAND.textMuted};text-transform:uppercase;letter-spacing:0.5px">${label}</p>
  </td>`;
}

// ─── Section Heading ─────────────────────────────────────────
function sectionHeading(title: string, emoji?: string): string {
  return `<tr>
    <td style="padding:24px 32px 8px">
      <p style="margin:0;font-size:15px;font-weight:700;color:${BRAND.text}">${emoji ? emoji + " " : ""}${title}</p>
    </td>
  </tr>`;
}

// ─── List Item ───────────────────────────────────────────────
function listItem(text: string, subtext?: string): string {
  return `<tr>
    <td style="padding:8px 32px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td width="8" valign="top" style="padding-top:8px">
            <div style="width:8px;height:8px;border-radius:50%;background-color:${BRAND.accent}"></div>
          </td>
          <td style="padding-left:12px">
            <p style="margin:0;font-size:14px;color:${BRAND.text};line-height:1.5">${text}</p>
            ${subtext ? `<p style="margin:2px 0 0;font-size:12px;color:${BRAND.textMuted}">${subtext}</p>` : ""}
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

// ─── CTA Button ──────────────────────────────────────────────
function ctaButton(text: string, url: string): string {
  return `<tr>
    <td align="center" style="padding:24px 32px 32px">
      <table role="presentation" cellpadding="0" cellspacing="0">
        <tr>
          <td style="background:linear-gradient(135deg,${BRAND.primary},${BRAND.primaryDark});border-radius:12px;padding:14px 36px">
            <a href="${url}" target="_blank" style="font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;display:inline-block">
              ${text} →
            </a>
          </td>
        </tr>
      </table>
    </td>
  </tr>`;
}

// ════════════════════════════════════════════════════════════════
// TEMPLATE: Daily Summary
// ════════════════════════════════════════════════════════════════
export interface DailySummaryData {
  userName: string;
  date: string;
  totalProjects: number;
  activeProjects: number;
  totalCommits: number;
  newTasks: number;
  completedTasks: number;
  projectUpdates: Array<{
    name: string;
    phase: string;
    progress: number;
    recentCommits: number;
  }>;
  aiInsights: Array<{
    title: string;
    description: string;
    type: "suggestion" | "warning" | "opportunity" | "milestone";
  }>;
  campaignSummary?: {
    activeCampaigns: number;
    totalSpend: number;
    totalImpressions: number;
  };
  dashboardUrl: string;
}

export function dailySummaryTemplate(data: DailySummaryData): string {
  const insightIcons: Record<string, string> = {
    suggestion: "💡",
    warning: "⚠️",
    opportunity: "🚀",
    milestone: "🏆",
  };

  const projectRows = data.projectUpdates
    .map(
      (p) => `<tr>
        <td style="padding:8px 32px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};border-radius:12px;border:1px solid ${BRAND.border}">
            <tr>
              <td style="padding:16px">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td>
                      <p style="margin:0;font-size:14px;font-weight:700;color:${BRAND.text}">${p.name}</p>
                      <p style="margin:4px 0 0;font-size:12px;color:${BRAND.textMuted}">Phase: ${p.phase} &middot; ${p.recentCommits} new commit${p.recentCommits !== 1 ? "s" : ""}</p>
                    </td>
                    <td align="right" valign="middle">
                      <span style="display:inline-block;background:linear-gradient(135deg,${BRAND.primary},${BRAND.primaryDark});color:#fff;font-size:13px;font-weight:700;padding:4px 12px;border-radius:20px">${p.progress}%</span>
                    </td>
                  </tr>
                  <tr>
                    <td colspan="2" style="padding-top:10px">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="background:${BRAND.border};border-radius:4px;height:6px">
                            <div style="width:${p.progress}%;background:linear-gradient(90deg,${BRAND.primary},${BRAND.primaryDark});height:6px;border-radius:4px"></div>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    )
    .join("");

  const insightRows = data.aiInsights
    .map((i) => listItem(`${insightIcons[i.type] || "💡"} <strong>${i.title}</strong>`, i.description))
    .join("");

  const content = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <!-- Hero -->
      <tr>
        <td style="background:linear-gradient(135deg,${BRAND.primary},${BRAND.primaryDark});padding:36px 32px 28px">
          <p style="margin:0;font-size:14px;color:rgba(255,255,255,0.8)">📅 ${data.date}</p>
          <h1 style="margin:8px 0 0;font-size:24px;font-weight:800;color:#ffffff;line-height:1.3">
            Good morning, ${data.userName}! 👋
          </h1>
          <p style="margin:8px 0 0;font-size:15px;color:rgba(255,255,255,0.85);line-height:1.5">
            Here's your daily project summary.
          </p>
        </td>
      </tr>

      <!-- Stats Row -->
      <tr>
        <td style="padding:24px 20px 0">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};border-radius:16px;border:1px solid ${BRAND.border}">
            <tr>
              ${statCard("Projects", String(data.totalProjects))}
              ${statCard("Active", String(data.activeProjects), BRAND.success)}
              ${statCard("Commits", String(data.totalCommits))}
              ${statCard("Tasks Done", String(data.completedTasks), BRAND.success)}
            </tr>
          </table>
        </td>
      </tr>

      <!-- Project Updates -->
      ${data.projectUpdates.length > 0 ? `
        ${sectionHeading("Project Updates", "📊")}
        ${projectRows}
      ` : ""}

      <!-- AI Insights -->
      ${data.aiInsights.length > 0 ? `
        ${sectionHeading("AI Insights", "🤖")}
        ${insightRows}
      ` : ""}

      <!-- Campaign Summary -->
      ${data.campaignSummary ? `
        ${sectionHeading("Marketing Overview", "📣")}
        <tr>
          <td style="padding:8px 32px 16px">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};border-radius:12px;border:1px solid ${BRAND.border}">
              <tr>
                ${statCard("Active", String(data.campaignSummary.activeCampaigns))}
                ${statCard("Spend", "$" + data.campaignSummary.totalSpend.toLocaleString())}
                ${statCard("Impressions", data.campaignSummary.totalImpressions > 1000 ? (data.campaignSummary.totalImpressions / 1000).toFixed(1) + "K" : String(data.campaignSummary.totalImpressions))}
              </tr>
            </table>
          </td>
        </tr>
      ` : ""}

      <!-- CTA -->
      ${ctaButton("Open Dashboard", data.dashboardUrl + "/dashboard")}
    </table>`;

  return baseLayout(content, `Your daily VibeDash summary for ${data.date}`).replace(
    /\{\{dashboardUrl\}\}/g,
    data.dashboardUrl
  );
}

// ════════════════════════════════════════════════════════════════
// TEMPLATE: Test Email
// ════════════════════════════════════════════════════════════════
export interface TestEmailData {
  recipientName: string;
  recipientEmail: string;
  dashboardUrl: string;
  timestamp: string;
}

export function testEmailTemplate(data: TestEmailData): string {
  const content = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <!-- Hero -->
      <tr>
        <td style="background:linear-gradient(135deg,${BRAND.primary},${BRAND.primaryDark});padding:36px 32px 28px">
          <h1 style="margin:0;font-size:24px;font-weight:800;color:#ffffff;line-height:1.3">
            ✅ Email Setup Verified!
          </h1>
          <p style="margin:8px 0 0;font-size:15px;color:rgba(255,255,255,0.85);line-height:1.5">
            Your VibeDash email notifications are working correctly.
          </p>
        </td>
      </tr>

      <!-- Details -->
      <tr>
        <td style="padding:28px 32px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.bg};border-radius:16px;border:1px solid ${BRAND.border}">
            <tr>
              <td style="padding:20px 24px">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:8px 0;border-bottom:1px solid ${BRAND.border}">
                      <p style="margin:0;font-size:12px;color:${BRAND.textMuted};text-transform:uppercase;letter-spacing:0.5px">Recipient</p>
                      <p style="margin:4px 0 0;font-size:14px;color:${BRAND.text};font-weight:600">${data.recipientName}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;border-bottom:1px solid ${BRAND.border}">
                      <p style="margin:0;font-size:12px;color:${BRAND.textMuted};text-transform:uppercase;letter-spacing:0.5px">Email</p>
                      <p style="margin:4px 0 0;font-size:14px;color:${BRAND.text};font-weight:600">${data.recipientEmail}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0;border-bottom:1px solid ${BRAND.border}">
                      <p style="margin:0;font-size:12px;color:${BRAND.textMuted};text-transform:uppercase;letter-spacing:0.5px">Sent From</p>
                      <p style="margin:4px 0 0;font-size:14px;color:${BRAND.text};font-weight:600">${SENDER_ADDRESS}</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:8px 0">
                      <p style="margin:0;font-size:12px;color:${BRAND.textMuted};text-transform:uppercase;letter-spacing:0.5px">Timestamp</p>
                      <p style="margin:4px 0 0;font-size:14px;color:${BRAND.text};font-weight:600">${data.timestamp}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Success Message -->
      <tr>
        <td style="padding:0 32px 8px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border-radius:12px;border:1px solid #bbf7d0">
            <tr>
              <td style="padding:16px 20px">
                <p style="margin:0;font-size:14px;color:#166534;line-height:1.5">
                  <strong>🎉 Everything is working!</strong><br />
                  Your notification emails will be delivered from <strong>${SENDER_ADDRESS}</strong> via Resend. Daily summaries, project updates, and alerts will arrive here.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      ${ctaButton("Go to Dashboard", data.dashboardUrl + "/dashboard")}
    </table>`;

  return baseLayout(content, "Your VibeDash email notifications are working!").replace(
    /\{\{dashboardUrl\}\}/g,
    data.dashboardUrl
  );
}

// ════════════════════════════════════════════════════════════════
// TEMPLATE: Notification Alert (generic)
// ════════════════════════════════════════════════════════════════
export interface NotificationAlertData {
  userName: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  actionUrl?: string;
  actionText?: string;
  dashboardUrl: string;
}

export function notificationAlertTemplate(data: NotificationAlertData): string {
  const typeStyles: Record<string, { bg: string; border: string; color: string; emoji: string }> = {
    info: { bg: "#eff6ff", border: "#bfdbfe", color: "#1e40af", emoji: "ℹ️" },
    success: { bg: "#f0fdf4", border: "#bbf7d0", color: "#166534", emoji: "✅" },
    warning: { bg: "#fffbeb", border: "#fde68a", color: "#92400e", emoji: "⚠️" },
    error: { bg: "#fef2f2", border: "#fecaca", color: "#991b1b", emoji: "🚨" },
  };

  const style = typeStyles[data.type] || typeStyles.info;

  const content = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="background:linear-gradient(135deg,${BRAND.primary},${BRAND.primaryDark});padding:36px 32px 28px">
          <h1 style="margin:0;font-size:22px;font-weight:800;color:#ffffff;line-height:1.3">
            ${style.emoji} ${data.title}
          </h1>
          <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.8)">
            Hi ${data.userName}, here's an update from VibeDash
          </p>
        </td>
      </tr>

      <tr>
        <td style="padding:28px 32px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${style.bg};border-radius:12px;border:1px solid ${style.border}">
            <tr>
              <td style="padding:20px 24px">
                <p style="margin:0;font-size:14px;color:${style.color};line-height:1.6">${data.message}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      ${data.actionUrl ? ctaButton(data.actionText || "View Details", data.actionUrl) : ctaButton("Open Dashboard", data.dashboardUrl + "/dashboard")}
    </table>`;

  return baseLayout(content, data.title).replace(
    /\{\{dashboardUrl\}\}/g,
    data.dashboardUrl
  );
}
