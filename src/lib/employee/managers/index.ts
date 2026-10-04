// ============================================================
// Manager registry
// ============================================================
//
// Adding a capability to the AI employee is one file plus one line here.
// The planner's menu, the chat tool surface and the task-kind mapping are all
// derived from this object.

import { adsManager } from "./ads";
import { buildManager } from "./build";
import { contentManager } from "./content";
import { opsManager } from "./ops";
import { outreachManager } from "./outreach";
import { researchManager } from "./research";
import { revenueManager } from "./revenue";
import { socialManager } from "./social";
import type { ManagerAgent } from "./types";
import { sandboxConfigured } from "../sandbox";
import { vpsConfigured } from "../vps";
import { zernioConfigured } from "../zernio";
import { outreachConfigured } from "../outreach";

export const MANAGERS: Record<string, ManagerAgent> = {
  [opsManager.id]: opsManager,
  [researchManager.id]: researchManager,
  [buildManager.id]: buildManager,
  [contentManager.id]: contentManager,
  [socialManager.id]: socialManager,
  [outreachManager.id]: outreachManager,
  [adsManager.id]: adsManager,
  [revenueManager.id]: revenueManager,
};

export function getManager(id: string): ManagerAgent | undefined {
  return MANAGERS[id];
}

export function managerForKind(kind: string): ManagerAgent | undefined {
  return Object.values(MANAGERS).find((m) => m.kind === kind);
}

/** Which integrations are live on this deployment. */
export function capabilities(): Record<string, boolean> {
  return {
    sandbox: sandboxConfigured(),
    vps: vpsConfigured(),
    zernio: zernioConfigured(),
    email: outreachConfigured(),
    stripe: Boolean(process.env.STRIPE_SECRET_KEY),
  };
}

/** True when everything this manager needs is configured. */
export function managerAvailable(manager: ManagerAgent): boolean {
  const caps = capabilities();
  return (manager.requires || []).every((r) => caps[r]);
}

/**
 * The menu the planner reads. Unavailable managers are still listed, flagged,
 * so the planner can explain the gap rather than silently avoiding a lever.
 */
export function managerMenu(): string {
  return Object.values(MANAGERS)
    .map((m) => {
      const available = managerAvailable(m);
      const missing = (m.requires || []).filter((r) => !capabilities()[r]);
      return [
        `### ${m.id} — ${m.title}${available ? "" : `  [UNAVAILABLE: ${missing.join(", ")} not configured]`}`,
        `What it does: ${m.description}`,
        `How it makes money: ${m.moneyPath}`,
      ].join("\n");
    })
    .join("\n\n");
}

/** OpenAI-shaped tool definitions, for the strategy chat. */
export function managerTools() {
  return Object.values(MANAGERS).map((m) => ({
    type: "function" as const,
    function: {
      name: `queue_${m.id}`,
      description: `Queue a ${m.title} task. ${m.description} ${m.moneyPath}`,
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Short task title shown to the user." },
          ...(m.inputSchema.properties as Record<string, unknown>),
        },
        required: ["title", ...((m.inputSchema.required as string[]) || [])],
      },
    },
  }));
}

export type { ManagerAgent, ManagerContext, ManagerResult, VerifyResult } from "./types";
