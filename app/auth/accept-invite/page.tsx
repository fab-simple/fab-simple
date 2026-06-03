"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CheckCircle2, KeyRound, Loader2, UserPlus } from "lucide-react";

/**
 * Lands here from the invite email at /auth/accept-invite?token=<uuid>.
 * Collects the email (read-only, comes from the invite), full name,
 * and a new password — then calls /api/accept-invite which creates the
 * Supabase auth user + public.users row with the assigned role in the
 * inviting company. After success we sign in and bounce to /dashboard.
 *
 * Without this page every invite was a 404.
 */
export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<Centered><Loader2 size={20} className="animate-spin" /></Centered>}>
      <Inner />
    </Suspense>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      {children}
    </div>
  );
}

function Inner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const inviteEmail = params.get("email") ?? "";

  const [email, setEmail] = useState(inviteEmail);
  const [fullName, setFullName] = useState("");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!token) {
    return (
      <Centered>
        <div className="card" style={{ width: 420 }}>
          <div className="card-header"><div className="card-title">Invitation link is missing</div></div>
          <div className="card-body">
            <div className="pill pill-red" style={{ padding: 10, fontSize: 12, marginBottom: 12 }}>
              The link you used doesn&apos;t include an invitation token. Ask whoever invited you to resend it.
            </div>
            <Link href="/auth/signin" className="btn" style={{ height: 36 }}>Back to sign in</Link>
          </div>
        </div>
      </Centered>
    );
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pw1.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (pw1 !== pw2)    { setError("Passwords don't match"); return; }

    setLoading(true);
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "/api";
      const resp = await fetch(`${apiBase}/accept-invite`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, email, password: pw1, full_name: fullName || null }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.ok) {
        setError(data?.error?.message ?? "Could not accept invite. Try again or ask for a new link.");
        setLoading(false);
        return;
      }

      // Sign the new user in immediately so they don't have to bounce through
      // /auth/signin.
      const supabase = createClient();
      const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password: pw1 });
      if (signInErr) {
        setError(signInErr.message);
        setLoading(false);
        return;
      }
      setDone(true);
      setTimeout(() => { router.replace("/dashboard"); router.refresh(); }, 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unexpected error");
      setLoading(false);
    }
  }

  return (
    <Centered>
      <div className="card" style={{ width: 440 }}>
        <div className="card-header">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "var(--primary)" }}>
              <UserPlus size={16} color="white" />
            </div>
            <div>
              <div className="card-title">Join your team on FabSimple</div>
              <div className="card-sub">Set your password to finish the invite.</div>
            </div>
          </div>
        </div>
        <div className="card-body">
          {done ? (
            <div className="flex items-center gap-3 pill pill-done" style={{ padding: "12px 14px", fontSize: 13 }}>
              <CheckCircle2 size={16} /> Welcome! Redirecting to your dashboard…
            </div>
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] uppercase font-semibold tracking-wider" style={{ color: "var(--muted)" }}>Email</span>
                <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} readOnly={!!inviteEmail} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] uppercase font-semibold tracking-wider" style={{ color: "var(--muted)" }}>Full name</span>
                <input className="input" type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Welder" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] uppercase font-semibold tracking-wider" style={{ color: "var(--muted)" }}>New password</span>
                <input className="input" type="password" required minLength={8} autoComplete="new-password" value={pw1} onChange={(e) => setPw1(e.target.value)} placeholder="••••••••" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] uppercase font-semibold tracking-wider" style={{ color: "var(--muted)" }}>Confirm password</span>
                <input className="input" type="password" required minLength={8} autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="••••••••" />
              </label>
              {error && <div className="pill pill-red" style={{ padding: "8px 12px", fontSize: 12 }}>{error}</div>}
              <button type="submit" disabled={loading} className="btn btn-primary" style={{ height: 40, justifyContent: "center" }}>
                {loading ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                {loading ? "Joining…" : "Join FabSimple"}
              </button>
              <div className="text-center text-[12px]" style={{ color: "var(--muted)" }}>
                Already signed up? <Link href="/auth/signin" style={{ color: "var(--primary)" }}>Sign in</Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </Centered>
  );
}
