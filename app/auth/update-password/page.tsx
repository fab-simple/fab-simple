"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { KeyRound, Loader2, CheckCircle2 } from "lucide-react";

/**
 * Lands a user here after they click the password-reset email and
 * /auth/callback exchanges the recovery code for a temporary session.
 * This page is the actual "set a new password" form — without it the
 * reset flow signed users in but never let them change anything.
 */
export default function UpdatePasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  // The recovery code-for-session exchange happens in /auth/callback. If the
  // user reaches this page without a valid session, surface that explicitly
  // instead of silently failing.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
    });
  }, [supabase]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pw1.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (pw1 !== pw2)    { setError("Passwords don't match"); return; }
    setLoading(true);

    const { error: e2 } = await supabase.auth.updateUser({ password: pw1 });
    setLoading(false);
    if (e2) { setError(e2.message); return; }

    setDone(true);
    // Bounce to /dashboard after a beat so they see the success state.
    setTimeout(() => { router.replace("/dashboard"); router.refresh(); }, 1500);
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <div className="card" style={{ width: 420 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Set a new password</div>
            <div className="card-sub">Choose something at least 8 characters long.</div>
          </div>
        </div>
        <div className="card-body">
          {hasSession === false ? (
            <>
              <div className="pill pill-red" style={{ padding: "10px 12px", fontSize: 12, marginBottom: 12 }}>
                This reset link is invalid or has expired. Request a new one to continue.
              </div>
              <Link href="/auth/forgot" className="btn btn-primary" style={{ height: 38, justifyContent: "center" }}>
                Request a new link
              </Link>
            </>
          ) : done ? (
            <div className="flex items-center gap-3 pill pill-done" style={{ padding: "12px 14px", fontSize: 13 }}>
              <CheckCircle2 size={16} /> Password updated. Redirecting…
            </div>
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] uppercase font-semibold tracking-wider" style={{ color: "var(--muted)" }}>New password</span>
                <input
                  className="input" type="password" required minLength={8} autoComplete="new-password"
                  value={pw1} onChange={(e) => setPw1(e.target.value)} placeholder="••••••••"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] uppercase font-semibold tracking-wider" style={{ color: "var(--muted)" }}>Confirm password</span>
                <input
                  className="input" type="password" required minLength={8} autoComplete="new-password"
                  value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="••••••••"
                />
              </label>
              {error && <div className="pill pill-red" style={{ padding: "8px 12px", fontSize: 12 }}>{error}</div>}
              <button type="submit" disabled={loading || hasSession === null} className="btn btn-primary" style={{ height: 40, justifyContent: "center" }}>
                {loading ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                {loading ? "Saving…" : "Update password"}
              </button>
              <div className="text-center text-[12px]" style={{ color: "var(--muted)" }}>
                <Link href="/auth/signin" style={{ color: "var(--primary)" }}>Back to sign in</Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
