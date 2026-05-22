/**
 * QuickActionModal — single-textarea modal pre-targeted to one role.
 * Used by QuickActionRow chips; routes directly to one agent without running
 * the full pipeline.
 */
import { FormEvent, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createTicket } from "@/api/endpoints";

export type QuickAction = {
  id: string;
  label: string;
  icon: string;
  role: string;
  description: string;
  placeholder: string;
  priority: "low" | "medium" | "high" | "urgent";
};

export default function QuickActionModal({
  projectId,
  action,
  onClose,
}: {
  projectId: number;
  action: QuickAction;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [text, setText] = useState("");

  const send = useMutation({
    mutationFn: () =>
      createTicket(projectId, {
        title: text.split("\n")[0].slice(0, 200) || action.label,
        description: text,
        assignee_role: action.role,
        priority: action.priority,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tickets", projectId] });
      onClose();
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    send.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
      <form
        onSubmit={submit}
        className="w-[520px] rounded-lg bg-white p-6 shadow-xl"
      >
        <div className="flex items-center gap-2">
          <span className="text-2xl">{action.icon}</span>
          <div>
            <h3 className="text-lg font-semibold">{action.label}</h3>
            <p className="text-xs text-ink-500">{action.description}</p>
          </div>
        </div>
        <textarea
          className="input mt-4 min-h-[140px]"
          placeholder={action.placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />
        <div className="mt-4 flex items-center justify-between">
          <span className="text-[11px] text-ink-500">
            Goes straight to the agent — no pipeline, no waiting.
          </span>
          <div className="flex gap-2">
            <button type="button" className="btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="btn" disabled={send.isPending || !text.trim()}>
              {send.isPending ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
        {send.isError && (
          <div className="mt-2 text-xs text-red-600">
            {(send.error as any)?.response?.data?.detail || "Failed"}
          </div>
        )}
      </form>
    </div>
  );
}
