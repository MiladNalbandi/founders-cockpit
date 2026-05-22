/**
 * Phase derivation — answers "what is the idea doing right now".
 *
 * Pure function over pipeline run + tickets + artifacts. No API calls.
 */
import type { Artifact, PipelineRun, Ticket } from "@/api/types";

export type IdeaPhase =
  | "idea"
  | "planning"
  | "designing"
  | "building"
  | "testing"
  | "iterating";

export const PHASE_ORDER: IdeaPhase[] = [
  "idea",
  "planning",
  "designing",
  "building",
  "testing",
  "iterating",
];

export const PHASE_LABEL: Record<IdeaPhase, string> = {
  idea: "Idea",
  planning: "Planning",
  designing: "Designing",
  building: "Building",
  testing: "Testing",
  iterating: "Iterating",
};

export type PhaseInfo = {
  phase: IdeaPhase;
  description: string;
};

export function getCurrentPhase(
  run: PipelineRun | null,
  tickets: Ticket[],
  artifacts: Artifact[]
): PhaseInfo {
  // Founder-filed ticket = we're in the iteration loop.
  const founderTicket = tickets.find((t) => t.created_by_role === "founder");
  if (founderTicket) {
    return {
      phase: "iterating",
      description:
        `You filed a ticket (#${founderTicket.id}: "${founderTicket.title}"). The team is working through your feedback.`,
    };
  }

  // Preview exists and no engineering tickets in flight → ready to test.
  const previewArt = artifacts.find((a) => a.path === "preview/index.html");
  const engineeringInFlight = tickets.some(
    (t) =>
      ["frontend_eng", "backend_eng", "qa_eng"].includes(t.assignee_role) &&
      (t.status === "in_progress" || t.status === "triaged")
  );
  if (previewArt && !engineeringInFlight) {
    return {
      phase: "testing",
      description:
        "The team finished a build. Open the Preview tab to click through it; use 'Report bug' to send feedback.",
    };
  }

  // No pipeline run yet.
  if (!run) {
    return {
      phase: "idea",
      description:
        "Your idea is captured. Start the Idea → MVP pipeline to put the team to work.",
    };
  }

  // Pipeline running — find the current "active" step.
  const steps = run.steps || [];
  const inFlight = steps.find(
    (s) =>
      s.status === "running" ||
      s.status === "awaiting_approval" ||
      s.status === "ready"
  );
  const role = inFlight?.role || "";

  if (role === "product") {
    return {
      phase: "planning",
      description:
        inFlight?.status === "awaiting_approval"
          ? "The Product Strategist drafted the PRD. Approve it to continue."
          : "The Product Strategist is writing the PRD.",
    };
  }
  if (role === "designer") {
    return {
      phase: "designing",
      description:
        inFlight?.status === "awaiting_approval"
          ? "The Designer produced a mockup. Approve it to continue."
          : "The Designer is sketching the UI.",
    };
  }
  if (
    role === "engineer" ||
    role === "frontend_eng" ||
    role === "backend_eng" ||
    role === "qa_eng" ||
    engineeringInFlight
  ) {
    return {
      phase: "building",
      description: engineeringInFlight
        ? "The engineering team is implementing the MVP. Tickets are open in the Tickets tab."
        : inFlight?.status === "awaiting_approval"
          ? "The Engineering Lead is waiting for your approval on the plan."
          : "The Engineering Lead is planning the implementation.",
    };
  }

  if (run.status === "done") {
    return {
      phase: "testing",
      description: "The pipeline finished. Try the preview and file feedback if needed.",
    };
  }
  if (run.status === "cancelled") {
    return {
      phase: "idea",
      description: "The last pipeline was cancelled. Start a new run when you're ready.",
    };
  }
  return {
    phase: "building",
    description: "The team is working through the pipeline.",
  };
}
