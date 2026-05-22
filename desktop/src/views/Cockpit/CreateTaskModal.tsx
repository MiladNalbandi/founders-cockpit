import { FormEvent, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";

import { createTicket } from "@/api/endpoints";
import type { TicketPriority } from "@/api/types";
import { useAgentsStore } from "@/store/agents";

const PRIORITIES: TicketPriority[] = ["low", "medium", "high", "urgent"];

export default function CreateTaskModal({
  projectId,
  onClose,
}: {
  projectId: number;
  onClose: () => void;
}) {
  const agentsById = useAgentsStore((s) => s.byId);
  const assignableRoles = Object.values(agentsById)
    .filter((a) => a.role !== "ceo" && a.role !== "buddy")
    .sort((a, b) => a.id - b.id);

  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState<string>(
    assignableRoles.find((a) => a.role === "engineer")?.role || assignableRoles[0]?.role || ""
  );
  const [priority, setPriority] = useState<TicketPriority>("medium");

  const send = useMutation({
    mutationFn: () =>
      createTicket(projectId, {
        title,
        description,
        assignee_role: assignee,
        priority,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tickets", projectId] });
      onClose();
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !assignee) return;
    send.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
      <form
        onSubmit={submit}
        className="w-[560px] max-h-[90vh] overflow-auto rounded-lg bg-white p-6 shadow-xl"
      >
        <h3 className="text-lg font-semibold">Create a task</h3>
        <p className="mt-1 text-sm text-ink-500">
          Write a task and pick which agent should pick it up. They'll start right away.
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-ink-500">
              Title
            </label>
            <input
              className="input mt-1"
              placeholder="e.g. Add dark mode to landing page"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-ink-500">
              Description
            </label>
            <textarea
              className="input mt-1 min-h-[120px]"
              placeholder="What do you want the agent to do? Be specific. Cite files, screens, or sections."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-ink-500">
              Assign to
            </label>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {assignableRoles.map((a) => (
                <button
                  type="button"
                  key={a.id}
                  onClick={() => setAssignee(a.role)}
                  className={clsx(
                    "rounded-md border px-2.5 py-1.5 text-left text-xs transition",
                    assignee === a.role
                      ? "border-accent bg-accent/10"
                      : "border-ink-200 hover:bg-ink-50"
                  )}
                >
                  <div className="font-medium">{a.display_name}</div>
                  <div className="text-[10px] text-ink-500">{a.department}</div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wider text-ink-500">
              Priority
            </label>
            <div className="mt-2 flex gap-2">
              {PRIORITIES.map((p) => (
                <button
                  type="button"
                  key={p}
                  onClick={() => setPriority(p)}
                  className={clsx(
                    "rounded-full border px-3 py-1 text-xs font-medium capitalize transition",
                    priority === p
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-ink-200 text-ink-600 hover:bg-ink-100"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn"
            disabled={send.isPending || !title.trim() || !assignee}
          >
            {send.isPending ? "Creating…" : "Create task"}
          </button>
        </div>
        {send.isError && (
          <div className="mt-2 text-xs text-red-600">
            {(send.error as any)?.response?.data?.detail || "Failed to create"}
          </div>
        )}
      </form>
    </div>
  );
}
