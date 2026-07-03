"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { LogIn, Loader2 } from "lucide-react";

const DEMO_ACCOUNTS = [
  { role: "Owner",       email: "owner@demo.fabsimple.io" },
  { role: "PM",          email: "pm@demo.fabsimple.io" },
  { role: "Estimator",   email: "estimator@demo.fabsimple.io" },
  { role: "Foreman",     email: "foreman@demo.fabsimple.io" },
  { role: "QC Inspector",email: "qc@demo.fabsimple.io" },
  { role: "Accounting",  email: "accounting@demo.fabsimple.io" },
  { role: "Worker",      email: "worker@demo.fabsimple.io" },
];

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}><Loader2 size={20} className="animate-spin" /></div>}>
      <SignInInner />
    </Suspense>
  );
}

function safeNext(raw: string | null): string {
  if (!raw) return "/dashboard";
  if (!raw.startsWith("/")) return "/dashboard";
  if (raw.startsWith("//")) return "/dashboard";
  return raw;
}

const SHOW_DEMO =
  process.env.NEXT_PUBLIC_FAB_SHOW_DEMO === "1" ||
  process.env.NEXT_PUBLIC_FAB_MODE === "demo";

function SignInInner() {
  const router = useRouter();
  const params = useSearchParams();
  const nextPath = safeNext(params.get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error: e2 } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (e2) { setError(e2.message); return; }
    router.push(nextPath);
    router.refresh();
  }

  function fillDemo(em: string) {
    setEmail(em);
    setPassword("demo123!");
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <div
        className="w-full grid gap-8"
        style={{
          maxWidth: SHOW_DEMO ? 896 : 440,
          gridTemplateColumns: SHOW_DEMO ? "1.1fr 1fr" : "1fr",
          padding: 24,
        }}
      >
        {/* Left — sign in form */}
        <div className="card">
          <div className="card-header">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "var(--primary)" }}>
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                  <path d="M1 1h6v6H1V1zm8 0h6v6H9V1zM1 9h6v6H1V9zm8 0h6v6H9V9z" fill="white" />
                </svg>
              </div>
              <div>
                <div className="card-title">FabSimple</div>
                <div className="card-sub">Steel fabrication management</div>
              </div>
            </div>
          </div>
          <div className="card-body">
            <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Sign in to your account</h2>
            <p className="text-[12px]" style={{ color: "var(--muted)", marginBottom: 20 }}>
              {SHOW_DEMO
                ? "Use one of the demo accounts on the right, or your own credentials."
                : "Welcome back to FabSimple."}
            </p>

            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] uppercase font-semibold tracking-wider" style={{ color: "var(--muted)" }}>Email</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                  placeholder="you@company.com"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[11px] uppercase font-semibold tracking-wider" style={{ color: "var(--muted)" }}>Password</span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input"
                  placeholder="••••••••"
                />
              </label>

              {error && (
                <div className="pill pill-red" style={{ padding: "8px 12px", fontSize: 12 }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} className="btn btn-primary" style={{ height: 40, justifyContent: "center" }}>
                {loading ? <Loader2 size={14} className="animate-spin" /> : <LogIn size={14} />}
                {loading ? "Signing in…" : "Sign in"}
              </button>

              <div className="flex justify-between text-[12px]" style={{ color: "var(--muted)" }}>
                <Link href="/auth/forgot" style={{ color: "var(--primary)" }}>Forgot password?</Link>
                <Link href="/auth/signup" style={{ color: "var(--primary)" }}>Create account</Link>
              </div>
            </form>
          </div>
        </div>

        {/* Right — demo accounts (hidden on production deployments) */}
        {SHOW_DEMO && (
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Demo accounts</div>
                <div className="card-sub">Password is <code style={{ background: "var(--bg-muted)", padding: "1px 5px", borderRadius: 3 }}>demo123!</code> for all roles</div>
              </div>
            </div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {DEMO_ACCOUNTS.map((a) => (
                <button
                  key={a.email}
                  type="button"
                  onClick={() => fillDemo(a.email)}
                  className="flex items-center justify-between p-3 rounded-md transition-colors"
                  style={{
                    background: "var(--bg-muted)",
                    border: "1px solid var(--border)",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div>
                    <div className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>{a.role}</div>
                    <div className="text-[11px] font-mono" style={{ color: "var(--muted)" }}>{a.email}</div>
                  </div>
                  <span className="pill" style={{ fontSize: 10 }}>fill →</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
