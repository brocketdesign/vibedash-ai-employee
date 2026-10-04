// ============================================================
// VibeDash — Email Service (Resend)
// ============================================================

import { Resend } from "resend";

/**
 * Built on first send, not at import time: the Resend constructor throws when
 * the key is absent, and this module is imported by the night-shift runner, so
 * a missing key would take down the whole build rather than one email.
 */
let client: Resend | null = null;

function getResend(): Resend {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not configured — cannot send email.");
  }
  if (!client) client = new Resend(process.env.RESEND_API_KEY);
  return client;
}

// Sender and reply-to are set per deployment. Resend's shared test sender works
// without a verified domain, which is enough to try the app locally.
const FROM_EMAIL = process.env.EMAIL_FROM || "VibeDash <onboarding@resend.dev>";
const REPLY_TO = process.env.EMAIL_REPLY_TO || undefined;

/** The bare address mail is sent from, for display in templates. */
export const SENDER_ADDRESS = FROM_EMAIL.match(/<([^>]+)>/)?.[1] ?? FROM_EMAIL;

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  tags?: Array<{ name: string; value: string }>;
}

/**
 * Send an email via Resend from the EMAIL_FROM address
 */
export async function sendEmail(options: SendEmailOptions) {
  const { to, subject, html, replyTo, tags } = options;

  const recipients = Array.isArray(to) ? to : [to];

  // Filter out empty strings
  const validRecipients = recipients.filter((email) => email && email.trim() !== "");

  if (validRecipients.length === 0) {
    throw new Error("No valid recipient email addresses provided");
  }

  try {
    const result = await getResend().emails.send({
      from: FROM_EMAIL,
      to: validRecipients,
      subject,
      html,
      replyTo: replyTo || REPLY_TO,
      tags: tags || [],
    });

    console.log(`[Email] Sent "${subject}" to ${validRecipients.join(", ")}`, result);
    return result;
  } catch (error) {
    console.error(`[Email] Failed to send "${subject}" to ${validRecipients.join(", ")}:`, error);
    throw error;
  }
}

/**
 * Send email to all configured recipients (Clerk email + optional extra email)
 */
export async function sendToAllRecipients(
  clerkEmail: string,
  additionalEmail: string | null | undefined,
  subject: string,
  html: string,
  tags?: Array<{ name: string; value: string }>
) {
  const recipients: string[] = [clerkEmail];

  if (additionalEmail && additionalEmail.trim() !== "" && additionalEmail !== clerkEmail) {
    recipients.push(additionalEmail.trim());
  }

  return sendEmail({
    to: recipients,
    subject,
    html,
    tags,
  });
}
