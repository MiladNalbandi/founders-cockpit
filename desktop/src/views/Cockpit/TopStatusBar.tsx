import { useMemo } from "react";
import clsx from "clsx";

import { usePipelineStore } from "@/store/pipeline";
import { useTicketsStore } from "@/store/tickets";

export default function TopStatusBar({ onJumpTo }: { onJumpTo: (tab: string) => void }) {
  const currentRun = usePipelineStore((s) => s.currentRun);
  const steps = usePipelineStore((s) => s.steps);
  const ticketsById = useTicketsStore((s) => s.byId);

  const awaitingSteps = useMemo(
    () => Object.values(steps).filter((s) => s.status === "awaiting_approval"),
    [steps]
  );
  const reviewTickets = useMemo(
    () => Object.values(ticketsById).filter((t) => t.status === "in_review"),
    [ticketsById]
  );
  const runningStep = useMemo(
    () => Object.values(steps).find((s) => s.status === "running"),
    [steps]
  );

  const totalActionable = awaitingSteps.length + reviewTickets.length;

  if (totalActionable === 0) {
    if (runningStep) {
      return (
        <div className="flex items-center gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm">
          <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
          <span className="font-medium text-amber-900">
            The team is working
          </span>
          <span className="text-amber-700">
            {runningStep.display_name} is running…
          </span>
        </div>
      );
    }
    if (currentRun?.status === "done") {
      return (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
          <span className="font-medium">All caught up.</span> The latest pipeline finished.
          Open the Preview tab to test what was built.
        </div>
      );
    }
    return (
      <div className="rounded-md border border-ink-200 bg-white px-4 py-2 text-sm text-ink-600">
        Idle. Start a pipeline run when you're ready.
      </div>
    );
  }

  // There's something to act on — make it loud.
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-violet-300 bg-violet-50 px-4 py-2.5 text-sm shadow-sm">
      <span className="rounded-full bg-violet-600 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white">
        Needs you
      </span>
      <span className="font-medium text-violet-900">
        {totalActionable} item{totalActionable > 1 ? "s" : ""} need your review
      </span>
      <span className="flex-1" />
      {awaitingSteps.length > 0 && (
        <button
          onClick={() => onJumpTo("pipeline")}
          className={clsx(
            "rounded-md bg-violet-600 px-3 py-1 text-xs font-medium text-white hover:bg-violet-700"
          )}
        >
          Pipeline · {awaitingSteps.length} step{awaitingSteps.length > 1 ? "s" : ""}
        </button>
      )}
      {reviewTickets.length > 0 && (
        <button
          onClick={() => onJumpTo("tickets")}
          className={clsx(
            "rounded-md bg-violet-600 px-3 py-1 text-xs font-medium text-white hover:bg-violet-700"
          )}
        >
          Tickets · {reviewTickets.length}
        </button>
      )}
    </div>
  );
}
