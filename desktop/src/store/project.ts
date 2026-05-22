import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { Project } from "@/api/types";

type ProjectState = {
  current: Project | null;
  setCurrent: (p: Project | null) => void;
};

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      current: null,
      setCurrent: (current) => set({ current }),
    }),
    { name: "cockpit.project" }
  )
);
