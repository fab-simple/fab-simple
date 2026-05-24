"use client";

// Dashboard-section error boundary. Catches uncaught render errors in any
// /dashboard/* route segment so users see a real "something went wrong"
// card with a retry button instead of the raw Next.js error overlay.

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (typeof console !== "undefined") {
      console.error("[dashboard-error]", error);
    }
  }, [error]);

  return (
    <div
      style={{
        minHeight: "calc(100vh - 64px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
        background: "var(--bg)",
      }}
    >
      <div className="card" style={{ width: "100%", maxWidth: 520, padding: 28 }}>
        <div
          className="flex items-center justify-center"
          style={{
            width: 56,
            height: 56,
            background: "rgba(239, 68, 68, 0.1)",
            borderRadius: 12,
            margin: "0 auto 16px",
          }}
        >
          <AlertTriangle size={28} color="var(--danger, #ef4444)" />
        </div>

        <h1
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "var(--text)",
            textAlign: "center",
            marginBottom: 8,
          }}
        >
          Something went wrong
        </h1>
        <p
          style={{
            fontSize: 13,
            color: "var(--muted)",
            textAlign: "center",
            marginBottom: 20,
          }}
        >
          We couldn&apos;t render this page. Try again, or head back to your dashboard.
        </p>

        {error.digest && (
          <div
            className="pill"
            style={{
              fontSize: 11,
              padding: "6px 10px",
              fontFamily: "monospace",
              marginBottom: 20,
              textAlign: "center",
              color: "var(--muted)",
            }}
          >
            Ref: {error.digest}
          </div>
        )}

        <div className="flex items-center justify-center gap-2">
          <button onClick={reset} className="btn btn-primary" style={{ height: 36 }}>
            <RefreshCw size={14} /> Try again
          </button>
          <Link href="/dashboard" className="btn" style={{ height: 36 }}>
            <Home size={14} /> Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
