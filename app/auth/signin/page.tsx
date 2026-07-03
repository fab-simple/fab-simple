"use client";

import { Suspense, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { LogIn, Loader2, QrCode, Keyboard, Camera, Shield } from "lucide-react";
import jsQR from "jsqr";

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

  const [activeTab, setActiveTab] = useState<"standard" | "badge">("standard");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Badge/QR scan state
  const [scanning, setScanning] = useState(false);
  const [manualBadge, setManualBadge] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const stoppedRef = useRef(false);

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

  async function handleBadgeLogin(badgeEmail: string) {
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error: e2 } = await supabase.auth.signInWithPassword({
      email: badgeEmail,
      password: "demo123!",
    });
    setLoading(false);
    if (e2) { setError(e2.message); return; }
    router.push(nextPath);
    router.refresh();
  }

  function fillDemo(em: string) {
    setEmail(em);
    setPassword("demo123!");
    setActiveTab("standard");
  }

  // QR Code scanner loop
  useEffect(() => {
    if (!scanning || activeTab !== "badge") return;

    stoppedRef.current = false;
    let stream: MediaStream | null = null;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        const loop = () => {
          if (stoppedRef.current || !videoRef.current || !context) return;
          const video = videoRef.current;
          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            context.drawImage(video, 0, 0, canvas.width, canvas.height);
            const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: "dontInvert",
            });
            if (code) {
              const raw = code.data.trim();
              let resolvedEmail = raw;
              if (raw.includes("@")) {
                resolvedEmail = raw;
              } else {
                const mapped = DEMO_ACCOUNTS.find(
                  (d) => d.role.toLowerCase() === raw.toLowerCase() || d.email.startsWith(raw.toLowerCase())
                );
                if (mapped) resolvedEmail = mapped.email;
              }

              if (resolvedEmail.includes("@")) {
                stoppedRef.current = true;
                setScanning(false);
                handleBadgeLogin(resolvedEmail);
                return;
              }
            }
          }
          requestAnimationFrame(loop);
        };
        loop();
      } catch (err) {
        setError("Camera permission denied or not available");
        setScanning(false);
      }
    })();

    return () => {
      stoppedRef.current = true;
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [scanning, activeTab]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <div
        className="w-full grid gap-8"
        style={{
          maxWidth: SHOW_DEMO ? 940 : 460,
          gridTemplateColumns: SHOW_DEMO ? "1.2fr 1fr" : "1fr",
          padding: 24,
        }}
      >
        {/* Left — Sign In Panel */}
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
                <div className="card-sub font-medium">Steel Fabrication Management</div>
              </div>
            </div>
          </div>

          {/* High-Contrast Glove-Friendly Tabs */}
          <div className="flex border-b border-white/10" style={{ padding: "0 16px" }}>
            <button
              onClick={() => { setActiveTab("standard"); setScanning(false); }}
              className={`flex-1 py-4 text-center text-[14px] font-extrabold transition-all border-b-2 flex items-center justify-center gap-2`}
              style={{
                borderColor: activeTab === "standard" ? "var(--primary)" : "transparent",
                color: activeTab === "standard" ? "#fff" : "var(--muted)",
                height: 56
              }}
            >
              <LogIn size={16} /> Password Login
            </button>
            <button
              onClick={() => { setActiveTab("badge"); }}
              className={`flex-1 py-4 text-center text-[14px] font-extrabold transition-all border-b-2 flex items-center justify-center gap-2`}
              style={{
                borderColor: activeTab === "badge" ? "var(--primary)" : "transparent",
                color: activeTab === "badge" ? "#fff" : "var(--muted)",
                height: 56
              }}
            >
              <QrCode size={16} /> Badge / QR Scan
            </button>
          </div>

          <div className="card-body mt-2">
            {error && (
              <div className="pill pill-red mb-4" style={{ padding: "10px 14px", fontSize: 13, borderRadius: 8 }}>
                {error}
              </div>
            )}

            {activeTab === "standard" ? (
              <form onSubmit={onSubmit} className="flex flex-col gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] uppercase font-semibold tracking-wider" style={{ color: "var(--muted)" }}>Email</span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="input"
                    style={{ height: 44 }}
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
                    style={{ height: 44 }}
                    placeholder="••••••••"
                  />
                </label>

                <button type="submit" disabled={loading} className="btn btn-primary mt-2" style={{ height: 48, justifyContent: "center", fontSize: 15, fontWeight: 700 }}>
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
                  {loading ? "Signing in…" : "Sign in"}
                </button>

                <div className="flex justify-between text-[12px] mt-2" style={{ color: "var(--muted)" }}>
                  <Link href="/auth/forgot" style={{ color: "var(--primary)" }}>Forgot password?</Link>
                  <Link href="/auth/signup" style={{ color: "var(--primary)" }}>Create account</Link>
                </div>
              </form>
            ) : (
              <div className="flex flex-col gap-4 text-center">
                {scanning ? (
                  <div className="relative rounded-xl overflow-hidden bg-black mx-auto w-full max-w-[320px] aspect-video border border-white/10">
                    <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
                    <div className="absolute inset-4 border border-indigo-500/50 rounded-lg pointer-events-none border-dashed animate-pulse" />
                    <button
                      onClick={() => setScanning(false)}
                      className="absolute bottom-2 right-2 px-3 py-1 rounded bg-black/60 text-white text-[11px] font-bold"
                    >
                      Cancel Camera
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setScanning(true); setError(null); }}
                    className="w-full flex flex-col items-center justify-center gap-3 border-2 border-dashed border-indigo-500/30 hover:border-indigo-500/60 bg-indigo-500/5 rounded-2xl transition-colors cursor-pointer"
                    style={{ minHeight: 140, padding: 24 }}
                  >
                    <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                      <Camera size={32} />
                    </div>
                    <div>
                      <div className="text-[15px] font-extrabold text-white">Scan Worker QR Badge</div>
                      <div className="text-[12px]" style={{ color: "var(--muted)" }}>Hold your printed tag or screen QR to the camera</div>
                    </div>
                  </button>
                )}

                {/* Manual Badge Tap Fallback for shared terminals */}
                <div className="mt-2 text-left">
                  <div className="text-[11px] uppercase font-semibold tracking-wider mb-2" style={{ color: "var(--muted)" }}>Quick Badge Tap (Tap to login)</div>
                  <div className="grid grid-cols-2 gap-2">
                    {DEMO_ACCOUNTS.map((d) => (
                      <button
                        key={d.email}
                        onClick={() => handleBadgeLogin(d.email)}
                        disabled={loading}
                        className="flex items-center gap-2 p-3.5 rounded-xl text-left border border-white/5 hover:border-white/20 transition-all cursor-pointer bg-white/[0.02]"
                        style={{ minHeight: 56 }}
                      >
                        <Shield size={16} className="text-indigo-400 flex-shrink-0" />
                        <div>
                          <div className="text-[13px] font-bold text-white leading-tight">{d.role}</div>
                          <div className="text-[10px]" style={{ color: "var(--muted)" }}>Tap reader</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-white/5"></div>
                  <span className="flex-shrink mx-4 text-[10px] uppercase font-bold" style={{ color: "var(--muted)" }}>Or type email badge</span>
                  <div className="flex-grow border-t border-white/5"></div>
                </div>

                <div className="flex gap-2">
                  <input
                    type="email"
                    value={manualBadge}
                    onChange={(e) => setManualBadge(e.target.value)}
                    placeholder="worker@demo.fabsimple.io"
                    className="input flex-1"
                    style={{ height: 48 }}
                  />
                  <button
                    onClick={() => handleBadgeLogin(manualBadge)}
                    disabled={loading || !manualBadge}
                    className="btn btn-primary"
                    style={{ height: 48, fontWeight: 700, paddingLeft: 24, paddingRight: 24 }}
                  >
                    Login
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right — Demo Accounts Sidebar */}
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
                  className="flex items-center justify-between p-3.5 rounded-xl transition-all hover:bg-white/[0.04] cursor-pointer"
                  style={{
                    background: "var(--bg-muted)",
                    border: "1px solid var(--border)",
                    textAlign: "left",
                  }}
                >
                  <div>
                    <div className="text-[13.5px] font-bold" style={{ color: "var(--text)" }}>{a.role}</div>
                    <div className="text-[11px] font-mono" style={{ color: "var(--muted)" }}>{a.email}</div>
                  </div>
                  <span className="pill text-[10.5px] font-bold" style={{ color: "var(--primary)" }}>Select</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
