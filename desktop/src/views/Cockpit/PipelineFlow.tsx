import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import ReactFlow, { Background, Controls, Edge, Node, Position } from "reactflow";
import "reactflow/dist/style.css";
import clsx from "clsx";

import {
  cancelPipelineRun,
  getPipelineRun,
  listPipelineRuns,
  retryPipelineStep,
} from "@/api/endpoints";
import type { PipelineRun, PipelineStep } from "@/api/types";
import { usePipelineStore } from "@/store/pipeline";
import PrettyLabel from "@/components/PrettyLabel";
import NewRunModal from "./NewRunModal";

// Hardcoded DAG layout matching the default Idea→MVP template (V3.2).
const POSITIONS: Record<string, { x: number; y: number }> = {
  product: { x: 0, y: 0 },
  designer: { x: 0, y: 130 },
  // Engineering team — Frontend ∥ Backend run in parallel, QA waits for both.
  engineer: { x: 0, y: 260 },
  frontend_eng: { x: -150, y: 380 },
  backend_eng: { x: 150, y: 380 },
  qa_eng: { x: 0, y: 500 },
  // Post-eng roles run in parallel after QA.
  marketer: { x: -360, y: 620 },
  engagement: { x: -120, y: 620 },
  analyst: { x: 120, y: 620 },
  release: { x: 360, y: 620 },
};

function StepNode({ data }: { data: { step: PipelineStep; onRetry?: (id: number) => void } }) {
  const s = data.step;
  const isFailed = s.status === "failed";
  const isTimeout = isFailed && (s.feedback?.includes("timed out") || s.feedback?.includes("TimeoutError"));
  return (
    <div
      className={clsx(
        "w-[200px] rounded-lg border bg-white px-3 py-2 shadow-sm",
        s.status === "awaiting_approval"
          ? "border-violet-400 ring-2 ring-violet-200"
          : isFailed
          ? "border-red-400 ring-2 ring-red-100"
          : "border-ink-200"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium">{s.display_name}</span>
        <PrettyLabel kind="step-status" value={s.status} />
      </div>
      <div className="mt-1 text-[11px] text-ink-500">{s.department}</div>
      {s.revision > 1 && (
        <div className="mt-1 text-[10px] text-rose-600">revision {s.revision}</div>
      )}
      {s.artifact_path && !isFailed && (
        <div className="mt-1 truncate font-mono text-[10px] text-ink-500">{s.artifact_path}</div>
      )}
      {isFailed && (
        <div className="mt-2 space-y-1">
          <div className="text-[10px] text-red-600 leading-tight">
            {isTimeout ? "⏱ Timed out" : "❌ Failed"}
          </div>
          <button
            className="w-full rounded border border-red-300 bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700 hover:bg-red-100 transition"
            onClick={(e) => {
              e.stopPropagation();
              data.onRetry?.(s.id);
            }}
          >
            ↺ Retry
          </button>
        </div>
      )}
    </div>
  );
}

const nodeTypes = { step: StepNode };

export default function PipelineFlow({ projectId }: { projectId: number }) {
  const setRun = usePipelineStore((s) => s.setRun);
  const setRuns = usePipelineStore((s) => s.setRuns);
  const selectStep = usePipelineStore((s) => s.selectStep);
  const currentRun = usePipelineStore((s) => s.currentRun);
  const runs = usePipelineStore((s) => s.runs);
  const steps = usePipelineStore((s) => s.steps);

  const qc = useQueryClient();
  const [showNewRun, setShowNewRun] = useState(false);

  // Load runs list, auto-select latest if nothing selected yet.
  useQuery({
    queryKey: ["pipeline-runs", projectId],
    queryFn: async () => {
      const fetched = await listPipelineRuns(projectId);
      setRuns(fetched);
      if (!currentRun && fetched.length) {
        const fresh = await getPipelineRun(projectId, fetched[0].id);
        setRun(fresh);
      }
      return fetched;
    },
    enabled: !!projectId,
  });

  const cancelMut = useMutation({
    mutationFn: (runId: number) => cancelPipelineRun(runId),
    onSuccess: (run) => {
      setRun(run);
      qc.invalidateQueries({ queryKey: ["pipeline-runs", projectId] });
    },
  });

  const retryMut = useMutation({
    mutationFn: (stepId: number) => retryPipelineStep(stepId),
    onSuccess: async () => {
      // Refresh the full run so the new step appears in the DAG.
      if (currentRun) {
        const fresh = await getPipelineRun(projectId, currentRun.id);
        setRun(fresh);
      }
    },
  });

  const switchTo = async (runId: number) => {
    const fresh = await getPipelineRun(projectId, runId);
    setRun(fresh);
  };

  const handleRetry = (stepId: number) => {
    retryMut.mutate(stepId);
  };

  const { nodes, edges } = useMemo<{ nodes: Node[]; edges: Edge[] }>(() => {
    if (!currentRun) return { nodes: [], edges: [] };
    const list = Object.values(steps);
    const nodes: Node[] = list.map((s) => ({
      id: String(s.id),
      type: "step",
      position: POSITIONS[s.role] || { x: 0, y: 0 },
      data: { step: s, onRetry: handleRetry },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    }));
    const edges: Edge[] = [];
    for (const s of list) {
      for (const parent of s.depends_on) {
        if (!steps[parent]) continue;
        edges.push({
          id: `e${parent}-${s.id}`,
          source: String(parent),
          target: String(s.id),
          animated: s.status === "running" || s.status === "ready",
          style: { stroke: s.status === "awaiting_approval" ? "#8b5cf6" : "#b6b6c0" },
        });
      }
    }
    return { nodes, edges };
  }, [currentRun, steps]);

  return (
    <div className="grid h-full grid-cols-[220px_1fr] gap-4">
      <aside className="card flex flex-col">
        <header className="border-b border-ink-200 p-3">
          <div className="text-xs font-semibold uppercase tracking-widest text-ink-500">
            Pipeline runs
          </div>
        </header>
        <div className="flex-1 space-y-1.5 overflow-auto p-2">
          {runs.length === 0 && (
            <div className="px-2 py-3 text-xs text-ink-500">
              No runs yet. Click "New run" below to start one.
            </div>
          )}
          {runs.map((r) => (
            <RunCard
              key={r.id}
              run={r}
              active={currentRun?.id === r.id}
              onClick={() => switchTo(r.id)}
            />
          ))}
        </div>
        <footer className="border-t border-ink-200 p-3">
          <button
            className="btn w-full"
            onClick={() => setShowNewRun(true)}
          >
            + New run
          </button>
        </footer>
      </aside>

      <section className="card relative overflow-hidden">
        {!currentRun ? (
          <EmptyFlow onStart={() => setShowNewRun(true)} />
        ) : (
          <>
            <header className="absolute left-0 right-0 top-0 z-10 flex items-center gap-3 border-b border-ink-200 bg-white/95 px-4 py-2 backdrop-blur">
              <div className="min-w-0">
                <div className="text-xs uppercase tracking-widest text-ink-500">
                  Run #{currentRun.id} · started {timeAgo(currentRun.started_at)}
                </div>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <PrettyLabel kind="run-status" value={currentRun.status} />
                  {currentRun.description && (
                    <span className="ml-2 truncate text-xs italic text-ink-500">
                      "{currentRun.description}"
                    </span>
                  )}
                </div>
              </div>
              <div className="ml-auto flex gap-2">
                {(currentRun.status === "running" ||
                  currentRun.status === "awaiting_approval") && (
                  <button
                    className="btn-ghost border border-rose-200 text-rose-700 hover:bg-rose-50"
                    disabled={cancelMut.isPending}
                    onClick={() => {
                      if (confirm("Cancel this pipeline run?"))
                        cancelMut.mutate(currentRun.id);
                    }}
                  >
                    {cancelMut.isPending ? "Cancelling…" : "Cancel run"}
                  </button>
                )}
                <button className="btn" onClick={() => setShowNewRun(true)}>
                  Restart pipeline
                </button>
              </div>
            </header>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              fitView
              onNodeClick={(_, n) => selectStep(Number(n.id))}
              proOptions={{ hideAttribution: true }}
            >
              <Background />
              <Controls />
            </ReactFlow>
          </>
        )}
      </section>

      {showNewRun && (
        <NewRunModal projectId={projectId} onClose={() => setShowNewRun(false)} />
      )}
    </div>
  );
}

function RunCard({
  run,
  active,
  onClick,
}: {
  run: PipelineRun;
  active: boolean;
  onClick: () => void;
}) {
  const awaiting =
    run.steps?.filter((s) => s.status === "awaiting_approval").length || 0;
  return (
    <button
      onClick={onClick}
      className={clsx(
        "w-full rounded-md border px-2.5 py-2 text-left transition",
        active
          ? "border-accent bg-accent/10"
          : "border-ink-200 bg-white hover:bg-ink-50"
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-sm font-medium">Run #{run.id}</span>
        <PrettyLabel kind="run-status" value={run.status} />
      </div>
      <div className="mt-1 text-[11px] text-ink-500">{timeAgo(run.started_at)}</div>
      {awaiting > 0 && (
        <div className="mt-1 text-[11px] font-medium text-violet-700">
          ⚠ {awaiting} need{awaiting > 1 ? "" : "s"} you
        </div>
      )}
    </button>
  );
}

function EmptyFlow({ onStart }: { onStart: () => void }) {
  return (
    <div className="grid h-full place-items-center p-12">
      <div className="max-w-md text-center">
        <h2 className="text-lg font-semibold">No pipeline yet</h2>
        <p className="mt-2 text-sm text-ink-500">
          Kick off the Idea → MVP pipeline. The team produces a PRD, designs, and
          a scaffolded codebase — pausing for your approval at each step.
        </p>
        <button className="btn mt-5" onClick={onStart}>
          Run Idea → MVP pipeline
        </button>
      </div>
    </div>
  );
}

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  return `${Math.floor(seconds / 86400)} d ago`;
}
