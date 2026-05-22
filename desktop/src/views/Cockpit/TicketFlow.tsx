/**
 * TicketFlow — a live stepper showing the agent's progress on a single ticket
 * (Read → Plan → Edit → Test → Done). Subscribes to the global events stream
 * and filters to this ticket's agent run.
 */
import { useMemo } from "react";
import clsx from "clsx";

import type { Ticket } from "@/api/types";
import { IMPL_PHASE_LABEL, IMPL_PHASE_ORDER, classifyEvent, currentImplPhase } from "@/lib/eventPhase";
import { useAgentsStore } from "@/store/agents";

export default function TicketFlow({ ticket }: { ticket: Ticket }) {
  const allEvents = useAgentsStore((s) => s.events);

  // Filter to events from the agent assigned to this ticket, after the ticket started.
  const myEvents = useMemo(() => {
    if (!ticket.assignee_role) return [];
    return allEvents.filter(
      (e) =>
        e.role === ticket.assignee_role &&
        new Date(e.created_at).getTime() >=
          new Date(ticket.created_at).getTime() - 1000
    );
  }, [allEvents, ticket.assignee_role, ticket.created_at]);

  const phase = currentImplPhase(myEvents, ticket.status);
  const activeIdx = IMPL_PHASE_ORDER.indexOf(phase);

  const lastFew = myEvents.slice(-6);

  return (
    <section className="rounded-md border border-ink-200 bg-white p-3">
      <div className="text-xs font-medium uppercase tracking-wider text-ink-500">
        Live progress · {ticket.assignee_display}
      </div>

      <ol className="mt-3 flex items-center gap-0">
        {IMPL_PHASE_ORDER.map((p, i) => {
          const isActive = i === activeIdx;
          const isPast = i < activeIdx;
          return (
            <li key={p} className="flex items-center">
              <span
                className={clsx(
                  "grid h-5 w-5 place-items-center rounded-full text-[9px] font-medium",
                  isActive && "bg-accent text-white ring-4 ring-accent/20 animate-pulse",
                  isPast && "bg-ink-900 text-white",
                  !isActive && !isPast && "bg-ink-100 text-ink-400"
                )}
              >
                {i + 1}
              </span>
              <span
                className={clsx(
                  "ml-1.5 text-[11px] font-medium",
                  isActive ? "text-ink-900" : isPast ? "text-ink-600" : "text-ink-400"
                )}
              >
                {IMPL_PHASE_LABEL[p]}
              </span>
              {i < IMPL_PHASE_ORDER.length - 1 && (
                <span
                  className={clsx(
                    "mx-2 h-px w-5",
                    i < activeIdx ? "bg-ink-900" : "bg-ink-200"
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>

      {lastFew.length > 0 && (
        <ul className="mt-3 space-y-1">
          {lastFew.map((e) => {
            const p = classifyEvent(e);
            return (
              <li key={e.id} className="flex items-start gap-2 text-xs">
                <span className="mt-0.5 text-ink-400">
                  {new Date(e.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                {p && (
                  <span className="rounded-full bg-ink-100 px-1.5 text-[10px] uppercase text-ink-600">
                    {IMPL_PHASE_LABEL[p]}
                  </span>
                )}
                <span className="flex-1 truncate text-ink-700">{e.summary}</span>
              </li>
            );
          })}
        </ul>
      )}

      {ticket.status === "in_progress" && lastFew.length === 0 && (
        <div className="mt-2 text-xs text-ink-500">
          The agent picked up the ticket. Activity will appear here in a few seconds.
        </div>
      )}
    </section>
  );
}
