"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Loader2, KeyRound } from "lucide-react";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    setLoading(false);
    if (error) setError(error.message);
    else setDone(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <div className="card" style={{ width: 400 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Reset your password</div>
            <div className="card-sub">We&apos;ll email you a magic link to set a new password.</div>
          </div>
        </div>
        <div className="card-body">
          {done ? (
            <div className="pill pill-done" style={{ padding: "10px 12px", fontSize: 12 }}>
              Check your inbox at <strong>{email}</strong> for the reset link.
            </div>
          ) : (
            <form onSubmit={onSubmit} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] uppercase font-semibold tracking-wider" style={{ color: "var(--muted)" }}>Email</span>
                <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
              {error && <div className="pill pill-red" style={{ padding: "8px 12px", fontSize: 12 }}>{error}</div>}
              <button type="submit" disabled={loading} className="btn btn-primary" style={{ height: 40, justifyContent: "center" }}>
                {loading ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />}
                {loading ? "Sending…" : "Send reset link"}
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
