import clsx from "clsx";

import type { Agent } from "@/api/types";

const STATUS_LABELS: Record<Agent["status"], string> = {
  idle: "idle",
  thinking: "thinking",
  working: "working",
  blocked: "blocked",
  done: "done",
  error: "error",
};

export function StatusDot({ status }: { status: Agent["status"] }) {
  return <span className={clsx("inline-block h-2.5 w-2.5 rounded-full", `dot-${status}`)} />;
}

export default function AgentBadge({ agent, onClick, selected }: { agent: Agent; onClick?: () => void; selected?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition",
        selected
          ? "border-accent bg-accent/10"
          : "border-ink-200 bg-white hover:bg-ink-50"
      )}
    >
      <StatusDot status={agent.status} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="truncate">{agent.display_name}</span>
          {!agent.full_implementation && (
            <span className="rounded-full bg-ink-100 px-1.5 text-[10px] uppercase tracking-wider text-ink-500">
              stub
            </span>
          )}
        </div>
        <div className="truncate text-xs text-ink-500">
          {agent.current_task || STATUS_LABELS[agent.status]}
        </div>
      </div>
    </button>
  );
}
