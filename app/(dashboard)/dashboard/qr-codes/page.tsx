"use client";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { PARTS } from "@/lib/mock-data";
import { useState } from "react";
import { Search } from "lucide-react";

export default function QRCodesPage() {
  const [search, setSearch] = useState("");
  const filtered = PARTS.filter((p) => p.part_id.toLowerCase().includes(search.toLowerCase())).slice(0, 12);

  return (
    <PageWrapper title="QR Code Generator">
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }} />
          <input className="filter-input pl-8 w-full" placeholder="Search Part ID…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button className="btn btn-primary no-print" onClick={() => window.print()}>Print All QR Codes</button>
      </div>

      <div className="grid-6" style={{ gap: 12 }}>
        {filtered.map((p) => (
          <div key={p.id} className="card cursor-pointer">
            <div className="card-body text-center">
              {/* Simulated QR placeholder */}
              <div
                className="mx-auto mb-2"
                style={{
                  width: 80, height: 80,
                  background: "repeating-conic-gradient(#1E293B 0% 25%, #fff 0% 50%)",
                  backgroundSize: "8px 8px",
                  borderRadius: 4,
                  border: "4px solid #1E293B",
                  position: "relative",
                }}
              >
                <div style={{ position: "absolute", inset: 8, background: "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ fontSize: 6, fontFamily: "monospace", fontWeight: 700, color: "#1E293B", lineHeight: 1.2, textAlign: "center" }}>
                    {p.part_id.slice(0, 12)}<br />QR
                  </div>
                </div>
              </div>
              <div className="font-mono font-bold text-[11px]" style={{ color: "var(--primary)" }}>{p.part_id}</div>
              <div className="text-[9px] mt-0.5" style={{ color: "var(--muted)" }}>{p.assembly_id}</div>
              <div className="text-[9px]" style={{ color: "var(--faint)" }}>{p.profile}</div>
            </div>
          </div>
        ))}
      </div>
    </PageWrapper>
  );
}
