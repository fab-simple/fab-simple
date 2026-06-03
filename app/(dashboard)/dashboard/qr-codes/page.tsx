"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { useResourceList, useResourcePaged } from "@/hooks/useResource";
import { FabAPI } from "@/lib/api";
import { QRCodeCanvas } from "qrcode.react";
import { AttachmentsDrawer } from "@/components/ui/AttachmentsDrawer";
import { Printer, Paperclip, AlertCircle, Loader2 } from "lucide-react";

interface Part {
  id: string; part_mark: string; profile: string; assembly_mark: string | null;
  project_id: string;
}

interface Project { id: string; name: string; number: string; }

interface AttachmentRow {
  id: string;
  entity_id: string;
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
  const [projectFilter, setProjectFilter] = useState<string>("");
  const [missingOnly, setMissingOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [attachTarget, setAttachTarget] = useState<Part | null>(null);
  // Bumps every time a PDF is uploaded; used to invalidate the
  // attachments query and refresh the red-dot / count indicators
  // without a full page reload.
  const [attachmentsRev, setAttachmentsRev] = useState(0);

  // Off-screen high-res canvases harvested into the print sheet.
  const printSourceRef = useRef<HTMLDivElement | null>(null);

  // QR payload must be a real https URL so a phone camera opens it directly.
  // The worker scan page also accepts this `/worker/parts/<id>` form (and
  // bare UUIDs), so the in-app scanner keeps working too. We read the origin
  // after mount because window isn't available during SSR; until then we fall
  // back to a relative path which still encodes/decodes fine.
  const [origin, setOrigin] = useState("");
  useEffect(() => { setOrigin(window.location.origin); }, []);
  const partUrl = (id: string) => `${origin}/worker/parts/${id}`;

  // Filters that drive the paginated parts list. Stable identity so
  // useResourcePaged doesn't refetch on every keystroke.
  const filters = useMemo(() => {
    const f: Record<string, string | undefined> = {};
    if (projectFilter) f.project_id = projectFilter;
    return f;
  }, [projectFilter]);

  const list = useResourcePaged<Part>("parts", {
    initialPerPage: 100,
    initialOrderBy: "part_mark",
    initialDir: "asc",
    filters,
  });
  const projects = useResourceList<Project>("projects", { per_page: 100 });
  const rows = list.data?.rows ?? [];

  // project_id → project lookup for Job Number badges on cards + print labels.
  const projectById = useMemo(() => {
    const m = new Map<string, Project>();
    for (const p of projects.data ?? []) m.set(p.id, p);
    return m;
  }, [projects.data]);

  // For the parts currently on screen, fetch all file_attachments in ONE
  // request and build a set of part IDs that have at least one upload.
  // Anything not in the set gets the red "missing PDF" marker.
  //
  // We key the effect on the JOINED id string (a primitive) rather than the
  // `rows` array so it doesn't re-run on every render — `list.data?.rows ?? []`
  // produces a new array reference when data is undefined, which would
  // otherwise cause a render → setState → render loop.
  const [withPdf, setWithPdf] = useState<Set<string>>(new Set());
  const [attLoading, setAttLoading] = useState(false);
  const idsKey = rows.map((r) => r.id).join(",");
  useEffect(() => {
    if (!idsKey) {
      setWithPdf((prev) => (prev.size === 0 ? prev : new Set()));
      return;
    }
    let cancelled = false;
    setAttLoading(true);
    FabAPI.list<AttachmentRow>("file_attachments", {
      entity_type: "parts",
      entity_id__in: idsKey,
      per_page: 200,
    })
      .then((res) => {
        if (cancelled) return;
        const s = new Set<string>();
        for (const a of res) s.add(a.entity_id);
        setWithPdf(s);
      })
      .catch(() => {
        if (cancelled) return;
        setWithPdf(new Set()); // fail open — show everything as missing rather than wrong
      })
      .finally(() => { if (!cancelled) setAttLoading(false); });
    return () => { cancelled = true; };
  }, [idsKey, attachmentsRev]);

  // Apply the "missing PDF only" toggle as a client-side filter on whatever
  // parts are currently loaded. The button label shows the live count so
  // shop foremen can see at a glance how many parts still need scanned drawings.
  const visible = useMemo(() => {
    if (!missingOnly) return rows;
    return rows.filter((p) => !withPdf.has(p.id));
  }, [rows, missingOnly, withPdf]);
  const missingCount = rows.reduce((n, p) => n + (withPdf.has(p.id) ? 0 : 1), 0);

  const toggle = (id: string) => setSelected((s) => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const selectAll = () => setSelected(new Set(visible.map((p) => p.id)));
  const clearSel = () => setSelected(new Set());
  const onProjectChange = (id: string) => { setProjectFilter(id); setSelected(new Set()); };

  function printSheet() {
    const sheetParts = visible.filter((p) => selected.has(p.id));
    if (sheetParts.length === 0) return;

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
        .nopdf { font-size: 8pt; color: #DC2626; font-weight: 600; margin-top: 1mm; }
        @media print { body { margin: 0; } h2 { display: none; } }
      </style></head><body>
        <h2>FabSimple QR Code Sheet — ${sheetParts.length} parts</h2>
        <div class="grid">${sheetParts.map((p) => {
          const project = projectById.get(p.project_id);
          const jobLabel = project?.number ? `Job ${project.number}` : "";
          const noPdf = !withPdf.has(p.id);
          return `
          <div class="label">
            ${qrPng[p.id] ? `<img class="qr" src="${qrPng[p.id]}" alt="QR ${escapeHtml(p.part_mark)}" />` : ""}
            ${jobLabel ? `<div class="job">${escapeHtml(jobLabel)}</div>` : ""}
            <div class="mark">${escapeHtml(p.part_mark)}</div>
            <div class="prof">${escapeHtml(p.profile)}${p.assembly_mark ? ` · ${escapeHtml(p.assembly_mark)}` : ""}</div>
            ${noPdf ? `<div class="nopdf">⚠ NO DRAWING ATTACHED</div>` : ""}
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

  const total = list.data?.total ?? 0;
  const hasMore = list.data?.has_more ?? false;

  return (
    <PageWrapper title="QR Codes">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[20px] font-bold" style={{ color: "var(--text)" }}>QR Code Sheets</div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>
            {total} parts total · workers scan to load the assigned part view + attached drawings.
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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
          <button
            className="btn"
            onClick={() => { setMissingOnly((v) => !v); setSelected(new Set()); }}
            title="Show only parts without a drawing PDF attached"
            style={{
              borderColor: missingOnly ? "#DC2626" : "var(--border)",
              color: missingOnly ? "#DC2626" : undefined,
              background: missingOnly ? "rgba(220,38,38,0.06)" : undefined,
              height: 32,
            }}
          >
            <AlertCircle size={13} /> Missing PDF
            <span className="pill" style={{
              marginLeft: 4, fontSize: 10,
              background: missingCount > 0 ? "#DC2626" : "var(--bg-muted)",
              color: missingCount > 0 ? "#fff" : "var(--muted)",
              padding: "1px 6px",
            }}>{missingCount}</span>
          </button>
          <button className="btn" onClick={selectAll}>Select all ({visible.length})</button>
          <button className="btn" onClick={clearSel}>Clear</button>
          <button className="btn btn-primary" disabled={selected.size === 0} onClick={printSheet}>
            <Printer size={14} /> Print {selected.size > 0 ? `(${selected.size})` : ""}
          </button>
        </div>
      </div>

      {list.error ? (
        <div className="card" style={{ padding: 24, color: "#DC2626" }}>
          Failed to load parts: {list.error.message}
        </div>
      ) : null}

      {list.isLoading ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
          <Loader2 size={18} className="animate-spin inline" /> Loading parts…
        </div>
      ) : visible.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
          {missingOnly
            ? "All visible parts already have a drawing PDF attached. Clear the filter to see everything."
            : "No parts found for the selected filter."}
        </div>
      ) : (
        <div className="grid-4 gap-md">
          {visible.map((p) => {
            const project = projectById.get(p.project_id);
            const noPdf = !withPdf.has(p.id);
            const isSelected = selected.has(p.id);
            return (
              <div
                key={p.id}
                className="card project-card"
                style={{
                  padding: 12, textAlign: "center", position: "relative",
                  border: noPdf
                    ? "2px solid #DC2626"
                    : isSelected ? "2px solid var(--primary)" : "1px solid var(--border)",
                  background: isSelected ? "rgba(79,70,229,0.05)" : "var(--bg-card)",
                  cursor: "pointer",
                }}
                onClick={() => toggle(p.id)}
              >
                {/* Missing-PDF indicator dot in the corner */}
                {noPdf && (
                  <div
                    title="No drawing PDF attached"
                    style={{
                      position: "absolute", top: 6, left: 6,
                      width: 10, height: 10, borderRadius: "50%",
                      background: "#DC2626",
                      boxShadow: "0 0 0 2px var(--bg-card)",
                    }}
                  />
                )}
                {/* Inline PDF-upload trigger. Stops the click from also toggling
                    selection so users can attach a PDF without re-selecting. */}
                <button
                  type="button"
                  title={noPdf ? "Add drawing PDF" : "View / manage attachments"}
                  onClick={(e) => { e.stopPropagation(); setAttachTarget(p); }}
                  className="btn btn-sm"
                  style={{
                    position: "absolute", top: 6, right: 6,
                    padding: "3px 6px",
                    background: noPdf ? "#DC2626" : "var(--bg-muted)",
                    color: noPdf ? "#fff" : "var(--text)",
                    border: "none",
                  }}
                >
                  <Paperclip size={12} />
                </button>

                <div style={{ background: "white", padding: 8, borderRadius: 6, marginBottom: 8, marginTop: 4 }}>
                  <QRCodeCanvas value={partUrl(p.id)} size={88} level="H" />
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
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination footer — only shown when there's more than one page so
          tiny demos don't get a useless control. */}
      {total > list.perPage && (
        <div className="flex items-center justify-between mt-section text-[12px]" style={{ color: "var(--muted)" }}>
          <div>
            Page {list.page} · showing {rows.length} of {total}{attLoading ? " · checking attachments…" : ""}
          </div>
          <div className="flex items-center gap-2">
            <button className="btn btn-sm" disabled={list.page <= 1} onClick={() => list.setPage(list.page - 1)}>← Prev</button>
            <button className="btn btn-sm" disabled={!hasMore} onClick={() => list.setPage(list.page + 1)}>Next →</button>
          </div>
        </div>
      )}

      {/* Off-screen high-resolution QR canvases harvested by the print sheet. */}
      <div
        ref={printSourceRef}
        aria-hidden
        style={{
          position: "absolute", left: -10000, top: -10000, width: 1, height: 1, overflow: "hidden",
        }}
      >
        {visible
          .filter((p) => selected.has(p.id))
          .map((p) => (
            <div key={`print-${p.id}`} data-print-qr={p.id}>
              <QRCodeCanvas
                value={partUrl(p.id)}
                size={256}
                level="H"
                includeMargin={false}
              />
            </div>
          ))}
      </div>

      <AttachmentsDrawer
        open={!!attachTarget}
        onClose={() => {
          // Bump the rev so the next render re-fetches the attachments map and
          // the red dot disappears if a PDF was just uploaded.
          setAttachmentsRev((n) => n + 1);
          setAttachTarget(null);
        }}
        entityType="parts"
        entityId={attachTarget?.id ?? ""}
        bucket="drawings"
        title={`Attach drawing — ${attachTarget?.part_mark ?? ""}`}
        subtitle={attachTarget?.assembly_mark ? `Assembly: ${attachTarget.assembly_mark}` : undefined}
        accept=".pdf,application/pdf,image/*"
      />
    </PageWrapper>
  );
}
