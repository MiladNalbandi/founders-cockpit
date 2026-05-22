import { create } from "zustand";

import type { Ticket, TicketStatus } from "@/api/types";

type TicketsState = {
  byId: Record<number, Ticket>;
  selectedId: number | null;
  hydrate: (tickets: Ticket[]) => void;
  upsert: (patch: Partial<Ticket> & { id: number }) => void;
  select: (id: number | null) => void;
  clear: () => void;
};

export const useTicketsStore = create<TicketsState>((set) => ({
  byId: {},
  selectedId: null,
  hydrate: (tickets) =>
    set({ byId: Object.fromEntries(tickets.map((t) => [t.id, t])) }),
  upsert: (patch) =>
    set((s) => ({
      byId: {
        ...s.byId,
        [patch.id]: { ...(s.byId[patch.id] || {}), ...patch } as Ticket,
      },
    })),
  select: (id) => set({ selectedId: id }),
  clear: () => set({ byId: {}, selectedId: null }),
}));

export const STATUS_TONE: Record<TicketStatus, string> = {
  created: "bg-ink-100 text-ink-600",
  triaged: "bg-sky-100 text-sky-700",
  in_progress: "bg-amber-100 text-amber-700",
  in_review: "bg-violet-100 text-violet-800",
  done: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
};

export const STATUS_COLUMNS: { id: TicketStatus; title: string }[] = [
  { id: "created", title: "Created" },
  { id: "triaged", title: "Triaged" },
  { id: "in_progress", title: "In progress" },
  { id: "in_review", title: "Needs review" },
  { id: "done", title: "Done" },
];
