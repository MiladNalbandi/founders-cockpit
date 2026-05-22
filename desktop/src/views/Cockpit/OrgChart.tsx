import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import ReactFlow, {
  Background,
  Controls,
  Edge,
  Node,
  Position,
} from "reactflow";
import "reactflow/dist/style.css";

import { runAgent } from "@/api/endpoints";
import type { Agent } from "@/api/types";
import AgentBadge, { StatusDot } from "@/components/AgentBadge";
import { useAgentsStore } from "@/store/agents";

const COLS: Record<string, number> = {
  ceo: 0,
  buddy: 0,
  product: -2,
  designer: -1,
  engineer: 0,
  marketer: 1,
  engagement: 2,
  analyst: -1.5,
  release: 1.5,
  frontend_eng: -0.75,
  backend_eng: 0,
  qa_eng: 0.75,
};

const X_STEP = 240;
const Y_STEP = 160;

function positionFor(role: string, isRoot: boolean, isBuddy: boolean): { x: number; y: number } {
  if (isRoot) return { x: 0, y: 0 };
  if (isBuddy) return { x: 800, y: 0 };
  const col = COLS[role] ?? 0;
  // VPs row
  if (["product", "designer", "engineer", "marketer", "engagement"].includes(role)) {
    return { x: col * X_STEP, y: Y_STEP };
  }
  // Sub-engineers — children of engineer
  if (["frontend_eng", "backend_eng", "qa_eng"].includes(role)) {
    return { x: col * X_STEP, y: Y_STEP * 2 };
  }
  // 2nd-tier (analyst / release as direct reports to CEO too)
  return { x: col * X_STEP, y: Y_STEP * 2 };
}

function AgentNode({ data }: { data: { agent: Agent } }) {
  const a = data.agent;
  return (
    <div className="rounded-lg border border-ink-200 bg-white px-3 py-2 shadow-sm w-[180px]">
      <div className="flex items-center gap-2">
        <StatusDot status={a.status} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{a.display_name}</div>
          <div className="truncate text-[11px] text-ink-500">{a.department}</div>
        </div>
      </div>
      {a.current_task && (
        <div className="mt-1.5 line-clamp-2 text-[11px] text-ink-600">
          {a.current_task}
        </div>
      )}
      {!a.full_implementation && (
        <div className="mt-1.5 inline-block rounded-full bg-ink-100 px-1.5 text-[10px] uppercase tracking-wider text-ink-500">
          stub
        </div>
      )}
    </div>
  );
}

const nodeTypes = { agent: AgentNode };

export default function OrgChart({ projectId }: { projectId: number }) {
  const byId = useAgentsStore((s) => s.byId);
  const list = Object.values(byId);
  const [selected, setSelected] = useState<Agent | null>(null);
  const nav = useNavigate();
  const run = useMutation({
    mutationFn: ({ role, input }: { role: string; input?: string }) =>
      runAgent(projectId, role, input),
  });

  const { nodes, edges } = useMemo<{ nodes: Node[]; edges: Edge[] }>(() => {
    const byRole = Object.fromEntries(list.map((a) => [a.role, a]));
    const nodes: Node[] = list.map((a) => {
      const isRoot = a.role === "ceo";
      const isBuddy = a.role === "buddy";
      return {
        id: String(a.id),
        type: "agent",
        position: positionFor(a.role, isRoot, isBuddy),
        data: { agent: a },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      };
    });
    const edges: Edge[] = [];
    for (const a of list) {
      if (!a.parent_role) continue;
      const parent = byRole[a.parent_role];
      if (!parent) continue;
      edges.push({
        id: `e${parent.id}-${a.id}`,
        source: String(parent.id),
        target: String(a.id),
        animated: a.status === "thinking" || a.status === "working",
        style: { stroke: "#b6b6c0" },
      });
    }
    return { nodes, edges };
  }, [list]);

  return (
    <div className="grid h-full grid-cols-[1fr_300px] gap-4">
      <div className="card h-[680px] overflow-hidden">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          onNodeClick={(_, n) => setSelected(byId[Number(n.id)] || null)}
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>
      <aside className="card flex flex-col">
        <div className="border-b border-ink-200 p-4">
          <h3 className="text-sm font-semibold">Team</h3>
          <p className="mt-1 text-xs text-ink-500">Click any agent to run it.</p>
        </div>
        <div className="flex-1 space-y-1.5 overflow-auto p-3">
          {list
            .slice()
            .sort((a, b) => a.id - b.id)
            .map((a) => (
              <AgentBadge
                key={a.id}
                agent={a}
                selected={selected?.id === a.id}
                onClick={() => setSelected(a)}
              />
            ))}
        </div>
        {selected && (
          <div className="border-t border-ink-200 p-4">
            <div className="text-sm font-medium">{selected.display_name}</div>
            <div className="text-xs text-ink-500">{selected.department}</div>
            <button
              className="btn mt-3 w-full"
              disabled={run.isPending}
              onClick={() => run.mutate({ role: selected.role })}
            >
              {run.isPending ? "Dispatching…" : `Run ${selected.display_name}`}
            </button>
            <button
              className="btn-ghost mt-2 w-full border border-ink-200"
              onClick={() => nav(`/cockpit/${projectId}/agent/${selected.role}`)}
            >
              Open agent page →
            </button>
            {run.isError && (
              <div className="mt-2 text-xs text-red-600">
                {(run.error as any)?.response?.data?.detail || "Failed"}
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
