import type { CompanyView, TaskView } from "@/lib/employee/types";
import type { PlanState } from "@/lib/employee/plan-constants";

export interface ActivityLine {
  id: string;
  level: "info" | "warn" | "error" | "success";
  message: string;
  createdAt: string;
}

export interface DocumentRow {
  id: string;
  title: string;
  kind: string;
  updatedAt: string;
}

export interface SocialPost {
  id: string;
  platform: string;
  username: string;
  content: string;
  status: string;
  createdAt: string;
}

export interface EmailRow {
  id: string;
  to: string;
  subject: string;
  status: string;
  createdAt: string;
}

export interface ShiftSummary {
  id: string;
  status: string;
  report: string;
  startedAt: string;
  finishedAt: string | null;
}

/** The single payload GET /api/companies/[slug] returns. */
export interface DashboardData {
  company: CompanyView;
  plan: PlanState;
  capabilities: Record<string, boolean>;
  tasks: TaskView[];
  documents: DocumentRow[];
  activity: ActivityLine[];
  lastShift: ShiftSummary | null;
  social: SocialPost[];
  email: { recent: EmailRow[]; sent: number; replies: number };
}

export type { CompanyView, TaskView, PlanState };
