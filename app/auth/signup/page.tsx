"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2, UserPlus } from "lucide-react";

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setLoading(true);
    const supabase = createClient();
    const { data, error: authErr } = await supabase.auth.signUp({
      email, password,
      options: {
        data: { full_name: fullName, company_name: companyName, requested_role: "owner" },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (authErr) { setError(authErr.message); setLoading(false); return; }
    if (!data.user) { setError("Signup did not return a user"); setLoading(false); return; }

    // Bootstrap company + users + subscription
    const base = process.env.NEXT_PUBLIC_API_BASE!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const res = await fetch(`${base}/signup-bootstrap`, {
      method: "POST",
      headers: { "content-type": "application/json", apikey: anon, authorization: `Bearer ${anon}` },
      body: JSON.stringify({ auth_id: data.user.id, email, full_name: fullName, company_name: companyName }),
    });
    const j = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok || !j.ok) { setError(j.error?.message ?? "Failed to bootstrap account"); return; }

    // If the project requires email confirmation, send to signin; else go to dashboard
    if (data.session) router.push("/dashboard");
    else router.push("/auth/signin?message=check-email");
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <div className="card" style={{ width: 420 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Create your FabSimple account</div>
            <div className="card-sub">14-day free trial · No credit card required</div>
          </div>
        </div>
        <div className="card-body">
          <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase font-semibold tracking-wider" style={{ color: "var(--muted)" }}>Company name</span>
              <input className="input" required value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Steel Fab" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase font-semibold tracking-wider" style={{ color: "var(--muted)" }}>Your name</span>
              <input className="input" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Doe" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase font-semibold tracking-wider" style={{ color: "var(--muted)" }}>Email</span>
              <input type="email" className="input" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase font-semibold tracking-wider" style={{ color: "var(--muted)" }}>Password</span>
              <input type="password" className="input" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
            </label>

            {error && <div className="pill pill-red" style={{ padding: "8px 12px", fontSize: 12 }}>{error}</div>}

            <button type="submit" disabled={loading} className="btn btn-primary" style={{ height: 40, justifyContent: "center", marginTop: 8 }}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
              {loading ? "Creating…" : "Create account"}
            </button>

            <div className="text-center text-[12px]" style={{ color: "var(--muted)" }}>
              Already have an account? <Link href="/auth/signin" style={{ color: "var(--primary)" }}>Sign in</Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
