import { create } from "zustand";

import type { ChatMessage } from "@/api/types";

type ChatState = {
  threadId: number | null;
  messages: ChatMessage[];
  streamingDraft: string;
  setThread: (id: number, messages: ChatMessage[]) => void;
  appendUser: (msg: ChatMessage) => void;
  appendDelta: (delta: string) => void;
  commitDraftAsAssistant: (id: number) => void;
  reset: () => void;
};

export const useChatStore = create<ChatState>((set) => ({
  threadId: null,
  messages: [],
  streamingDraft: "",
  setThread: (threadId, messages) => set({ threadId, messages, streamingDraft: "" }),
  appendUser: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
  appendDelta: (delta) => set((s) => ({ streamingDraft: s.streamingDraft + delta })),
  commitDraftAsAssistant: (id) =>
    set((s) => ({
      messages: [
        ...s.messages,
        {
          id,
          role: "assistant",
          content: s.streamingDraft,
          created_at: new Date().toISOString(),
        },
      ],
      streamingDraft: "",
    })),
  reset: () => set({ threadId: null, messages: [], streamingDraft: "" }),
}));
