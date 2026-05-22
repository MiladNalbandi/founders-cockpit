import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import clsx from "clsx";

import { setPreferences, setSecrets } from "@/api/endpoints";
import type { ApprovalMode } from "@/api/types";
import { useAuthStore } from "@/store/auth";

const APPROVAL_MODES: { id: ApprovalMode; title: string; blurb: string }[] = [
  {
    id: "after_run",
    title: "After every agent run",
    blurb: "Pause for review whenever any agent finishes. Maximum control.",
  },
  {
    id: "milestone",
    title: "Milestones only",
    blurb:
      "Pause only after Product, Designer, Engineering, and Release. Faster.",
  },
  {
    id: "per_role",
    title: "Configure per role",
    blurb: "Override pause/auto on each role individually below.",
  },
  {
    id: "skip",
    title: "Fully autonomous",
    blurb: "Never pause. The team runs end-to-end. Highest velocity, no review.",
  },
];

const ROLES_FOR_OVERRIDE: { role: string; label: string }[] = [
  { role: "product", label: "Product Strategist" },
  { role: "designer", label: "UI/UX Designer" },
  { role: "engineer", label: "Engineering Lead" },
  { role: "frontend_eng", label: "Frontend Engineer" },
  { role: "backend_eng", label: "Backend Engineer" },
  { role: "qa_eng", label: "QA Engineer" },
  { role: "marketer", label: "Marketing Lead" },
  { role: "engagement", label: "Engagement Lead" },
  { role: "analyst", label: "Analytics Lead" },
  { role: "release", label: "Release / Ops Lead" },
];

export default function SettingsView() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [anthropicKey, setAnthropicKey] = useState("");
  const [githubPat, setGithubPat] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const nav = useNavigate();

  const [mode, setMode] = useState<ApprovalMode>(
    user?.default_approval_mode || "after_run"
  );
  const [perRole, setPerRole] = useState<Record<string, ApprovalMode>>(
    user?.per_role_approval || {}
  );
  const [prefSaving, setPrefSaving] = useState(false);
  const [prefSaved, setPrefSaved] = useState(false);

  async function submitSecrets(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      const updated = await setSecrets({
        anthropic_api_key: anthropicKey || undefined,
        github_pat: githubPat || undefined,
      });
      setUser(updated);
      setSaved(true);
      setAnthropicKey("");
      setGithubPat("");
    } finally {
      setSaving(false);
    }
  }

  async function submitPrefs(e: FormEvent) {
    e.preventDefault();
    setPrefSaving(true);
    setPrefSaved(false);
    try {
      const updated = await setPreferences({
        default_approval_mode: mode,
        per_role_approval: perRole,
      });
      setUser(updated);
      setPrefSaved(true);
    } finally {
      setPrefSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-ink-50 px-8 py-10">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Settings</h1>
          <Link to="/projects" className="btn-ghost">
            ← Projects
          </Link>
        </div>

        {/* ---- API keys ---- */}
        <div className="card p-6">
          <h2 className="text-lg font-medium">API keys</h2>
          <p className="mt-1 text-sm text-ink-500">
            Stored encrypted at rest. Agents use your key to talk to Claude.
          </p>

          <form onSubmit={submitSecrets} className="mt-4 space-y-3">
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-ink-500">
                Anthropic API key {user?.has_anthropic_key && "✓ set"}
              </label>
              <input
                className="input mt-1"
                placeholder="sk-ant-..."
                value={anthropicKey}
                onChange={(e) => setAnthropicKey(e.target.value)}
                type="password"
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-wider text-ink-500">
                GitHub PAT (optional) {user?.has_github_pat && "✓ set"}
              </label>
              <input
                className="input mt-1"
                placeholder="github_pat_..."
                value={githubPat}
                onChange={(e) => setGithubPat(e.target.value)}
                type="password"
              />
            </div>
            <div className="flex items-center gap-3">
              <button className="btn" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
              {saved && <span className="text-sm text-emerald-600">Saved</span>}
            </div>
          </form>
        </div>

        {/* ---- Approval modes ---- */}
        <div className="card p-6">
          <h2 className="text-lg font-medium">Approval modes</h2>
          <p className="mt-1 text-sm text-ink-500">
            How the cockpit pauses for your review when agents finish their work.
            Applies to every new pipeline you start.
          </p>

          <form onSubmit={submitPrefs} className="mt-4 space-y-4">
            <div className="grid gap-2">
              {APPROVAL_MODES.map((m) => (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={clsx(
                    "rounded-md border p-3 text-left transition",
                    mode === m.id
                      ? "border-accent bg-accent/10"
                      : "border-ink-200 hover:bg-ink-50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={clsx(
                        "h-3.5 w-3.5 rounded-full border-2",
                        mode === m.id ? "border-accent bg-accent" : "border-ink-300"
                      )}
                    />
                    <span className="text-sm font-medium">{m.title}</span>
                  </div>
                  <p className="mt-1 pl-5 text-xs text-ink-500">{m.blurb}</p>
                </button>
              ))}
            </div>

            {mode === "per_role" && (
              <div className="rounded-md border border-ink-200 p-3">
                <div className="text-xs font-medium uppercase tracking-wider text-ink-500">
                  Per-role overrides
                </div>
                <p className="mt-1 text-xs text-ink-500">
                  Pick which roles pause for review and which auto-advance.
                  Roles not listed inherit "after every run."
                </p>
                <ul className="mt-3 space-y-1.5">
                  {ROLES_FOR_OVERRIDE.map((r) => {
                    const current = perRole[r.role] || "after_run";
                    return (
                      <li
                        key={r.role}
                        className="flex items-center justify-between gap-3"
                      >
                        <span className="text-sm">{r.label}</span>
                        <select
                          className="rounded-md border border-ink-200 bg-white px-2 py-1 text-xs"
                          value={current}
                          onChange={(e) =>
                            setPerRole((prev) => ({
                              ...prev,
                              [r.role]: e.target.value as ApprovalMode,
                            }))
                          }
                        >
                          <option value="after_run">Pause for review</option>
                          <option value="skip">Auto-approve</option>
                        </select>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <div className="flex items-center gap-3">
              <button className="btn" disabled={prefSaving}>
                {prefSaving ? "Saving…" : "Save preferences"}
              </button>
              {prefSaved && (
                <span className="text-sm text-emerald-600">Saved</span>
              )}
              <button
                type="button"
                className="btn-ghost ml-auto"
                onClick={() => nav("/projects")}
              >
                Continue
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
