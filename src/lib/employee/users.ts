import { getDb } from "./db";

/**
 * Look-ups against the `users` collection Clerk syncs into (see lib/auth.ts).
 * Kept separate from the Clerk SDK so the night-shift cron — which has no
 * request context — can still find out where to send a report.
 */
export const users = {
  async emailFor(clerkId: string): Promise<string | null> {
    try {
      const db = await getDb();
      const doc = await db.collection("users").findOne({ clerkId });
      const email = doc?.email;
      return typeof email === "string" && email.includes("@") ? email : null;
    } catch (e) {
      console.error("[users] emailFor failed", e);
      return null;
    }
  },

  async nameFor(clerkId: string): Promise<string> {
    try {
      const db = await getDb();
      const doc = await db.collection("users").findOne({ clerkId });
      return typeof doc?.name === "string" ? doc.name : "there";
    } catch {
      return "there";
    }
  },
};
