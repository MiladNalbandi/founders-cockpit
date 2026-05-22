/**
 * TeamSwimlanes — Tickets grouped by department/team, each team's mini-kanban
 * runs as its own row so you can see parallel work across the org.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { listTickets, teamDashboard } from "@/api/endpoints";
import type { Ticket, TicketStatus } from "@/api/types";
import PrettyLabel from "@/components/PrettyLabel";
import { STATUS_COLUMNS, useTicketsStore } from "@/store/tickets";
import CreateTaskModal from "./CreateTaskModal";

export default function TeamSwimlanes({ projectId }: { projectId: number }) {
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

  const { data: teams = [] } = useQuery({
    queryKey: ["teams", projectId],
    queryFn: () => teamDashboard(projectId),
    enabled: !!projectId,
    refetchInterval: 5_000,
  });

  const tickets = Object.values(byId);

  // Group tickets by department (using ticket.department which the serializer fills in).
  const byDept = useMemo<Record<string, Ticket[]>>(() => {
    const m: Record<string, Ticket[]> = {};
    for (const t of tickets) {
      const dept = t.department || "Other";
      (m[dept] = m[dept] || []).push(t);
    }
    return m;
  }, [tickets]);

  // Order teams the same way the backend returns them; hide "Advisor" and "Executive" since they don't take tickets.
  const orderedTeams = teams.filter(
    (t) => t.department !== "Advisor" && t.department !== "Executive"
  );

  return (
    <div className="flex h-full flex-col gap-3">
      <header className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-ink-500">Tickets</div>
          <div className="text-sm text-ink-600">
            One row per team. Each team works in parallel on its own tickets.
          </div>
        </div>
        <button className="btn" onClick={() => setCreateOpen(true)}>
          + New task
        </button>
      </header>

      {createOpen && (
        <CreateTaskModal projectId={projectId} onClose={() => setCreateOpen(false)} />
      )}

      <div className="flex-1 space-y-4 overflow-auto pr-1">
        {orderedTeams.map((team) => {
          const teamTickets = byDept[team.department] || [];
          const agentCount = team.agents.length;
          const empty = teamTickets.length === 0;
          return (
            <section
              key={team.department}
              className="rounded-lg border border-ink-200 bg-white"
            >
              <header className="flex items-center justify-between border-b border-ink-200 px-3 py-2">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">{team.department}</span>
                  <span className="text-[11px] text-ink-500">
                    {agentCount} agent{agentCount === 1 ? "" : "s"} ·{" "}
                    {teamTickets.length} ticket{teamTickets.length === 1 ? "" : "s"}
                  </span>
                  {team.active_step_count > 0 && (
                    <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                      {team.active_step_count} pipeline step
                      {team.active_step_count === 1 ? "" : "s"} active
                    </span>
                  )}
                </div>
                <div className="flex gap-1 text-[10px] text-ink-500">
                  {team.agents.map((a) => (
                    <span
                      key={a.id}
                      className="rounded-full bg-ink-100 px-1.5 py-0.5"
                      title={a.display_name}
                    >
                      {a.display_name}
                    </span>
                  ))}
                </div>
              </header>
              {empty ? (
                <div className="grid h-12 place-items-center text-xs text-ink-400">
                  No tickets yet for this team.
                </div>
              ) : (
                <div className="grid grid-cols-5 gap-2 p-2">
                  {STATUS_COLUMNS.map((col) => {
                    const inCol = teamTickets.filter((t) => t.status === col.id);
                    return (
                      <div
                        key={col.id}
                        className="flex min-h-[72px] flex-col gap-1.5 rounded-md bg-ink-50 p-1.5"
                      >
                        <div className="flex items-center justify-between px-1 text-[10px] font-medium uppercase tracking-wider text-ink-500">
                          <span>{col.title}</span>
                          <span className="rounded-full bg-white px-1.5">{inCol.length}</span>
                        </div>
                        {inCol.map((t) => (
                          <SwimCard
                            key={t.id}
                            ticket={t}
                            onClick={() => select(t.id)}
                          />
                        ))}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function SwimCard({ ticket, onClick }: { ticket: Ticket; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full rounded-md border border-ink-200 bg-white p-2 text-left transition hover:border-ink-300 hover:bg-ink-50"
    >
      <div className="line-clamp-2 text-xs font-medium leading-snug">{ticket.title}</div>
      <div className="mt-1.5 flex items-center justify-between gap-1">
        <span className="truncate text-[10px] text-ink-500">{ticket.assignee_display}</span>
        <PrettyLabel kind="priority" value={ticket.priority} />
      </div>
      {ticket.revision > 1 && (
        <div className="mt-0.5 text-[9px] text-rose-600">revision {ticket.revision}</div>
      )}
    </button>
  );
}
