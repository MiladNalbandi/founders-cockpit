import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { Tokens, User } from "@/api/types";

type AuthState = {
  user: User | null;
  tokens: Tokens | null;
  setSession: (user: User, tokens: Tokens) => void;
  setUser: (user: User) => void;
  logout: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      tokens: null,
      setSession: (user, tokens) => set({ user, tokens }),
      setUser: (user) => set({ user }),
      logout: () => set({ user: null, tokens: null }),
    }),
    { name: "cockpit.auth" }
  )
);
