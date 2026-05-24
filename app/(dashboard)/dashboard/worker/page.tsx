"use client";

import Link from "next/link";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { Smartphone, QrCode, Hand } from "lucide-react";

export default function WorkerDesktopPreviewPage() {
  return (
    <PageWrapper title="Worker view">
      <div className="card" style={{ padding: 32 }}>
        <div className="flex items-center gap-4" style={{ marginBottom: 20 }}>
          <Smartphone size={28} style={{ color: "var(--primary)" }} />
          <div>
            <div className="text-[18px] font-bold" style={{ color: "var(--text)" }}>Mobile-only worker view</div>
            <div className="text-[12px]" style={{ color: "var(--muted)" }}>
              Open <code>/worker</code> on a phone. Workers see only their assigned parts and a one-tap status update.
            </div>
          </div>
        </div>

        <div className="grid-3 gap-md" style={{ marginTop: 24 }}>
          <div className="card-body" style={{ padding: 20, background: "var(--bg-muted)", borderRadius: 8 }}>
            <Hand size={20} style={{ color: "var(--primary)" }} />
            <div className="text-[14px] font-semibold mt-2" style={{ color: "var(--text)" }}>Three-tap updates</div>
            <div className="text-[12px]" style={{ color: "var(--muted)" }}>open queue → tap part → tap status — never more than three taps.</div>
          </div>
          <div className="card-body" style={{ padding: 20, background: "var(--bg-muted)", borderRadius: 8 }}>
            <QrCode size={20} style={{ color: "var(--primary)" }} />
            <div className="text-[14px] font-semibold mt-2" style={{ color: "var(--text)" }}>QR-first nav</div>
            <div className="text-[12px]" style={{ color: "var(--muted)" }}>Scan a part QR (printed from QR Codes page) to jump straight to detail.</div>
          </div>
          <div className="card-body" style={{ padding: 20, background: "var(--bg-muted)", borderRadius: 8 }}>
            <Smartphone size={20} style={{ color: "var(--primary)" }} />
            <div className="text-[14px] font-semibold mt-2" style={{ color: "var(--text)" }}>Allow-list routes</div>
            <div className="text-[12px]" style={{ color: "var(--muted)" }}>Workers can only access /worker, /dashboard/parts, /dashboard/drawings.</div>
          </div>
        </div>

        <div style={{ marginTop: 24, display: "flex", justifyContent: "center" }}>
          <Link href="/worker" className="btn btn-primary">
            <Smartphone size={14} /> Open worker view
          </Link>
        </div>
      </div>
    </PageWrapper>
  );
}
