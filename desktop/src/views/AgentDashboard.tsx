/**
 * Per-agent dashboard — currently working, queue, history, live events.
 * Route: /cockpit/:projectId/agent/:role
 */
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { agentDashboard, approveTicket, rejectTicket } from "@/api/endpoints";
import type { AgentDashboardData } from "@/api/endpoints";
import PrettyLabel from "@/components/PrettyLabel";
import { useAuthStore } from "@/store/auth";

const STATUS_DOT: Record<string, string> = {
  idle: "bg-ink-400",
  thinking: "bg-amber-500 animate-pulse",
  working: "bg-emerald-500 animate-pulse",
  blocked: "bg-violet-400",
  done: "bg-emerald-400",
  error: "bg-red-500",
};

export default function AgentDashboardView() {
  const { projectId: pid, role } = useParams();
  const projectId = Number(pid);
  const tokens = useAuthStore((s) => s.tokens);
  const nav = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["agent-dashboard", projectId, role],
    queryFn: () => agentDashboard(projectId, role!),
    enabled: !!projectId && !!role && !!tokens,
    refetchInterval: 3_000,
  });

  if (!tokens) {
    nav("/login");
    return null;
  }
  if (isLoading || !data) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink-50">
        <div className="text-sm text-ink-500">Loading agent dashboard…</div>
      </div>
    );
  }
  const a = data.agent;

  return (
    <div className="min-h-screen bg-ink-50 px-8 py-6">
      <div className="mx-auto max-w-4xl space-y-5">
        <header className="flex items-center justify-between">
          <Link
            to={`/cockpit/${projectId}`}
            className="text-sm text-ink-500 hover:text-ink-900"
          >
            ← Back to cockpit
          </Link>
          <div className="text-right">
            <div className="text-xs uppercase tracking-widest text-ink-500">
              {a.department}
            </div>
            <h1 className="text-2xl font-semibold">{a.display_name}</h1>
          </div>
        </header>

        <section className="card flex items-center gap-3 p-5">
          <span className={`inline-block h-3 w-3 rounded-full ${STATUS_DOT[a.status]}`} />
          <div className="flex-1">
            <div className="text-sm font-medium capitalize">{a.status.replace("_", " ")}</div>
            <div className="text-xs text-ink-500">
              {a.current_task || "Idle — waiting for the next task."}
            </div>
          </div>
          {data.active_step && (
            <div className="text-right text-xs text-ink-500">
              Pipeline step in Run #{data.active_step.run_id}
              <br />
              <PrettyLabel kind="step-status" value={data.active_step.status as any} />
            </div>
          )}
        </section>

        {data.active_ticket && (
          <section className="card p-5">
            <div className="text-xs font-medium uppercase tracking-wider text-ink-500">
              Currently working on
            </div>
            <div className="mt-1 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{data.active_ticket.title}</div>
                <p className="mt-1 line-clamp-2 text-sm text-ink-500">
                  {data.active_ticket.description}
                </p>
              </div>
              <PrettyLabel
                kind="ticket-status"
                value={data.active_ticket.status as any}
              />
            </div>
            {data.active_ticket.artifact_path && (
              <div className="mt-2 font-mono text-[11px] text-ink-500">
                {data.active_ticket.artifact_path}
              </div>
            )}
          </section>
        )}

        <section className="card p-5">
          <h2 className="text-sm font-semibold">Queue ({data.queue.length})</h2>
          {data.queue.length === 0 ? (
            <div className="mt-2 text-sm text-ink-500">Nothing queued.</div>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {data.queue.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center gap-3 rounded-md border border-ink-200 px-3 py-2"
                >
                  <span className="line-clamp-1 flex-1 text-sm">{t.title}</span>
                  <PrettyLabel kind="priority" value={t.priority} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <h2 className="text-sm font-semibold">
            Recently completed ({data.completed.length})
          </h2>
          {data.completed.length === 0 ? (
            <div className="mt-2 text-sm text-ink-500">No completed tickets yet.</div>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {data.completed.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center gap-3 rounded-md border border-ink-200 px-3 py-2"
                >
                  <span className="line-clamp-1 flex-1 text-sm">{t.title}</span>
                  <PrettyLabel kind="ticket-status" value={t.status as any} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {data.recent_steps.length > 0 && (
          <section className="card p-5">
            <h2 className="text-sm font-semibold">Recent pipeline steps</h2>
            <ul className="mt-3 space-y-1.5">
              {data.recent_steps.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center gap-3 rounded-md border border-ink-200 px-3 py-2 text-sm"
                >
                  <span className="font-mono text-xs text-ink-500">
                    Run #{s.run_id}
                  </span>
                  <span className="flex-1 truncate text-ink-700">
                    {s.artifact_path || "(no artifact)"}
                  </span>
                  <PrettyLabel kind="step-status" value={s.status as any} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="card p-5">
          <h2 className="text-sm font-semibold">
            Live activity ({data.recent_events.length})
          </h2>
          {data.recent_events.length === 0 ? (
            <div className="mt-2 text-sm text-ink-500">No activity yet.</div>
          ) : (
            <ul className="mt-3 max-h-[320px] space-y-1 overflow-auto font-mono text-xs">
              {data.recent_events.map((e) => (
                <li key={e.id} className="flex items-start gap-2">
                  <span className="text-ink-400">
                    {new Date(e.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                  <span className="rounded-full bg-ink-100 px-1.5 text-[10px] uppercase text-ink-600">
                    {e.kind}
                  </span>
                  <span className="flex-1 text-ink-700">{e.summary}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
