import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { register } from "@/api/endpoints";
import { useAuthStore } from "@/store/auth";

export default function RegisterView() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
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
      const { user, tokens } = await register(email, password, fullName);
      setSession(user, tokens);
      nav("/settings");
    } catch (e: any) {
      const data = e?.response?.data;
      setErr(
        typeof data === "string"
          ? data
          : data?.email?.[0] || data?.password?.[0] || "Registration failed"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-ink-50">
      <div className="w-[400px] card p-7">
        <h1 className="text-2xl font-semibold text-ink-900">Create your cockpit</h1>
        <p className="mt-1 text-sm text-ink-500">One account, every agent.</p>
        <form onSubmit={submit} className="mt-5 space-y-3">
          <input
            className="input"
            placeholder="full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          <input
            className="input"
            placeholder="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
          />
          <input
            className="input"
            placeholder="password (min 6 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
          />
          {err && <div className="text-sm text-red-600">{err}</div>}
          <button className="btn w-full" disabled={loading}>
            {loading ? "Creating…" : "Create account"}
          </button>
        </form>
        <div className="mt-4 text-center text-sm text-ink-500">
          Have an account?{" "}
          <Link to="/login" className="text-accent hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
