import { create } from "zustand";

import type { PipelineRun, PipelineStep, PipelineStepStatus } from "@/api/types";

type PipelineState = {
  currentRun: PipelineRun | null;
  runs: PipelineRun[];
  runsLoaded: boolean;
  steps: Record<number, PipelineStep>;
  selectedStepId: number | null;
  setRun: (run: PipelineRun) => void;
  setRuns: (runs: PipelineRun[]) => void;
  upsertStep: (patch: Partial<PipelineStep> & { id: number }) => void;
  upsertRunStatus: (
    runId: number,
    patch: Partial<Pick<PipelineRun, "status" | "finished_at" | "approval_mode">>
  ) => void;
  selectStep: (id: number | null) => void;
  clear: () => void;
};

export const usePipelineStore = create<PipelineState>((set) => ({
  currentRun: null,
  runs: [],
  runsLoaded: false,
  steps: {},
  selectedStepId: null,
  setRun: (run) =>
    set((s) => ({
      currentRun: run,
      steps: Object.fromEntries(run.steps.map((step) => [step.id, step])),
      runs: s.runs.some((r) => r.id === run.id)
        ? s.runs.map((r) => (r.id === run.id ? run : r))
        : [run, ...s.runs],
      selectedStepId: null,
    })),
  setRuns: (runs) => set({ runs, runsLoaded: true }),
  upsertStep: (patch) =>
    set((s) => ({
      steps: { ...s.steps, [patch.id]: { ...s.steps[patch.id], ...patch } as PipelineStep },
    })),
  upsertRunStatus: (runId, patch) =>
    set((s) => ({
      runs: s.runs.map((r) => (r.id === runId ? { ...r, ...patch } : r)),
      currentRun:
        s.currentRun && s.currentRun.id === runId
          ? { ...s.currentRun, ...patch }
          : s.currentRun,
    })),
  selectStep: (id) => set({ selectedStepId: id }),
  clear: () =>
    set({ currentRun: null, runs: [], runsLoaded: false, steps: {}, selectedStepId: null }),
}));

export const STEP_TONE: Record<PipelineStepStatus, string> = {
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
