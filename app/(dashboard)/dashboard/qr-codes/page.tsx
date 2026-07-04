"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { useResourceList, useResourcePaged } from "@/hooks/useResource";
import { useGlobalProject } from "@/hooks/useGlobalProject";
import { FabAPI } from "@/lib/api";
import { QRCodeCanvas } from "qrcode.react";
import { AttachmentsDrawer } from "@/components/ui/AttachmentsDrawer";
import { Printer, Paperclip, AlertCircle, Loader2, Flame, Paintbrush, Check, Search, X } from "lucide-react";

interface Part {
  id: string;
  part_mark: string;
  profile: string;
  assembly_mark: string | null;
  name: string | null;
  grade: string | null;
  heat_number: string | null;
  finish: string | null;
  quantity: number | null;
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
  const { selectedProjectId } = useGlobalProject();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [missingOnly, setMissingOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [attachTarget, setAttachTarget] = useState<Part | null>(null);
  // Bumps every time a PDF is uploaded; used to invalidate the
  // attachments query and refresh the red-dot / count indicators
  // without a full page reload.
  const [attachmentsRev, setAttachmentsRev] = useState(0);

  // Off-screen high-res canvases harvested into the print sheet.
  const printSourceRef = useRef<HTMLDivElement | null>(null);

  // Debounce the search input so we don't hit the API on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

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
    if (selectedProjectId) f.project_id = selectedProjectId;
    if (search) f.part_mark__ilike = search;
    return f;
  }, [selectedProjectId, search]);

  const list = useResourcePaged<Part>("parts", {
    initialPerPage: 100,
    initialOrderBy: "part_mark",
    initialDir: "asc",
    filters,
  });

  // Reset page to 1 when search or project selection changes
  useEffect(() => {
    list.setPage(1);
    setSelected(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, selectedProjectId]);

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
  const [pdfCount, setPdfCount] = useState<Map<string, number>>(new Map());
  const [attLoading, setAttLoading] = useState(false);
  const idsKey = rows.map((r) => r.id).join(",");
  useEffect(() => {
    if (!idsKey) {
      setPdfCount((prev) => (prev.size === 0 ? prev : new Map()));
      return;
    }
    let cancelled = false;
    setAttLoading(true);
    (async () => {
      const counts = new Map<string, number>();
      let page = 1;
      for (;;) {
        const res = await FabAPI.listPaged<AttachmentRow>("file_attachments", {
          entity_type: "parts",
          entity_id__in: idsKey,
          per_page: 200,
          page,
        });
        for (const a of res.rows) counts.set(a.entity_id, (counts.get(a.entity_id) ?? 0) + 1);
        if (!res.has_more || res.rows.length === 0) break;
        page++;
      }
      return counts;
    })()
      .then((counts) => { if (!cancelled) setPdfCount(counts); })
      .catch(() => { if (!cancelled) setPdfCount(new Map()); })
      .finally(() => { if (!cancelled) setAttLoading(false); });
    return () => { cancelled = true; };
  }, [idsKey, attachmentsRev]);

  // Apply search & missing PDF filters across all project parts
  const visible = useMemo(() => {
    let result = rows;
    if (missingOnly) {
      result = result.filter((p) => !pdfCount.has(p.id));
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((p) =>
        (p.part_mark && p.part_mark.toLowerCase().includes(q)) ||
        (p.profile && p.profile.toLowerCase().includes(q)) ||
        (p.assembly_mark && p.assembly_mark.toLowerCase().includes(q)) ||
        (p.heat_number && p.heat_number.toLowerCase().includes(q)) ||
        (p.finish && p.finish.toLowerCase().includes(q)) ||
        (p.name && p.name.toLowerCase().includes(q))
      );
    }
    return result;
  }, [rows, missingOnly, pdfCount, search]);
  const missingCount = rows.reduce((n, p) => n + (pdfCount.has(p.id) ? 0 : 1), 0);

  const toggle = (id: string) => setSelected((s) => {
    const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const selectAll = () => setSelected(new Set(visible.map((p) => p.id)));
  const clearSel = () => setSelected(new Set());
  const onProjectChange = () => { setSelected(new Set()); };

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
        @page { size: letter; margin: 10mm; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 10mm; color: #0f172a; background: #fff; }
        h2 { margin: 0 0 6mm 0; font-size: 13pt; font-weight: 700; color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 3mm; display: flex; align-items: center; justify-between; }
        .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 5mm; }
        .label {
          border: 1px solid #cbd5e1; border-radius: 4mm; padding: 4mm; text-align: center;
          page-break-inside: avoid; background: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.05); position: relative;
        }
        .brand-hdr { display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid #cbd5e1; padding-bottom: 2.5mm; margin-bottom: 2.5mm; }
        .brand-logo { display: flex; align-items: center; gap: 4px; font-weight: 800; font-size: 8.5pt; color: #1e293b; text-transform: uppercase; letter-spacing: 0.5px; }
        .proj-line { display: flex; align-items: center; justify-content: center; gap: 4px; margin-bottom: 2mm; font-family: ui-monospace, SFMono-Regular, monospace; }
        .job-no { font-size: 8pt; font-weight: 700; color: #4f46e5; flex-shrink: 0; }
        .proj-sep { font-size: 8pt; color: #94a3b8; }
        .proj-title { font-size: 8pt; font-weight: 600; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-transform: uppercase; }
        .qr { width: 35mm; height: 35mm; margin: 0 auto 2mm auto; display: block; }
        .mark { font-size: 13pt; font-weight: 800; font-family: ui-monospace, SFMono-Regular, monospace; letter-spacing: 0.5px; color: #0f172a; margin-top: 1mm; }
        .prof { font-size: 8.5pt; font-weight: 600; color: #334155; margin-top: 1mm; }
        .heat { display: inline-block; background: #fff7ed; color: #c2410c; border: 1px solid #ffedd5; font-size: 7.5pt; font-weight: 700; font-family: ui-monospace, SFMono-Regular, monospace; padding: 1.5px 7px; border-radius: 3px; margin-top: 1.5mm; }
        .shop { display: inline-block; background: #e0e7ff; color: #3730a3; border: 1px solid #c7d2fe; font-size: 7.5pt; font-weight: 700; font-family: ui-monospace, SFMono-Regular, monospace; padding: 1.5px 7px; border-radius: 3px; margin-top: 1.5mm; margin-left: 1mm; }
        .meta { font-size: 7.5pt; color: #64748b; margin-top: 1mm; font-family: ui-monospace, SFMono-Regular, monospace; }
        .nopdf { font-size: 7.5pt; color: #dc2626; font-weight: 700; margin-top: 1.5mm; background: #fef2f2; padding: 1px 4px; border-radius: 2px; }
        .rev { font-size: 7.5pt; color: #16a34a; font-weight: 700; margin-top: 1.5mm; }
        @media print { body { margin: 0; } h2 { display: none; } }
      </style></head><body>
        <h2>FabSimple QR Code Sheet — ${sheetParts.length} parts</h2>
        <div class="grid">${sheetParts.map((p) => {
          const project = projectById.get(p.project_id);
          const count = pdfCount.get(p.id) ?? 0;
          const noPdf = count === 0;
          return `
          <div class="label">
            <div class="brand-hdr">
              <div class="brand-logo">
                <svg width="12" height="12" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="0" y="0" width="8" height="8" fill="#4f46e5" rx="1.5" />
                  <rect x="12" y="0" width="8" height="8" fill="#4f46e5" rx="1.5" opacity="0.5" />
                  <rect x="0" y="12" width="8" height="8" fill="#4f46e5" rx="1.5" opacity="0.5" />
                  <rect x="12" y="12" width="8" height="8" fill="#4f46e5" rx="1.5" opacity="0.85" />
                </svg>
                <span>FabSimple</span>
              </div>
            </div>
            ${(project?.number || project?.name) ? `
              <div class="proj-line">
                ${project?.number ? `<span class="job-no">JOB ${escapeHtml(project.number)}</span>` : ""}
                ${project?.number && project?.name ? `<span class="proj-sep">•</span>` : ""}
                ${project?.name ? `<span class="proj-title">${escapeHtml(project.name)}</span>` : ""}
              </div>
            ` : ""}
            ${qrPng[p.id] ? `<img class="qr" src="${qrPng[p.id]}" alt="QR ${escapeHtml(p.part_mark)}" />` : ""}
            <div class="mark">${escapeHtml(p.part_mark)}</div>
            <div class="prof">${escapeHtml(p.profile)}${p.grade ? ` · ${escapeHtml(p.grade)}` : ""}</div>
            <div class="heat">HEAT #: ${escapeHtml(p.heat_number || "Unassigned")}</div>
            <div class="shop">SHOP: ${escapeHtml(p.finish || "SHOP PRIMER")}</div>
            ${p.assembly_mark ? `<div class="meta">Asm: ${escapeHtml(p.assembly_mark)}${p.quantity != null ? ` · Qty: ${p.quantity}` : ""}</div>` : ""}
            ${noPdf
              ? `<div class="nopdf">⚠ NO DRAWING ATTACHED</div>`
              : `<div class="rev">DRAWING REV R${count - 1}</div>`}
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
          {/* Search Field */}
          <div className="relative flex items-center">
            <Search size={13} className="absolute left-2.5 pointer-events-none" style={{ color: "var(--muted)" }} />
            <input
              type="text"
              className="input text-xs"
              placeholder="Search QR codes / part mark..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={{ paddingLeft: 28, paddingRight: searchInput ? 26 : 10, width: 220, height: 32 }}
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                className="absolute right-2 p-0.5 text-slate-400 hover:text-white"
                title="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>

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

      {total > list.perPage && (
        <div className="flex items-center justify-between mb-6 text-[12px]" style={{ color: "var(--muted)" }}>
          <div>
            Page {list.page} · showing {rows.length} of {total}{attLoading ? " · checking attachments…" : ""}
          </div>
          <div className="flex items-center gap-2">
            <button className="btn btn-sm" disabled={list.page <= 1} onClick={() => list.setPage(list.page - 1)}>← Prev</button>
            <button className="btn btn-sm" disabled={!hasMore} onClick={() => list.setPage(list.page + 1)}>Next →</button>
          </div>
        </div>
      )}

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
          {search
            ? `No QR codes found matching "${search}".`
            : missingOnly
            ? "All visible parts already have a drawing PDF attached. Clear the filter to see everything."
            : "No parts found for the selected filter."}
        </div>
      ) : (
        <div className="grid-4 gap-md">
          {visible.map((p) => {
            const project = projectById.get(p.project_id);
            const count = pdfCount.get(p.id) ?? 0;
            const noPdf = count === 0;
            const isSelected = selected.has(p.id);
            return (
              <div
                key={p.id}
                className="card project-card group relative flex flex-col justify-between hover:z-30 transition-all duration-200"
                style={{
                  padding: "14px 14px 12px 14px",
                  border: noPdf
                    ? "1.5px solid rgba(220, 38, 38, 0.4)"
                    : isSelected
                    ? "1.5px solid var(--primary)"
                    : "1px solid var(--border)",
                  background: isSelected
                    ? "linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, var(--bg-card) 100%)"
                    : "var(--bg-card)",
                  boxShadow: isSelected ? "0 4px 20px rgba(99, 102, 241, 0.15)" : "var(--shadow-sm)",
                  cursor: "pointer",
                  borderRadius: 12,
                  overflow: "visible",
                }}
                onClick={() => toggle(p.id)}
              >
                {/* Header Bar inside card */}
                <div
                  className="flex items-center justify-between gap-2 border-b"
                  style={{
                    borderColor: "var(--border)",
                    paddingBottom: 8,
                    marginBottom: 10,
                  }}
                >
                  {/* Left: FabSimple branding logo */}
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div
                      className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                      style={{ background: "var(--primary-bg, rgba(99, 102, 241, 0.15))" }}
                    >
                      <svg width="11" height="11" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="0" y="0" width="8" height="8" fill="var(--primary)" rx="1.5" />
                        <rect x="12" y="0" width="8" height="8" fill="var(--primary)" rx="1.5" opacity="0.5" />
                        <rect x="0" y="12" width="8" height="8" fill="var(--primary)" rx="1.5" opacity="0.5" />
                        <rect x="12" y="12" width="8" height="8" fill="var(--primary)" rx="1.5" opacity="0.85" />
                      </svg>
                    </div>
                    <span className="text-[11px] font-bold tracking-tight truncate" style={{ color: "var(--text)" }}>
                      FabSimple
                    </span>
                  </div>

                  {/* Right: Selection Check & PDF attachment trigger */}
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {isSelected && (
                      <span className="w-4 h-4 rounded-full bg-indigo-500 text-white flex items-center justify-center">
                        <Check size={10} strokeWidth={3} />
                      </span>
                    )}

                    {/* Button wrapper with instant 0ms hover tooltip */}
                    <div className="relative group/tooltip">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setAttachTarget(p); }}
                        className="btn btn-sm"
                        style={{
                          padding: "2.5px 7px",
                          height: 23,
                          fontSize: 10,
                          background: noPdf ? "rgba(220,38,38,0.15)" : "rgba(22,163,74,0.15)",
                          color: noPdf ? "#ef4444" : "#22c55e",
                          border: noPdf ? "1px solid rgba(220,38,38,0.3)" : "1px solid rgba(22,163,74,0.3)",
                          display: "inline-flex", alignItems: "center", gap: 3,
                        }}
                      >
                        <Paperclip size={10} />
                        {noPdf ? (
                          <span>Missing</span>
                        ) : (
                          <span>R{count - 1}</span>
                        )}
                      </button>

                      {/* Instant Tooltip (0ms hover delay, opens downwards to avoid top boundary clipping) */}
                      <div className="absolute right-0 top-full mt-1.5 hidden group-hover/tooltip:flex flex-col items-end pointer-events-none z-50 whitespace-nowrap">
                        <div className="w-1.5 h-1.5 bg-slate-900 border-l border-t border-slate-700 rotate-45 mr-3 -mb-1 z-10" />
                        <div className="px-2.5 py-1.5 rounded-md bg-slate-900 border border-slate-700 text-slate-200 text-[10.5px] font-medium shadow-2xl">
                          {noPdf
                            ? "Add drawing PDF"
                            : `${count} drawing${count === 1 ? "" : "s"} attached (latest is R${count - 1}) — view / manage`}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Clean minimal project line (Job ID + Project Name) */}
                {(project?.number || project?.name) && (
                  <div className="flex items-center justify-center gap-1.5 text-center mx-auto mb-1 max-w-full px-1">
                    {project?.number && (
                      <span className="font-mono font-bold text-[10px] uppercase tracking-wider flex-shrink-0" style={{ color: "var(--primary)" }}>
                        Job {project.number}
                      </span>
                    )}
                    {project?.number && project?.name && (
                      <span className="text-[10px]" style={{ color: "var(--muted)" }}>•</span>
                    )}
                    {project?.name && (
                      <span className="text-[10.5px] font-semibold tracking-tight uppercase truncate" style={{ color: "var(--muted)" }} title={project.name}>
                        {project.name}
                      </span>
                    )}
                  </div>
                )}

                {/* Center: QR Code Display */}
                <div className="flex justify-center my-1">
                  <div
                    className="p-1.5 rounded-lg bg-white shadow-inner flex items-center justify-center transition-transform duration-200 group-hover:scale-[1.03]"
                    style={{ border: "1px solid rgba(255,255,255,0.2)" }}
                  >
                    <QRCodeCanvas value={partUrl(p.id)} size={96} level="H" includeMargin={true} />
                  </div>
                </div>

                {/* Bottom Details Section */}
                <div className="flex flex-col gap-1 mt-2.5 text-center">
                  {/* Part Mark */}
                  <div className="font-mono font-extrabold text-[15.5px] tracking-wide" style={{ color: "var(--text)" }}>
                    {p.part_mark}
                  </div>

                  {/* Profile & Grade */}
                  <div className="text-[11px] font-medium flex items-center justify-center gap-1.5 flex-wrap" style={{ color: "var(--muted)" }}>
                    <span>{p.profile}</span>
                    {p.grade && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/5 border border-white/10" style={{ color: "var(--muted)" }}>
                        {p.grade}
                      </span>
                    )}
                  </div>

                  {/* Heat Number & Shop Finish Badges */}
                  <div className="flex items-center justify-center gap-1.5 flex-wrap mt-1">
                    <div
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold"
                      style={{
                        background: p.heat_number ? "rgba(249, 115, 22, 0.15)" : "rgba(255, 255, 255, 0.04)",
                        color: p.heat_number ? "#fb923c" : "var(--muted)",
                        border: p.heat_number ? "1px solid rgba(249, 115, 22, 0.3)" : "1px solid var(--border)",
                      }}
                      title={p.heat_number ? `Heat Number: ${p.heat_number}` : "No Heat Number assigned"}
                    >
                      <Flame size={11} style={{ color: p.heat_number ? "#fb923c" : "var(--muted)" }} />
                      <span>Heat: {p.heat_number || "Unassigned"}</span>
                    </div>

                    <div
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold"
                      style={{
                        background: "rgba(99, 102, 241, 0.15)",
                        color: "#818cf8",
                        border: "1px solid rgba(99, 102, 241, 0.3)",
                      }}
                      title={`Shop Finish: ${p.finish || "SHOP PRIMER"}`}
                    >
                      <Paintbrush size={11} style={{ color: "#818cf8" }} />
                      <span>Shop: {p.finish || "SHOP PRIMER"}</span>
                    </div>
                  </div>

                  {/* Assembly & Quantity info */}
                  {(p.assembly_mark || p.quantity != null) && (
                    <div className="text-[10px] font-mono text-slate-400 flex items-center justify-center gap-2 mt-1">
                      {p.assembly_mark && <span>Asm: {p.assembly_mark}</span>}
                      {p.quantity != null && <span>Qty: {p.quantity}</span>}
                    </div>
                  )}
                </div>
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
                includeMargin={true}
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
