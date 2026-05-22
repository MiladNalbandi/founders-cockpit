import { useEffect, useRef } from "react";
import clsx from "clsx";

import type { AgentEvent } from "@/api/types";
import { useAgentsStore } from "@/store/agents";

const KIND_COLOR: Record<AgentEvent["kind"], string> = {
  status: "bg-ink-100 text-ink-700",
  thought: "bg-accent/10 text-accent",
  tool_call: "bg-amber-100 text-amber-700",
  tool_result: "bg-emerald-100 text-emerald-700",
  artifact: "bg-violet-100 text-violet-700",
  error: "bg-red-100 text-red-700",
};

const KIND_LABEL: Record<AgentEvent["kind"], string> = {
  status: "status",
  thought: "thought",
  tool_call: "tool",
  tool_result: "result",
  artifact: "artifact",
  error: "error",
};

export default function ActivityFeed() {
  const events = useAgentsStore((s) => s.events);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight });
  }, [events.length]);

  return (
    <div className="card h-full">
      <div className="border-b border-ink-200 p-4">
        <h2 className="text-sm font-semibold">Live activity</h2>
        <p className="text-xs text-ink-500">
          Everything every agent does, in real time.
        </p>
      </div>
      <div ref={ref} className="h-[600px] overflow-auto p-3 font-mono text-xs">
        {events.length === 0 ? (
          <div className="grid h-full place-items-center text-ink-400">
            Idle. Run an agent to fill this feed.
          </div>
        ) : (
          <ul className="space-y-2">
            {events.map((ev) => (
              <li key={ev.id} className="flex items-start gap-2">
                <span
                  className={clsx(
                    "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider",
                    KIND_COLOR[ev.kind]
                  )}
                >
                  {KIND_LABEL[ev.kind]}
                </span>
                <span className="rounded bg-ink-100 px-1.5 text-[10px] text-ink-600">
                  {ev.role}
                </span>
                <span className="text-ink-700">{ev.summary}</span>
                <span className="ml-auto shrink-0 text-ink-400">
                  {new Date(ev.created_at).toLocaleTimeString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
