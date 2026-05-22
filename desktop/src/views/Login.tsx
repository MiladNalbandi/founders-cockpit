import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { login } from "@/api/endpoints";
import { useAuthStore } from "@/store/auth";

export default function LoginView() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const setSession = useAuthStore((s) => s.setSession);
  const nav = useNavigate();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const { user, tokens } = await login(email, password);
      setSession(user, tokens);
      nav("/projects");
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-ink-50">
      <div className="w-[380px] card p-7">
        <div className="mb-5">
          <div className="text-xs font-medium uppercase tracking-widest text-ink-500">
            Founder's Cockpit
          </div>
          <h1 className="mt-1 text-2xl font-semibold text-ink-900">Sign in</h1>
          <p className="mt-1 text-sm text-ink-500">
            Run a startup with a full team of AI agents.
          </p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input
            className="input"
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoFocus
          />
          <input
            className="input"
            placeholder="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
          />
          {err && <div className="text-sm text-red-600">{err}</div>}
          <button className="btn w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <div className="mt-4 text-center text-sm text-ink-500">
          New here?{" "}
          <Link to="/register" className="text-accent hover:underline">
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
}
