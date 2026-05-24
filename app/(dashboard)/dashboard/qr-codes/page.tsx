"use client";

import { useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { useResourceList } from "@/hooks/useResource";
import { QRCodeCanvas } from "qrcode.react";
import { Printer, Download } from "lucide-react";

interface Part {
  id: string; part_mark: string; profile: string; assembly_mark: string | null;
  project_id: string;
}

export default function QrCodesPage() {
  const list = useResourceList<Part>("parts", { limit: "200", order_by: "part_mark", dir: "asc" });
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) => setSelected((s) => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const selectAll = () => setSelected(new Set((list.data ?? []).map((p) => p.id)));
  const clear = () => setSelected(new Set());

  function printSheet() {
    const sheetParts = (list.data ?? []).filter((p) => selected.has(p.id));
    const html = `
      <html><head><title>QR Sheet</title>
      <style>
        body { font-family: -apple-system, sans-serif; margin: 12mm; }
        .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8mm; }
        .label { border: 1px solid #ccc; border-radius: 4mm; padding: 6mm; text-align: center; page-break-inside: avoid; }
        .mark { font-size: 14pt; font-weight: 700; font-family: monospace; }
        .prof { font-size: 9pt; color: #555; }
      </style></head><body>
        <h2>QR Code Sheet — ${sheetParts.length} parts</h2>
        <div class="grid">${sheetParts.map((p) => `
          <div class="label">
            <div class="mark">${p.part_mark}</div>
            <div class="prof">${p.profile}${p.assembly_mark ? ` · ${p.assembly_mark}` : ""}</div>
            <canvas data-qr="${p.id}"></canvas>
          </div>
        `).join("")}</div>
      </body></html>
    `;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); }
  }

  return (
    <PageWrapper title="QR Codes">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[20px] font-bold" style={{ color: "var(--text)" }}>QR Code Sheets</div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>
            Select parts to print labels. Workers scan to load the assigned part view.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn" onClick={selectAll}>Select all ({list.data?.length ?? 0})</button>
          <button className="btn" onClick={clear}>Clear</button>
          <button className="btn btn-primary" disabled={selected.size === 0} onClick={printSheet}>
            <Printer size={14} /> Print {selected.size > 0 ? `(${selected.size})` : ""}
          </button>
        </div>
      </div>

      <div className="grid-4 gap-md">
        {(list.data ?? []).map((p) => (
          <button
            key={p.id}
            onClick={() => toggle(p.id)}
            className="card project-card"
            style={{
              padding: 12, cursor: "pointer", textAlign: "center",
              border: selected.has(p.id) ? "2px solid var(--primary)" : "1px solid var(--border)",
              background: selected.has(p.id) ? "rgba(79,70,229,0.05)" : "var(--bg-card)",
            }}
          >
            <div style={{ background: "white", padding: 8, borderRadius: 6, marginBottom: 8 }}>
              <QRCodeCanvas value={`fabsimple://part/${p.id}`} size={88} level="H" />
            </div>
            <div className="font-mono font-bold text-[12px]" style={{ color: "var(--text)" }}>{p.part_mark}</div>
            <div className="text-[10px]" style={{ color: "var(--muted)" }}>{p.profile}</div>
            {p.assembly_mark && (
              <div className="text-[10px] font-mono" style={{ color: "var(--muted)" }}>asm: {p.assembly_mark}</div>
            )}
          </button>
        ))}
      </div>
    </PageWrapper>
  );
}
