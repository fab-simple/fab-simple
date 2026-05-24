"use client";

import { useRef, useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { useResourceList } from "@/hooks/useResource";
import { QRCodeCanvas } from "qrcode.react";
import { Printer } from "lucide-react";

interface Part {
  id: string; part_mark: string; profile: string; assembly_mark: string | null;
  project_id: string;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c] as string);
}

export default function QrCodesPage() {
  const list = useResourceList<Part>("parts", { limit: "200", order_by: "part_mark", dir: "asc" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Hidden off-screen container holding the actual <QRCodeCanvas> elements
  // we'll harvest as PNG data URLs at print time. Without this, the popup
  // window saw empty <canvas> tags and printed blank squares.
  const printSourceRef = useRef<HTMLDivElement | null>(null);

  const toggle = (id: string) => setSelected((s) => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const selectAll = () => setSelected(new Set((list.data ?? []).map((p) => p.id)));
  const clear = () => setSelected(new Set());

  function printSheet() {
    const sheetParts = (list.data ?? []).filter((p) => selected.has(p.id));
    if (sheetParts.length === 0) return;

    // Pull the data URL out of each off-screen <canvas>. We rendered them at
    // 256×256 / level H so they survive printer scaling and reflective
    // tape stickers.
    const root = printSourceRef.current;
    const qrPng: Record<string, string> = {};
    if (root) {
      const wrappers = root.querySelectorAll<HTMLElement>("[data-print-qr]");
      wrappers.forEach((w) => {
        const id = w.dataset.printQr;
        const c = w.querySelector("canvas") as HTMLCanvasElement | null;
        if (id && c) qrPng[id] = c.toDataURL("image/png");
      });
    }

    const html = `
      <html><head><title>FabSimple QR Sheet — ${sheetParts.length} parts</title>
      <style>
        @page { size: letter; margin: 12mm; }
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 12mm; color: #111; }
        h2 { margin: 0 0 8mm 0; font-size: 12pt; }
        .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6mm; }
        .label {
          border: 1px solid #d4d4d8; border-radius: 4mm; padding: 5mm 4mm; text-align: center;
          page-break-inside: avoid; background: white;
        }
        .qr { width: 38mm; height: 38mm; margin: 0 auto 3mm auto; display: block; }
        .mark { font-size: 14pt; font-weight: 700; font-family: ui-monospace, SFMono-Regular, monospace; letter-spacing: 0.5px; }
        .prof { font-size: 8.5pt; color: #52525b; margin-top: 1mm; }
        .url  { font-size: 6.5pt; color: #71717a; margin-top: 2mm; font-family: monospace; }
        @media print { body { margin: 0; } h2 { display: none; } }
      </style></head><body>
        <h2>FabSimple QR Code Sheet — ${sheetParts.length} parts</h2>
        <div class="grid">${sheetParts.map((p) => `
          <div class="label">
            ${qrPng[p.id] ? `<img class="qr" src="${qrPng[p.id]}" alt="QR ${escapeHtml(p.part_mark)}" />` : ""}
            <div class="mark">${escapeHtml(p.part_mark)}</div>
            <div class="prof">${escapeHtml(p.profile)}${p.assembly_mark ? ` · ${escapeHtml(p.assembly_mark)}` : ""}</div>
            <div class="url">fabsimple://part/${p.id.slice(0, 8)}…</div>
          </div>
        `).join("")}</div>
        <script>window.addEventListener('load', function(){ setTimeout(function(){ window.print(); }, 250); });</script>
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

      {list.error ? (
        <div className="card" style={{ padding: 24, color: "var(--danger)" }}>
          Failed to load parts: {list.error.message}
        </div>
      ) : null}

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

      {/* Off-screen high-resolution QR canvases for the print sheet. Mounted
          for every part the user has selected; harvested as PNG data URLs at
          print time and embedded as <img> tags in the popup window. */}
      <div
        ref={printSourceRef}
        aria-hidden
        style={{
          position: "absolute",
          left: -10000,
          top: -10000,
          width: 1,
          height: 1,
          overflow: "hidden",
        }}
      >
        {(list.data ?? [])
          .filter((p) => selected.has(p.id))
          .map((p) => (
            <div key={`print-${p.id}`} data-print-qr={p.id}>
              <QRCodeCanvas
                value={`fabsimple://part/${p.id}`}
                size={256}
                level="H"
                includeMargin={false}
              />
            </div>
          ))}
      </div>
    </PageWrapper>
  );
}
