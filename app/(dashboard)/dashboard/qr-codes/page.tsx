"use client";

import { useMemo, useRef, useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { useResourceList } from "@/hooks/useResource";
import { QRCodeCanvas } from "qrcode.react";
import { Printer } from "lucide-react";

interface Part {
  id: string; part_mark: string; profile: string; assembly_mark: string | null;
  project_id: string;
}

interface Project { id: string; name: string; number: string; }

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
  const [projectFilter, setProjectFilter] = useState<string>("");

  // Build the filter sent to the parts list. We pass project_id only when
  // a specific project is selected so the "All projects" view still works
  // for shops that print QR sheets cross-job.
  const partsQuery = useMemo(() => {
    const q: Record<string, string> = {
      limit: "200",
      order_by: "part_mark",
      dir: "asc",
    };
    if (projectFilter) q.project_id = projectFilter;
    return q;
  }, [projectFilter]);

  const list = useResourceList<Part>("parts", partsQuery);
  const projects = useResourceList<Project>("projects", { per_page: 100 });

  // project_id → "25-305" lookup so each card / print label can show the
  // Job Number alongside the part mark. Map is rebuilt only when the
  // projects list changes.
  const projectById = useMemo(() => {
    const m = new Map<string, Project>();
    for (const p of projects.data ?? []) m.set(p.id, p);
    return m;
  }, [projects.data]);

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
  const onProjectChange = (id: string) => { setProjectFilter(id); setSelected(new Set()); };

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
        .job  { font-size: 8pt; font-weight: 600; color: #4f46e5; letter-spacing: 0.5px; margin-bottom: 1mm; text-transform: uppercase; font-family: ui-monospace, SFMono-Regular, monospace; }
        .mark { font-size: 14pt; font-weight: 700; font-family: ui-monospace, SFMono-Regular, monospace; letter-spacing: 0.5px; }
        .prof { font-size: 8.5pt; color: #52525b; margin-top: 1mm; }
        .url  { font-size: 6.5pt; color: #71717a; margin-top: 2mm; font-family: monospace; }
        @media print { body { margin: 0; } h2 { display: none; } }
      </style></head><body>
        <h2>FabSimple QR Code Sheet — ${sheetParts.length} parts</h2>
        <div class="grid">${sheetParts.map((p) => {
          const project = projectById.get(p.project_id);
          const jobLabel = project?.number ? `Job ${project.number}` : "";
          return `
          <div class="label">
            ${qrPng[p.id] ? `<img class="qr" src="${qrPng[p.id]}" alt="QR ${escapeHtml(p.part_mark)}" />` : ""}
            ${jobLabel ? `<div class="job">${escapeHtml(jobLabel)}</div>` : ""}
            <div class="mark">${escapeHtml(p.part_mark)}</div>
            <div class="prof">${escapeHtml(p.profile)}${p.assembly_mark ? ` · ${escapeHtml(p.assembly_mark)}` : ""}</div>
            <div class="url">fabsimple://part/${p.id.slice(0, 8)}…</div>
          </div>
          `;
        }).join("")}</div>
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
          <select
            className="input"
            value={projectFilter}
            onChange={(e) => onProjectChange(e.target.value)}
            style={{ height: 32, width: 220 }}
          >
            <option value="">All projects</option>
            {(projects.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.number ? `${p.number} — ${p.name}` : p.name}
              </option>
            ))}
          </select>
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
        {(list.data ?? []).map((p) => {
          const project = projectById.get(p.project_id);
          return (
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
              {project?.number && (
                <div className="font-mono text-[10px] font-bold" style={{ color: "var(--primary)", letterSpacing: 0.5, marginBottom: 2 }}>
                  Job {project.number}
                </div>
              )}
              <div className="font-mono font-bold text-[12px]" style={{ color: "var(--text)" }}>{p.part_mark}</div>
              <div className="text-[10px]" style={{ color: "var(--muted)" }}>{p.profile}</div>
              {p.assembly_mark && (
                <div className="text-[10px] font-mono" style={{ color: "var(--muted)" }}>asm: {p.assembly_mark}</div>
              )}
            </button>
          );
        })}
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
