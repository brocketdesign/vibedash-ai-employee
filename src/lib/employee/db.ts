import type { Collection, Db } from "mongodb";
import { connectToDatabase } from "@/lib/mongodb";
import type {
  ActivityDoc,
  ChatMessageDoc,
  CompanyDoc,
  DocumentDoc,
  ShiftDoc,
  SubscriptionDoc,
  TaskDoc,
} from "./types";

export const COLLECTIONS = {
  companies: "companies",
  tasks: "employeeTasks",
  shifts: "nightShifts",
  activity: "employeeActivity",
  documents: "companyDocuments",
  chat: "companyChat",
  subscriptions: "subscriptions",
  social: "socialAccounts",
  outreach: "outreachEmails",
} as const;

export async function getDb(): Promise<Db> {
  const { db } = await connectToDatabase();
  return db;
}

export async function companies(): Promise<Collection<CompanyDoc>> {
  return (await getDb()).collection<CompanyDoc>(COLLECTIONS.companies);
}
export async function tasks(): Promise<Collection<TaskDoc>> {
  return (await getDb()).collection<TaskDoc>(COLLECTIONS.tasks);
}
export async function shifts(): Promise<Collection<ShiftDoc>> {
  return (await getDb()).collection<ShiftDoc>(COLLECTIONS.shifts);
}
export async function activity(): Promise<Collection<ActivityDoc>> {
  return (await getDb()).collection<ActivityDoc>(COLLECTIONS.activity);
}
export async function documents(): Promise<Collection<DocumentDoc>> {
  return (await getDb()).collection<DocumentDoc>(COLLECTIONS.documents);
}
export async function chatMessages(): Promise<Collection<ChatMessageDoc>> {
  return (await getDb()).collection<ChatMessageDoc>(COLLECTIONS.chat);
}
export async function subscriptions(): Promise<Collection<SubscriptionDoc>> {
  return (await getDb()).collection<SubscriptionDoc>(COLLECTIONS.subscriptions);
}

let indexesEnsured = false;

/**
 * Create every index the employee relies on. Cheap no-op after the first call
 * in a warm lambda; never throws so a transient Mongo hiccup can't break a
 * request path that only needed to read.
 */
export async function ensureIndexes(): Promise<void> {
  if (indexesEnsured) return;
  indexesEnsured = true;
  try {
    const db = await getDb();
    await Promise.all([
      db
        .collection(COLLECTIONS.companies)
        .createIndex({ userId: 1, slug: 1 }, { unique: true }),
      db.collection(COLLECTIONS.companies).createIndex({ userId: 1, createdAt: -1 }),
      db.collection(COLLECTIONS.tasks).createIndex({ taskId: 1 }, { unique: true }),
      db.collection(COLLECTIONS.tasks).createIndex({ companyId: 1, createdAt: -1 }),
      db.collection(COLLECTIONS.tasks).createIndex({ status: 1, heartbeatAt: 1 }),
      db.collection(COLLECTIONS.tasks).createIndex({ companyId: 1, tonight: 1, status: 1 }),
      db.collection(COLLECTIONS.shifts).createIndex({ shiftId: 1 }, { unique: true }),
      db.collection(COLLECTIONS.shifts).createIndex({ companyId: 1, startedAt: -1 }),
      db.collection(COLLECTIONS.activity).createIndex({ companyId: 1, createdAt: -1 }),
      db.collection(COLLECTIONS.documents).createIndex({ companyId: 1, updatedAt: -1 }),
      db.collection(COLLECTIONS.chat).createIndex({ companyId: 1, createdAt: 1 }),
      db
        .collection(COLLECTIONS.subscriptions)
        .createIndex({ userId: 1 }, { unique: true }),
      db.collection(COLLECTIONS.social).createIndex({ companyId: 1 }),
      db.collection(COLLECTIONS.outreach).createIndex({ companyId: 1, createdAt: -1 }),
    ]);
  } catch (e) {
    indexesEnsured = false; // let the next call retry
    console.error("[employee/db] ensureIndexes failed", e);
  }
}

/** Append a line to the company's activity feed — this is the terminal ticker. */
export async function logActivity(
  companyId: string,
  userId: string,
  level: ActivityDoc["level"],
  message: string,
  extra?: { taskId?: string; shiftId?: string },
): Promise<void> {
  try {
    const col = await activity();
    await col.insertOne({
      companyId,
      userId,
      level,
      message: message.slice(0, 500),
      taskId: extra?.taskId,
      shiftId: extra?.shiftId,
      createdAt: new Date(),
    });
  } catch (e) {
    console.error("[employee/db] logActivity failed", e);
  }
}

/** URL-safe slug, collision-resolved by the caller. */
export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "company"
  );
}

/** Find a free slug for this user by appending -2, -3, … as needed. */
export async function uniqueSlug(userId: string, name: string): Promise<string> {
  const base = slugify(name);
  const col = await companies();
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    const clash = await col.findOne({ userId, slug: candidate });
    if (!clash) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}
