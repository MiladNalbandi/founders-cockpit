import { FormEvent, useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";

import { sendBuddyMessage } from "@/api/endpoints";
import { useChatStore } from "@/store/chat";

export default function BuddyPanel({ projectId }: { projectId: number }) {
  const messages = useChatStore((s) => s.messages);
  const draft = useChatStore((s) => s.streamingDraft);
  const appendUser = useChatStore((s) => s.appendUser);

  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length, draft]);

  const send = useMutation({
    mutationFn: (content: string) => sendBuddyMessage(projectId, content),
    onSuccess: (_, content) => {
      appendUser({
        id: Math.random(),
        role: "user",
        content,
        created_at: new Date().toISOString(),
      });
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    send.mutate(t);
    setText("");
  }

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-ink-200 px-4 py-3">
        <div className="text-xs font-medium uppercase tracking-widest text-ink-500">
          Always-on
        </div>
        <h2 className="text-base font-semibold">Buddy</h2>
        <p className="mt-0.5 text-xs text-ink-500">
          Ask anything. Get a recommended next step.
        </p>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-auto px-4 py-3 space-y-3">
        {messages.length === 0 && !draft && (
          <div className="rounded-md bg-ink-50 p-3 text-sm text-ink-600">
            <p className="font-medium">👋 Hey founder.</p>
            <p className="mt-1">
              Tell me about your idea, ask which agent to run, or just brainstorm.
              I'll point you at the next concrete step.
            </p>
          </div>
        )}
        {messages.map((m) => (
          <Bubble key={m.id} role={m.role} content={m.content} />
        ))}
        {draft && <Bubble role="assistant" content={draft + "▍"} />}
      </div>

      <form onSubmit={submit} className="border-t border-ink-200 p-3">
        <textarea
          className="input min-h-[68px] resize-none"
          placeholder="Ask the Buddy…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(e as any);
          }}
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] text-ink-400">⌘ + Enter to send</span>
          <button className="btn" disabled={send.isPending || !text.trim()}>
            {send.isPending ? "…" : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Bubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  const mine = role === "user";
  return (
    <div className={mine ? "flex justify-end" : "flex"}>
      <div
        className={
          "max-w-[90%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm " +
          (mine ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-800")
        }
      >
        {content}
      </div>
    </div>
  );
}
