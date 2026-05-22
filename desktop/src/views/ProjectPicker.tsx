import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";

import { createProject, projectsDashboard, type DashboardRow } from "@/api/endpoints";
import { useAuthStore } from "@/store/auth";
import { useProjectStore } from "@/store/project";

const PLATFORM_OPTS = ["web", "ios", "android"];

const RUN_TONE: Record<string, string> = {
  running: "bg-amber-500",
  awaiting_approval: "bg-violet-500",
  done: "bg-emerald-500",
  failed: "bg-red-500",
  cancelled: "bg-ink-400",
  pending: "bg-ink-300",
};

const RUN_TEXT: Record<string, string> = {
  running: "Running",
  awaiting_approval: "Waiting on you",
  done: "Finished",
  failed: "Failed",
  cancelled: "Cancelled",
  pending: "Getting ready",
};

export default function ProjectPickerView() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const setCurrent = useProjectStore((s) => s.setCurrent);
  const nav = useNavigate();
  const qc = useQueryClient();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["projects-dashboard"],
    queryFn: projectsDashboard,
    refetchInterval: 5_000,
  });

  const [name, setName] = useState("");
  const [idea, setIdea] = useState("");
  const [platforms, setPlatforms] = useState<string[]>(["web"]);
  const [creating, setCreating] = useState(false);

  const create = useMutation({
    mutationFn: () => createProject({ name, idea, target_platforms: platforms }),
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ["projects-dashboard"] });
      setCurrent(p);
      nav(`/cockpit/${p.id}`);
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    create.mutate();
  }

  function togglePlatform(p: string) {
    setPlatforms((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  }

  return (
    <div className="min-h-screen bg-ink-50 px-8 py-10">
      <header className="mx-auto flex max-w-6xl items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-ink-500">
            Founder's Cockpit
          </div>
          <h1 className="text-2xl font-semibold">Your startups</h1>
          <p className="mt-1 text-sm text-ink-500">
            One card per idea. Click to open the cockpit.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-ink-500">{user?.email}</span>
          <Link to="/settings" className="btn-ghost">
            Settings
          </Link>
          <button className="btn-ghost" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>

      <div className="mx-auto mt-6 grid max-w-6xl grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading && (
          <div className="col-span-full text-sm text-ink-500">Loading projects…</div>
        )}
        {rows.map((row) => (
          <ProjectCard
            key={row.project.id}
            row={row}
            onOpen={() => {
              setCurrent(row.project);
              nav(`/cockpit/${row.project.id}`);
            }}
          />
        ))}
        <button
          onClick={() => setCreating(true)}
          className="rounded-lg border-2 border-dashed border-ink-300 bg-white p-6 text-left transition hover:border-accent hover:bg-accent/5"
        >
          <div className="text-3xl text-ink-400">+</div>
          <div className="mt-2 font-medium">Start a new startup</div>
          <div className="mt-1 text-sm text-ink-500">
            Describe an idea in a paragraph. The team starts right away.
          </div>
        </button>
      </div>

      {creating && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40">
          <form onSubmit={submit} className="w-[520px] rounded-lg bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold">New startup</h3>
            <p className="mt-1 text-sm text-ink-500">
              The Buddy will start as soon as you save.
            </p>
            <div className="mt-4 space-y-3">
              <input
                className="input"
                placeholder="Project name — e.g. one-pan recipes"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
              <textarea
                className="input min-h-[110px]"
                placeholder="The pitch in one paragraph. What problem? Who for? Why now?"
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
              />
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-ink-500">
                  Target platforms
                </div>
                <div className="mt-2 flex gap-2">
                  {PLATFORM_OPTS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => togglePlatform(p)}
                      className={clsx(
                        "rounded-full border px-3 py-1 text-xs font-medium transition",
                        platforms.includes(p)
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
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setCreating(false)}
              >
                Cancel
              </button>
              <button className="btn" disabled={create.isPending || !name.trim()}>
                {create.isPending ? "Creating…" : "Create"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function ProjectCard({ row, onOpen }: { row: DashboardRow; onOpen: () => void }) {
  const { project, latest_run, tickets } = row;
  const runStatus = latest_run?.status || "pending";
  return (
    <button
      onClick={onOpen}
      className="flex flex-col rounded-lg border border-ink-200 bg-white p-5 text-left transition hover:border-ink-300 hover:shadow-md"
    >
      <div className="flex items-start gap-2">
        <span
          className={clsx(
            "mt-1.5 h-2.5 w-2.5 flex-shrink-0 rounded-full",
            RUN_TONE[runStatus] || "bg-ink-300"
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{project.name}</div>
          <div className="mt-0.5 line-clamp-2 text-xs text-ink-500">
            {project.idea || "(no idea yet)"}
          </div>
        </div>
      </div>

      {latest_run ? (
        <div className="mt-4 rounded-md border border-ink-200 bg-ink-50 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-medium text-ink-800">
              Pipeline Run #{latest_run.id}
            </span>
            <span className="text-ink-500">{RUN_TEXT[runStatus]}</span>
          </div>
          {latest_run.awaiting_steps > 0 && (
            <div className="mt-1 font-medium text-violet-700">
              ⚠ {latest_run.awaiting_steps} step
              {latest_run.awaiting_steps > 1 ? "s" : ""} need your review
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 rounded-md border border-dashed border-ink-200 bg-ink-50 p-3 text-xs text-ink-500">
          No pipeline yet. Open to start one.
        </div>
      )}

      <div className="mt-3 flex items-center justify-between text-xs text-ink-500">
        <span>
          {tickets.in_review > 0 ? (
            <span className="font-medium text-violet-700">
              {tickets.in_review} ticket{tickets.in_review > 1 ? "s" : ""} in review
            </span>
          ) : (
            `${tickets.total} ticket${tickets.total === 1 ? "" : "s"}`
          )}
        </span>
        <span>· {project.target_platforms.join(" · ") || "any"}</span>
      </div>
    </button>
  );
}
