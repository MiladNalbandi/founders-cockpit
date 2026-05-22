import { create } from "zustand";

import type { Agent, AgentEvent, AgentStatus } from "@/api/types";

type AgentsState = {
  byId: Record<number, Agent>;
  events: AgentEvent[];
  hydrate: (agents: Agent[]) => void;
  setEvents: (events: AgentEvent[]) => void;
  upsertStatus: (id: number, status: AgentStatus, current_task: string) => void;
  appendEvent: (ev: AgentEvent) => void;
  reset: () => void;
};

export const useAgentsStore = create<AgentsState>((set) => ({
  byId: {},
  events: [],
  hydrate: (agents) =>
    set({ byId: Object.fromEntries(agents.map((a) => [a.id, a])) }),
  setEvents: (events) => set({ events }),
  upsertStatus: (id, status, current_task) =>
    set((s) => ({
      byId: { ...s.byId, [id]: { ...s.byId[id], status, current_task } },
    })),
  appendEvent: (ev) =>
    set((s) => ({ events: [...s.events.slice(-400), ev] })),
  reset: () => set({ byId: {}, events: [] }),
}));
