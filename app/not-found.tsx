import Link from "next/link";
import { Home, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: "var(--bg)" }}
    >
      <div
        className="card"
        style={{ width: "100%", maxWidth: 480, padding: 32, textAlign: "center" }}
      >
        <div
          style={{
            fontSize: 56,
            fontWeight: 700,
            color: "var(--muted)",
            letterSpacing: -1,
            lineHeight: 1,
          }}
        >
          404
        </div>
        <h1
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: "var(--text)",
            marginTop: 16,
            marginBottom: 8,
          }}
        >
          Page not found
        </h1>
        <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 24 }}>
          The page you were looking for doesn&apos;t exist or may have been moved.
        </p>
        <div className="flex items-center justify-center gap-2">
          <Link href="/dashboard" className="btn btn-primary" style={{ height: 36 }}>
            <Home size={14} /> Go to dashboard
          </Link>
          <Link href="javascript:history.back()" className="btn" style={{ height: 36 }}>
            <ArrowLeft size={14} /> Back
          </Link>
        </div>
      </div>
    </div>
  );
}
