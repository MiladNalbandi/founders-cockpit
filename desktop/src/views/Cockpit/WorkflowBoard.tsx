import { useMutation } from "@tanstack/react-query";
import clsx from "clsx";

import { runAgent } from "@/api/endpoints";
import type { Agent, AgentRole } from "@/api/types";
import { StatusDot } from "@/components/AgentBadge";
import { useAgentsStore } from "@/store/agents";

type Column = {
  title: string;
  blurb: string;
  roles: AgentRole[];
  accent: string;
};

const COLUMNS: Column[] = [
  {
    title: "Strategy",
    blurb: "Decide what to build.",
    roles: ["ceo", "product"],
    accent: "from-indigo-50 to-indigo-100",
  },
  {
    title: "Design",
    blurb: "Sketch the experience.",
    roles: ["designer"],
    accent: "from-rose-50 to-rose-100",
  },
  {
    title: "Engineering",
    blurb: "Ship web + mobile.",
    roles: ["engineer", "frontend_eng", "backend_eng", "qa_eng"],
    accent: "from-emerald-50 to-emerald-100",
  },
  {
    title: "Marketing",
    blurb: "Get the word out.",
    roles: ["marketer"],
    accent: "from-amber-50 to-amber-100",
  },
  {
    title: "Engagement",
    blurb: "Bring users back.",
    roles: ["engagement"],
    accent: "from-sky-50 to-sky-100",
  },
  {
    title: "Analytics",
    blurb: "Read the signal.",
    roles: ["analyst"],
    accent: "from-cyan-50 to-cyan-100",
  },
  {
    title: "Release",
    blurb: "Publish & monitor.",
    roles: ["release"],
    accent: "from-fuchsia-50 to-fuchsia-100",
  },
];

export default function WorkflowBoard({ projectId }: { projectId: number }) {
  const byId = useAgentsStore((s) => s.byId);
  const byRole: Record<string, Agent> = Object.fromEntries(
    Object.values(byId).map((a) => [a.role, a])
  );
  const run = useMutation({
    mutationFn: ({ role }: { role: string }) => runAgent(projectId, role),
  });

  return (
    <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {COLUMNS.map((col) => (
        <div
          key={col.title}
          className={clsx(
            "flex flex-col self-start rounded-lg border border-ink-200 bg-gradient-to-br p-4",
            col.accent
          )}
        >
          <div className="flex items-baseline justify-between">
            <h3 className="text-sm font-semibold text-ink-800">{col.title}</h3>
            <span className="text-[11px] uppercase tracking-wider text-ink-500">
              {col.roles.length} agent{col.roles.length > 1 ? "s" : ""}
            </span>
          </div>
          <p className="text-xs text-ink-600">{col.blurb}</p>

          <div className="mt-3 flex flex-col gap-2">
            {col.roles.map((role) => {
              const a = byRole[role];
              if (!a) return null;
              return (
                <div key={role} className="rounded-md bg-white/80 p-3 shadow-sm backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                    <StatusDot status={a.status} />
                    <span className="truncate text-sm font-medium">{a.display_name}</span>
                    {!a.full_implementation && (
                      <span className="ml-auto rounded-full bg-ink-100 px-1.5 text-[10px] uppercase tracking-wider text-ink-500">
                        stub
                      </span>
                    )}
                  </div>
                  <div className="mt-1 line-clamp-2 text-xs text-ink-600">
                    {a.current_task || `${a.status}`}
                  </div>
                  <button
                    onClick={() => run.mutate({ role })}
                    disabled={run.isPending}
                    className="mt-3 w-full rounded-md bg-ink-900 px-2 py-1.5 text-xs font-medium text-white hover:bg-ink-700 disabled:opacity-50"
                  >
                    Run
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
