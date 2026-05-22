import { create } from "zustand";

export type Toast = {
  id: number;
  title: string;
  body?: string;
  tone?: "info" | "success" | "warning" | "review";
  action?: { label: string; onClick: () => void };
};

type ToastState = {
  list: Toast[];
  push: (t: Omit<Toast, "id">) => number;
  dismiss: (id: number) => void;
  clear: () => void;
};

let nextId = 1;
const MAX_VISIBLE = 3;
const AUTO_DISMISS_MS = 8000;

export const useToastStore = create<ToastState>((set, get) => ({
  list: [],
  push: (t) => {
    const id = nextId++;
    const toast: Toast = { id, tone: "info", ...t };
    set((s) => ({ list: [...s.list, toast].slice(-MAX_VISIBLE) }));
    setTimeout(() => get().dismiss(id), AUTO_DISMISS_MS);
    return id;
  },
  dismiss: (id) =>
    set((s) => ({ list: s.list.filter((t) => t.id !== id) })),
  clear: () => set({ list: [] }),
}));
