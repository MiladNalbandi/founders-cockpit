/**
 * Single source of truth for human-readable status / mode / kind names.
 * Use everywhere instead of raw enum strings.
 */
import clsx from "clsx";

import type {
  ApprovalMode,
  PipelineRunStatus,
  PipelineStepStatus,
  TicketPriority,
  TicketStatus,
} from "@/api/types";

const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  created: "Just created",
  triaged: "Queued for the team",
  in_progress: "The team is working",
  in_review: "Needs your review",
  done: "Done",
  rejected: "You asked for changes",
};

const TICKET_STATUS_TONE: Record<TicketStatus, string> = {
  created: "bg-ink-100 text-ink-600",
  triaged: "bg-sky-100 text-sky-700",
  in_progress: "bg-amber-100 text-amber-700",
  in_review: "bg-violet-100 text-violet-800",
  done: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
};

const STEP_STATUS_LABEL: Record<PipelineStepStatus, string> = {
  pending: "Queued",
  ready: "Ready to start",
  running: "Working…",
  awaiting_approval: "Needs your review",
  approved: "Approved",
  rejected: "You asked for changes",
  done: "Done",
  failed: "Failed",
  skipped: "Skipped",
};

const STEP_STATUS_TONE: Record<PipelineStepStatus, string> = {
  pending: "bg-ink-100 text-ink-500",
  ready: "bg-ink-100 text-ink-700",
  running: "bg-amber-100 text-amber-700",
  awaiting_approval: "bg-violet-100 text-violet-800",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
  done: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
  skipped: "bg-ink-100 text-ink-500",
};

const RUN_STATUS_LABEL: Record<PipelineRunStatus, string> = {
  pending: "Getting ready",
  running: "Running",
  awaiting_approval: "Waiting on you",
  done: "Finished",
  failed: "Failed",
  cancelled: "Cancelled",
};

const RUN_STATUS_TONE: Record<PipelineRunStatus, string> = {
  pending: "bg-ink-100 text-ink-600",
  running: "bg-amber-100 text-amber-700",
  awaiting_approval: "bg-violet-100 text-violet-800",
  done: "bg-emerald-100 text-emerald-700",
  failed: "bg-red-100 text-red-700",
  cancelled: "bg-ink-100 text-ink-500",
};

const APPROVAL_MODE_LABEL: Record<ApprovalMode, string> = {
  after_run: "After every agent finishes",
  milestone: "Only at major milestones",
  every_tool_call: "After every action (granular)",
  per_role: "Custom — depends on the role",
  skip: "Run fully autonomous",
};

const PRIORITY_TONE: Record<TicketPriority, string> = {
  low: "bg-ink-100 text-ink-500",
  medium: "bg-sky-100 text-sky-700",
  high: "bg-amber-100 text-amber-700",
  urgent: "bg-rose-100 text-rose-700",
};

export function ticketStatusLabel(s: TicketStatus): string {
  return TICKET_STATUS_LABEL[s] || s;
}

export function stepStatusLabel(s: PipelineStepStatus): string {
  return STEP_STATUS_LABEL[s] || s;
}

export function runStatusLabel(s: PipelineRunStatus): string {
  return RUN_STATUS_LABEL[s] || s;
}

export function approvalModeLabel(m: ApprovalMode): string {
  return APPROVAL_MODE_LABEL[m] || m;
}

type Variant =
  | { kind: "ticket-status"; value: TicketStatus }
  | { kind: "step-status"; value: PipelineStepStatus }
  | { kind: "run-status"; value: PipelineRunStatus }
  | { kind: "priority"; value: TicketPriority };

export default function PrettyLabel(props: Variant & { className?: string }) {
  const { className } = props;
  let label = "";
  let tone = "";
  if (props.kind === "ticket-status") {
    label = TICKET_STATUS_LABEL[props.value] || props.value;
    tone = TICKET_STATUS_TONE[props.value];
  } else if (props.kind === "step-status") {
    label = STEP_STATUS_LABEL[props.value] || props.value;
    tone = STEP_STATUS_TONE[props.value];
  } else if (props.kind === "run-status") {
    label = RUN_STATUS_LABEL[props.value] || props.value;
    tone = RUN_STATUS_TONE[props.value];
  } else if (props.kind === "priority") {
    label = props.value;
    tone = PRIORITY_TONE[props.value];
  }
  return (
    <span
      className={clsx(
        "inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
        tone,
        className
      )}
    >
      {label}
    </span>
  );
}
