import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  approveTicket,
  getArtifactContent,
  listArtifacts,
  listTicketEvents,
  rejectTicket,
} from "@/api/endpoints";
import type { Ticket } from "@/api/types";
import PrettyLabel from "@/components/PrettyLabel";
import { useTicketsStore } from "@/store/tickets";
import TicketFlow from "./TicketFlow";

export default function TicketDrawer({ projectId }: { projectId: number }) {
  const selectedId = useTicketsStore((s) => s.selectedId);
  const select = useTicketsStore((s) => s.select);
  const byId = useTicketsStore((s) => s.byId);
  const ticket = selectedId !== null ? byId[selectedId] : null;
  if (!ticket) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-40 flex w-[560px] flex-col border-l border-ink-200 bg-white shadow-xl">
      <header className="flex items-center justify-between border-b border-ink-200 px-4 py-3">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-widest text-ink-500">
            Ticket #{ticket.id} · {ticket.assignee_display}
          </div>
          <h2 className="truncate text-base font-semibold">{ticket.title}</h2>
        </div>
        <PrettyLabel kind="ticket-status" value={ticket.status} />
        <button onClick={() => select(null)} className="btn-ghost ml-2">
          ✕
        </button>
      </header>

      <Body projectId={projectId} ticket={ticket} />
    </div>
  );
}

function Body({ projectId, ticket }: { projectId: number; ticket: Ticket }) {
  const qc = useQueryClient();
  const select = useTicketsStore((s) => s.select);
  const [mode, setMode] = useState<"view" | "reject">("view");
  const [feedback, setFeedback] = useState("");

  const { data: events = [] } = useQuery({
    queryKey: ["ticket-events", ticket.id],
    queryFn: () => listTicketEvents(ticket.id),
  });

  const onAfter = () => {
    qc.invalidateQueries({ queryKey: ["tickets", projectId] });
    qc.invalidateQueries({ queryKey: ["ticket-events", ticket.id] });
    select(null);
  };

  const approve = useMutation({
    mutationFn: () => approveTicket(ticket.id),
    onSuccess: onAfter,
  });
  const reject = useMutation({
    mutationFn: () => rejectTicket(ticket.id, feedback),
    onSuccess: onAfter,
  });

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 space-y-4 overflow-auto p-4">
        {ticket.status === "in_progress" && <TicketFlow ticket={ticket} />}
        <section>
          <div className="text-xs font-medium uppercase tracking-wider text-ink-500">
            Description
          </div>
          <pre className="mt-1 whitespace-pre-wrap rounded-md bg-ink-50 p-3 text-sm">
            {ticket.description || "(no description)"}
          </pre>
        </section>

        {ticket.feedback && (
          <section className="rounded-md bg-rose-50 p-3 text-sm">
            <div className="text-xs font-medium uppercase tracking-wider text-rose-600">
              Founder feedback (this revision)
            </div>
            <div className="mt-1 whitespace-pre-wrap text-rose-900">{ticket.feedback}</div>
          </section>
        )}

        {ticket.artifact_path && (
          <ArtifactBlock projectId={projectId} artifactPath={ticket.artifact_path} />
        )}

        <section>
          <div className="text-xs font-medium uppercase tracking-wider text-ink-500">
            Timeline
          </div>
          <ol className="mt-2 space-y-1.5">
            {events.map((e) => (
              <li key={e.id} className="flex items-start gap-2 text-xs">
                <span className="rounded-full bg-ink-100 px-1.5 py-0.5 text-[10px] uppercase text-ink-600">
                  {e.kind}
                </span>
                <span className="flex-1 text-ink-700">{e.summary}</span>
                <span className="text-ink-400">
                  {new Date(e.created_at).toLocaleTimeString()}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {ticket.status === "in_review" && (
        <footer className="flex gap-2 border-t border-ink-200 p-4">
          {mode === "view" ? (
            <>
              <button
                className="btn flex-1"
                disabled={approve.isPending}
                onClick={() => approve.mutate()}
              >
                {approve.isPending ? "Approving…" : "Approve"}
              </button>
              <button
                className="btn-ghost border border-rose-200 text-rose-700"
                onClick={() => setMode("reject")}
              >
                Reject…
              </button>
            </>
          ) : (
            <>
              <textarea
                className="input min-h-[80px] flex-1"
                placeholder="What needs to change?"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
              />
              <div className="flex flex-col gap-2">
                <button
                  className="btn bg-rose-600 hover:bg-rose-700"
                  disabled={reject.isPending || !feedback.trim()}
                  onClick={() => reject.mutate()}
                >
                  {reject.isPending ? "…" : "Send"}
                </button>
                <button className="btn-ghost" onClick={() => setMode("view")}>
                  Cancel
                </button>
              </div>
            </>
          )}
        </footer>
      )}
    </div>
  );
}

function ArtifactBlock({ projectId, artifactPath }: { projectId: number; artifactPath: string }) {
  const { data: artifacts = [] } = useQuery({
    queryKey: ["artifacts", projectId],
    queryFn: () => listArtifacts(projectId),
  });
  const art = artifacts.find((a) => a.path === artifactPath);
  const { data: content = "" } = useQuery({
    queryKey: ["artifact-content", projectId, art?.id],
    queryFn: () => getArtifactContent(projectId, art!.id),
    enabled: !!art?.id,
  });
  if (!art) return null;
  return (
    <section>
      <div className="text-xs font-medium uppercase tracking-wider text-ink-500">
        Artifact <span className="font-mono normal-case text-ink-400">{artifactPath}</span>
      </div>
      {artifactPath.toLowerCase().endsWith(".html") ? (
        <iframe
          className="mt-1 h-[280px] w-full rounded-md border border-ink-200 bg-white"
          srcDoc={content}
          sandbox="allow-scripts"
          title={artifactPath}
        />
      ) : (
        <pre className="mt-1 max-h-[280px] overflow-auto rounded-md bg-ink-50 p-3 font-mono text-[11px] leading-relaxed">
          {content.slice(0, 4000)}
          {content.length > 4000 && "…"}
        </pre>
      )}
    </section>
  );
}
