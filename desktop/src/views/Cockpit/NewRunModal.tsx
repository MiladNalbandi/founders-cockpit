/**
 * Modal for starting a new pipeline run.
 *
 * - Optional description (founder note for this specific run).
 * - If a run is currently active, shows a warning + checkbox to cancel it first.
 */
import { FormEvent, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";

import { startPipeline } from "@/api/endpoints";
import type { PipelineRun } from "@/api/types";
import { usePipelineStore } from "@/store/pipeline";

const ACTIVE_STATUSES = new Set(["pending", "running", "awaiting_approval"]);

export default function NewRunModal({
  projectId,
  onClose,
}: {
  projectId: number;
  onClose: () => void;
}) {
  const runs = usePipelineStore((s) => s.runs);
  const setRun = usePipelineStore((s) => s.setRun);
  const qc = useQueryClient();

  const activeRun: PipelineRun | undefined = runs.find((r) =>
    ACTIVE_STATUSES.has(r.status)
  );

  const [description, setDescription] = useState("");
  const [cancelRunning, setCancelRunning] = useState(false);
  const [conflictErr, setConflictErr] = useState<string | null>(null);

  const send = useMutation({
    mutationFn: () =>
      startPipeline(projectId, {
        description: description.trim() || undefined,
        cancel_running: cancelRunning || !!activeRun ? cancelRunning : false,
      }),
    onSuccess: (run) => {
      setRun(run);
      qc.invalidateQueries({ queryKey: ["pipeline-runs", projectId] });
      onClose();
    },
    onError: (err: any) => {
      const data = err?.response?.data;
      if (err?.response?.status === 409 && data?.code === "pipeline_active") {
        setConflictErr(
          "A pipeline run is already active. Check the 'Cancel current run first' box to replace it."
        );
      } else {
        setConflictErr(data?.detail || "Could not start the run.");
      }
    },
  });

  const needsCancel = !!activeRun && !cancelRunning;

  function submit(e: FormEvent) {
    e.preventDefault();
    setConflictErr(null);
    send.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
      <form
        onSubmit={submit}
        className="w-[540px] max-h-[90vh] overflow-auto rounded-lg bg-white p-6 shadow-xl"
      >
        <h3 className="text-lg font-semibold">Start a new pipeline run</h3>
        <p className="mt-1 text-sm text-ink-500">
          The team will start from the Product Strategist and work through to Release.
          Add a note below if this run has a specific focus.
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-ink-500">
              Description for this run (optional)
            </label>
            <textarea
              className="input mt-1 min-h-[100px]"
              placeholder="e.g. 'Focus on the cook-mode UI — the last run nailed the rest.' Leave empty to use the project's default."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-ink-500">
              This note is passed to the Product Strategist as extra context.
            </p>
          </div>

          {activeRun && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
              <div className="flex items-start gap-2">
                <span className="text-amber-700">⚠</span>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-amber-900">
                    Pipeline Run #{activeRun.id} is still active
                  </div>
                  <p className="mt-0.5 text-xs text-amber-800">
                    Status: {activeRun.status.replace("_", " ")}. Only one run can
                    be active at a time.
                  </p>
                </div>
              </div>
              <label className="mt-3 flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={cancelRunning}
                  onChange={(e) => {
                    setCancelRunning(e.target.checked);
                    setConflictErr(null);
                  }}
                />
                <span className="text-amber-900">
                  Cancel Run #{activeRun.id} and start a new one.
                </span>
              </label>
            </div>
          )}

          {conflictErr && (
            <div className="rounded-md bg-rose-50 p-3 text-sm text-rose-800">
              {conflictErr}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className={clsx("btn", needsCancel && "opacity-50")}
            disabled={send.isPending || needsCancel}
          >
            {send.isPending ? "Starting…" : needsCancel ? "Check the box above" : "Start run"}
          </button>
        </div>
      </form>
    </div>
  );
}
