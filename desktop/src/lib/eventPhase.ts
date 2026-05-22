/**
 * Classifies an AgentEvent (especially tool_call) into one of the 5
 * "implementing-phase" buckets shown in the TicketFlow stepper.
 */
import type { AgentEvent } from "@/api/types";

export type ImplPhase = "read" | "plan" | "edit" | "test" | "done";

export const IMPL_PHASE_ORDER: ImplPhase[] = ["read", "plan", "edit", "test", "done"];

export const IMPL_PHASE_LABEL: Record<ImplPhase, string> = {
  read: "Read",
  plan: "Plan",
  edit: "Edit",
  test: "Test",
  done: "Done",
};

export function classifyEvent(event: AgentEvent): ImplPhase | null {
  if (event.kind === "tool_call") {
    const tool = String(event.payload?.tool || "");
    if (tool === "Read" || tool === "Glob" || tool === "Grep") return "read";
    if (tool === "Write" || tool === "Edit") return "edit";
    if (tool === "Bash") {
      const input = JSON.stringify(event.payload?.input || "").toLowerCase();
      if (
        input.includes("test") ||
        input.includes("jest") ||
        input.includes("pytest") ||
        input.includes("vitest")
      ) {
        return "test";
      }
      return "edit";
    }
  }
  if (event.kind === "thought") return "plan";
  return null;
}

/**
 * Given a list of events for a single agent run + the current ticket status,
 * return the latest phase reached.
 */
export function currentImplPhase(
  events: AgentEvent[],
  ticketStatus: string
): ImplPhase {
  if (ticketStatus === "done" || ticketStatus === "in_review") return "done";
  let highest: ImplPhase = "read";
  for (const ev of events) {
    const p = classifyEvent(ev);
    if (!p) continue;
    if (IMPL_PHASE_ORDER.indexOf(p) > IMPL_PHASE_ORDER.indexOf(highest)) {
      highest = p;
    }
  }
  return highest;
}
