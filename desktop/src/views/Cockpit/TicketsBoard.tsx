import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { listTickets } from "@/api/endpoints";
import type { Ticket } from "@/api/types";
import PrettyLabel from "@/components/PrettyLabel";
import { STATUS_COLUMNS, useTicketsStore } from "@/store/tickets";
import CreateTaskModal from "./CreateTaskModal";

export default function TicketsBoard({ projectId }: { projectId: number }) {
  const byId = useTicketsStore((s) => s.byId);
  const hydrate = useTicketsStore((s) => s.hydrate);
  const select = useTicketsStore((s) => s.select);
  const [createOpen, setCreateOpen] = useState(false);

  useQuery({
    queryKey: ["tickets", projectId],
    queryFn: async () => {
      const tickets = await listTickets(projectId);
      hydrate(tickets);
      return tickets;
    },
    enabled: !!projectId,
    refetchInterval: 5_000,
  });

  const tickets = Object.values(byId).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div className="flex h-full flex-col gap-3">
      <header className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-ink-500">Tickets</div>
          <div className="text-sm text-ink-600">
            Everything the team is working on or needs your review.
          </div>
        </div>
        <button className="btn" onClick={() => setCreateOpen(true)}>
          + New task
        </button>
      </header>

      {createOpen && (
        <CreateTaskModal projectId={projectId} onClose={() => setCreateOpen(false)} />
      )}

      <div className="grid flex-1 grid-cols-5 gap-3 overflow-x-auto">
        {STATUS_COLUMNS.map((col) => {
          const inCol = tickets.filter((t) => t.status === col.id);
          return (
            <div
              key={col.id}
              className="flex min-w-0 flex-col rounded-lg border border-ink-200 bg-white"
            >
              <header className="flex items-center justify-between border-b border-ink-200 px-3 py-2">
                <span className="text-sm font-semibold">{col.title}</span>
                <span className="rounded-full bg-ink-100 px-1.5 text-xs text-ink-600">
                  {inCol.length}
                </span>
              </header>
              <div className="flex-1 space-y-2 overflow-auto p-2">
                {inCol.length === 0 ? (
                  <div className="grid h-full place-items-center text-xs text-ink-400">
                    —
                  </div>
                ) : (
                  inCol.map((t) => (
                    <TicketCard key={t.id} ticket={t} onClick={() => select(t.id)} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TicketCard({ ticket, onClick }: { ticket: Ticket; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-md border border-ink-200 bg-white p-2 text-left transition hover:border-ink-300 hover:bg-ink-50"
    >
      <div className="line-clamp-2 text-sm font-medium">{ticket.title}</div>
      <div className="mt-2 flex items-center justify-between gap-1">
        <span className="truncate text-[11px] text-ink-500">
          {ticket.assignee_display || "unassigned"}
        </span>
        <PrettyLabel kind="priority" value={ticket.priority} />
      </div>
      {ticket.revision > 1 && (
        <div className="mt-1 text-[10px] text-rose-600">revision {ticket.revision}</div>
      )}
    </button>
  );
}
