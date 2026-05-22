/**
 * TeamPanel — drawer-friendly list of all 12 agents grouped by department.
 * Used inside the Team drawer in Cockpit/index.tsx, replacing the previous
 * embedded OrgChart + WorkflowBoard combo (which was designed for a full tab).
 */
import { useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import clsx from "clsx";

import { runAgent } from "@/api/endpoints";
import type { Agent } from "@/api/types";
import { StatusDot } from "@/components/AgentBadge";
import { useAgentsStore } from "@/store/agents";

const STATUS_LABEL: Record<Agent["status"], string> = {
  idle: "Idle",
  thinking: "Thinking…",
  working: "Working…",
  blocked: "Blocked",
  done: "Finished",
  error: "Error",
};

const DEPT_ORDER = [
  "Executive",
  "Product",
  "Design",
  "Engineering",
  "Marketing",
  "Engagement & Retention",
  "Analytics",
  "Release & Ops",
  "Advisor",
];

export default function TeamPanel({ projectId }: { projectId: number }) {
  const byId = useAgentsStore((s) => s.byId);

  const grouped = useMemo(() => {
    const map: Record<string, Agent[]> = {};
    for (const a of Object.values(byId)) {
      (map[a.department] ||= []).push(a);
    }
    for (const dept in map) {
      map[dept].sort((x, y) => x.id - y.id);
    }
    return map;
  }, [byId]);

  const orderedDepts = DEPT_ORDER.filter((d) => grouped[d]?.length);

  return (
    <div className="flex flex-col gap-5">
      {orderedDepts.map((dept) => (
        <section key={dept}>
          <div className="text-xs font-semibold uppercase tracking-widest text-ink-500">
            {dept}
          </div>
          <ul className="mt-2 space-y-1.5">
            {grouped[dept].map((agent) => (
              <TeamRow key={agent.id} agent={agent} projectId={projectId} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function TeamRow({ agent, projectId }: { agent: Agent; projectId: number }) {
  const run = useMutation({
    mutationFn: () => runAgent(projectId, agent.role),
  });

  return (
    <li className="flex items-center gap-3 rounded-md border border-ink-200 bg-white px-3 py-2">
      <StatusDot status={agent.status} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{agent.display_name}</span>
          {!agent.full_implementation && (
            <span className="rounded-full bg-ink-100 px-1.5 text-[10px] uppercase tracking-wider text-ink-500">
              stub
            </span>
          )}
        </div>
        <div className="truncate text-xs text-ink-500">
          {agent.current_task || STATUS_LABEL[agent.status]}
        </div>
      </div>
      <button
        onClick={() => run.mutate()}
        disabled={run.isPending || agent.status === "thinking" || agent.status === "working"}
        className={clsx(
          "rounded-md px-3 py-1 text-xs font-medium transition",
          run.isPending
            ? "bg-ink-200 text-ink-500"
            : "bg-ink-900 text-white hover:bg-ink-700 disabled:bg-ink-200 disabled:text-ink-500"
        )}
      >
        {run.isPending ? "…" : "Run"}
      </button>
    </li>
  );
}
