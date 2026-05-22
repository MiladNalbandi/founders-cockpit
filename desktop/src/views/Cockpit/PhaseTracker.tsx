import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";

import { listArtifacts } from "@/api/endpoints";
import { PHASE_LABEL, PHASE_ORDER, getCurrentPhase } from "@/lib/phase";
import { usePipelineStore } from "@/store/pipeline";
import { useTicketsStore } from "@/store/tickets";

export default function PhaseTracker({ projectId }: { projectId: number }) {
  const currentRun = usePipelineStore((s) => s.currentRun);
  const ticketsById = useTicketsStore((s) => s.byId);
  const { data: artifacts = [] } = useQuery({
    queryKey: ["artifacts", projectId],
    queryFn: () => listArtifacts(projectId),
    enabled: !!projectId,
  });

  const tickets = Object.values(ticketsById);
  const { phase, description } = getCurrentPhase(currentRun, tickets, artifacts);
  const activeIdx = PHASE_ORDER.indexOf(phase);

  return (
    <div className="card flex flex-col gap-3 px-5 py-3 lg:flex-row lg:items-center">
      <ol className="flex items-center gap-0">
        {PHASE_ORDER.map((p, i) => {
          const isActive = i === activeIdx;
          const isPast = i < activeIdx;
          return (
            <li key={p} className="flex items-center">
              <span
                className={clsx(
                  "grid h-6 w-6 place-items-center rounded-full text-[10px] font-medium",
                  isActive && "bg-accent text-white ring-4 ring-accent/20",
                  isPast && "bg-ink-900 text-white",
                  !isActive && !isPast && "bg-ink-100 text-ink-400"
                )}
              >
                {i + 1}
              </span>
              <span
                className={clsx(
                  "ml-1.5 mr-3 text-xs font-medium",
                  isActive ? "text-ink-900" : isPast ? "text-ink-600" : "text-ink-400"
                )}
              >
                {PHASE_LABEL[p]}
              </span>
              {i < PHASE_ORDER.length - 1 && (
                <span
                  className={clsx(
                    "mr-3 h-px w-6",
                    i < activeIdx ? "bg-ink-900" : "bg-ink-200"
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
      <p className="text-sm text-ink-600 lg:ml-auto lg:max-w-xl">{description}</p>
    </div>
  );
}
