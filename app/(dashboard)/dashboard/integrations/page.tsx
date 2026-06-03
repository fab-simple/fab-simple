"use client";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { Plug, ExternalLink } from "lucide-react";

const INTEGRATIONS = [
  { name: "Procore", desc: "Sync RFIs, drawings, and submittals", status: "available", icon: "🏗️" },
  { name: "QuickBooks Online", desc: "Push invoices, sync vendor bills", status: "available", icon: "💵" },
  { name: "Tekla Structures", desc: "BOM CSV / XLSX import (live now)", status: "active", icon: "📐" },
  { name: "SDS2", desc: "BOM CSV / XLSX import (live now)", status: "active", icon: "📐" },
  { name: "DocuSign", desc: "Sign AIA G702 applications", status: "coming-soon", icon: "✍️" },
  { name: "Slack", desc: "Notify channels on inspection failures", status: "coming-soon", icon: "💬" },
];

export default function IntegrationsPage() {
  return (
    <PageWrapper title="Integrations">
      <div className="mb-6">
        <div className="text-[20px] font-bold" style={{ color: "var(--text)" }}>Integrations</div>
        <div className="text-[12px]" style={{ color: "var(--muted)" }}>Connect external tools your shop already uses</div>
      </div>

      <div className="grid-3 gap-md">
        {INTEGRATIONS.map((it) => (
          <div key={it.name} className="card">
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="flex items-start justify-between">
                <div style={{ fontSize: 28 }}>{it.icon}</div>
                <StatusBadge status={it.status} />
              </div>
              <div>
                <div className="text-[15px] font-bold" style={{ color: "var(--text)" }}>{it.name}</div>
                <div className="text-[12px]" style={{ color: "var(--muted)", marginTop: 4 }}>{it.desc}</div>
              </div>
              <button
                className="btn"
                disabled={it.status === "active" || it.status === "coming-soon"}
                style={{ width: "100%", justifyContent: "center" }}
              >
                {it.status === "active" ? "Connected" : it.status === "coming-soon" ? "Coming soon" : <><Plug size={14} /> Connect</>}
              </button>
            </div>
          </div>
        ))}
      </div>
    </PageWrapper>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls = status === "active" ? "pill-done" : status === "coming-soon" ? "pill-warn" : "pill";
  const label = status === "active" ? "Active" : status === "coming-soon" ? "Coming soon" : "Available";
  return <span className={`pill ${cls}`} style={{ padding: "2px 8px", fontSize: 10 }}>{label}</span>;
}
