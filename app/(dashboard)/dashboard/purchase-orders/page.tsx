"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ResourceModal, Field } from "@/components/ui/ResourceModal";
import { useResourceList, useCreate, useUpdate } from "@/hooks/useResource";
import { Plus, Upload, FileSpreadsheet, X, ChevronLeft, ChevronRight, Download, Trash2, Eye, Search, ArrowUpDown, Send, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";

interface PoItem { profile?: string; grade?: string | null; qty?: number; unit_price?: number; }
interface PO {
  id: string; po_number: string; vendor: string; total_amount: number;
  status: string; issued_date: string | null; expected_date: string | null;
  qty_ordered: number | null; qty_received: number; project_id: string | null;
  rfq_id: string | null; items?: PoItem[] | null; notes?: string | null;
}
interface Project { id: string; name: string; }
interface RfqRef { id: string; rfq_number: string; }

const STATUSES = ["draft", "issued", "partial", "received", "closed"];

/* ── Parsed spreadsheet types ─────────────────────────────────────────── */
interface ParsedSheet {
  name: string;
  headers: string[];
  rows: (string | number | null)[][];
  merges?: XLSX.Range[];
}
interface ParsedWorkbook {
  filename: string;
  uploadedAt: string;
  sheets: ParsedSheet[];
  fileSize: number;
}

export default function PurchaseOrdersPage() {
  const list = useResourceList<PO>("purchase_orders", { order_by: "created_at", dir: "desc" });
  const projects = useResourceList<Project>("projects", { limit: "100" });
  // Only fetched to resolve the "via RFQ-xxxx" badge (§15.15) — most POs have
  // no rfq_id and this stays empty/unused for them.
  const rfqs = useResourceList<RfqRef>("rfqs", { limit: "500" });
  const rfqLookup = new Map((rfqs.data ?? []).map((r) => [r.id, r.rfq_number]));
  const create = useCreate<PO>("purchase_orders");
  const [showNew, setShowNew] = useState(false);
  const [detailPo, setDetailPo] = useState<PO | null>(null);

  /* ── Excel viewer state ─────────────────────────────────────────────── */
  const [workbooks, setWorkbooks] = useState<ParsedWorkbook[]>([]);
  const [activeWbIdx, setActiveWbIdx] = useState(0);
  const [activeSheetIdx, setActiveSheetIdx] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const fileRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [dragOver, setDragOver] = useState(false);

  /* ── Excel parsing ──────────────────────────────────────────────────── */
  const parseExcelFile = useCallback(async (file: File) => {
    setUploading(true);
    setUploadError(null);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array", cellDates: true, cellStyles: true });

      const sheets: ParsedSheet[] = wb.SheetNames.map((name) => {
        const ws = wb.Sheets[name];
        const jsonData: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, rawNumbers: true });

        // First non-empty row is headers
        let headerRowIdx = 0;
        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (row && row.some((c) => c !== null && c !== "")) {
            headerRowIdx = i;
            break;
          }
        }
        const rawHeaders = (jsonData[headerRowIdx] ?? []) as (string | number | null)[];
        const headers = rawHeaders.map((h, i) => {
          if (h === null || h === "") return `Col ${i + 1}`;
          return String(h);
        });

        const dataRows = jsonData.slice(headerRowIdx + 1).filter((row) =>
          (row as (string | number | null)[]).some((cell) => cell !== null && cell !== "")
        );

        const rows = dataRows.map((row) => {
          const r = row as (string | number | null)[];
          // Pad to match headers length
          while (r.length < headers.length) r.push(null);
          return r.slice(0, headers.length).map((cell) => {
            if (cell !== null && typeof cell === "object" && Object.prototype.toString.call(cell) === "[object Date]") {
              return (cell as unknown as Date).toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" });
            }
            return cell;
          });
        });

        return { name, headers, rows, merges: ws["!merges"] };
      });

      const parsed: ParsedWorkbook = {
        filename: file.name,
        uploadedAt: new Date().toLocaleString(),
        sheets,
        fileSize: file.size,
      };

      setWorkbooks((prev) => [...prev, parsed]);
      setActiveWbIdx(workbooks.length); // Select the newly added one
      setActiveSheetIdx(0);
      setViewerOpen(true);
      setSearchTerm("");
      setSortCol(null);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Failed to parse spreadsheet");
    } finally {
      setUploading(false);
    }
  }, [workbooks.length]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseExcelFile(file);
    e.target.value = "";
  }, [parseExcelFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith(".xlsx") || file.name.endsWith(".xls") || file.name.endsWith(".csv"))) {
      parseExcelFile(file);
    } else {
      setUploadError("Please drop a valid .xlsx, .xls, or .csv file");
    }
  }, [parseExcelFile]);

  const activeWb = workbooks[activeWbIdx] ?? null;
  const activeSheet = activeWb?.sheets[activeSheetIdx] ?? null;

  /* ── Filtering + sorting ────────────────────────────────────────────── */
  const filteredRows = useMemo(() => {
    if (!activeSheet) return [];
    let rows = activeSheet.rows;

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      rows = rows.filter((row) =>
        row.some((cell) => cell !== null && String(cell).toLowerCase().includes(term))
      );
    }

    // Sort
    if (sortCol !== null) {
      rows = [...rows].sort((a, b) => {
        const aVal = a[sortCol];
        const bVal = b[sortCol];
        if (aVal === null && bVal === null) return 0;
        if (aVal === null) return 1;
        if (bVal === null) return -1;
        const aNum = Number(aVal);
        const bNum = Number(bVal);
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return sortDir === "asc" ? aNum - bNum : bNum - aNum;
        }
        const cmp = String(aVal).localeCompare(String(bVal));
        return sortDir === "asc" ? cmp : -cmp;
      });
    }

    return rows;
  }, [activeSheet, searchTerm, sortCol, sortDir]);

  const handleSort = useCallback((colIdx: number) => {
    if (sortCol === colIdx) {
      setSortDir((d) => d === "asc" ? "desc" : "asc");
    } else {
      setSortCol(colIdx);
      setSortDir("asc");
    }
  }, [sortCol]);

  const removeWorkbook = useCallback((idx: number) => {
    setWorkbooks((prev) => prev.filter((_, i) => i !== idx));
    if (activeWbIdx >= idx && activeWbIdx > 0) setActiveWbIdx((p) => p - 1);
    if (workbooks.length <= 1) setViewerOpen(false);
  }, [activeWbIdx, workbooks.length]);

  /* ── PO table columns ───────────────────────────────────────────────── */
  const cols: Column<PO>[] = [
    {
      key: "num", label: "PO #", mono: true, render: (r) => (
        <span className="flex items-center gap-1.5">
          <strong>{r.po_number}</strong>
          {r.rfq_id && rfqLookup.has(r.rfq_id) && (
            <Link href={`/dashboard/rfqs/${r.rfq_id}`} className="pill" style={{ padding: "1px 6px", fontSize: 10 }} onClick={(e) => e.stopPropagation()}>
              via {rfqLookup.get(r.rfq_id)}
            </Link>
          )}
        </span>
      ),
    },
    { key: "vendor", label: "Vendor", render: (r) => r.vendor },
    { key: "amount", label: "Amount", align: "right", mono: true, render: (r) => `$${Number(r.total_amount).toLocaleString()}` },
    { key: "issued", label: "Issued", render: (r) => r.issued_date ? new Date(r.issued_date).toLocaleDateString() : "—" },
    { key: "expected", label: "Expected", render: (r) => r.expected_date ? new Date(r.expected_date).toLocaleDateString() : "—" },
    { key: "qty", label: "Qty (rcv/ord)", align: "right", mono: true, render: (r) => `${r.qty_received ?? 0} / ${r.qty_ordered ?? 0}` },
    { key: "status", label: "Status", render: (r) => <StatusPill status={r.status} /> },
  ];

  const totalOpen = (list.data ?? []).filter((p) => p.status !== "closed").reduce((s, p) => s + Number(p.total_amount ?? 0), 0);

  /* ── Helper: format file size ───────────────────────────────────────── */
  const fmtSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  /* ── Helper: detect numeric-ish column for right-align ──────────────── */
  const isNumericCol = useCallback((colIdx: number) => {
    if (!activeSheet) return false;
    let numCount = 0;
    const sample = activeSheet.rows.slice(0, 20);
    for (const row of sample) {
      const v = row[colIdx];
      if (v !== null && !isNaN(Number(v))) numCount++;
    }
    return numCount > sample.length * 0.5;
  }, [activeSheet]);

  /* ── Format cell value for display ──────────────────────────────────── */
  const fmtCell = (val: string | number | null, colIdx: number) => {
    if (val === null || val === "") return <span style={{ color: "var(--muted)", opacity: 0.4 }}>—</span>;
    if (typeof val === "number") {
      // Check if it looks like currency (header contains $, amount, cost, price, total)
      const hdr = activeSheet?.headers[colIdx]?.toLowerCase() ?? "";
      if (hdr.includes("$") || hdr.includes("amount") || hdr.includes("cost") || hdr.includes("price") || hdr.includes("total") || hdr.includes("value")) {
        return `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      }
      if (Number.isInteger(val)) return val.toLocaleString();
      return val.toLocaleString("en-US", { maximumFractionDigits: 4 });
    }
    return String(val);
  };

  return (
    <PageWrapper title="Purchase Orders">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="text-[20px] font-bold" style={{ color: "var(--text)" }}>Purchase Orders</div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>{list.data?.length ?? 0} POs · ${totalOpen.toLocaleString()} open commitments</div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-subtle flex items-center gap-1.5" onClick={() => fileRef.current?.click()}>
            <Upload size={14} /> Upload Excel
          </button>
          {workbooks.length > 0 && (
            <button className="btn btn-subtle flex items-center gap-1.5" onClick={() => setViewerOpen(!viewerOpen)}>
              <Eye size={14} /> {viewerOpen ? "Hide" : "View"} Sheets ({workbooks.length})
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setShowNew(true)}><Plus size={14} /> New PO</button>
        </div>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
      </div>

      {/* ── Upload Error Banner ────────────────────────────────────────── */}
      {uploadError && (
        <div className="mb-4 p-3 rounded-lg border flex items-center justify-between"
          style={{ background: "rgba(239,68,68,0.1)", borderColor: "rgba(239,68,68,0.3)", color: "#ef4444" }}>
          <span className="text-sm">{uploadError}</span>
          <button onClick={() => setUploadError(null)}><X size={14} /></button>
        </div>
      )}

      {/* ── Drop Zone (shown when no workbooks uploaded yet) ───────────── */}
      {workbooks.length === 0 && (
        <div
          ref={dropRef}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className="mb-6 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200"
          style={{
            borderColor: dragOver ? "var(--accent)" : "var(--border)",
            background: dragOver ? "rgba(99,102,241,0.06)" : "rgba(0,0,0,0.08)",
            padding: "48px 24px",
            textAlign: "center",
          }}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="rounded-xl p-4" style={{ background: "rgba(99,102,241,0.12)" }}>
              <FileSpreadsheet size={32} style={{ color: "var(--accent)" }} />
            </div>
            <div>
              <div className="text-[15px] font-semibold" style={{ color: "var(--text)" }}>
                {uploading ? "Parsing spreadsheet…" : "Drop your Purchase Order Excel here"}
              </div>
              <div className="text-[12px] mt-1" style={{ color: "var(--muted)" }}>
                Supports .xlsx, .xls, and .csv files · Click or drag & drop
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Excel Viewer Panel ─────────────────────────────────────────── */}
      {viewerOpen && activeWb && activeSheet && (
        <div className="mb-6 rounded-xl border overflow-hidden" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          {/* Workbook Tabs Bar */}
          <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: "var(--border)", background: "rgba(0,0,0,0.15)" }}>
            <div className="flex items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
              {workbooks.map((wb, i) => (
                <div key={i}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium cursor-pointer transition-all whitespace-nowrap"
                  style={{
                    background: activeWbIdx === i ? "var(--accent)" : "rgba(255,255,255,0.06)",
                    color: activeWbIdx === i ? "#fff" : "var(--muted)",
                  }}
                  onClick={() => { setActiveWbIdx(i); setActiveSheetIdx(0); setSearchTerm(""); setSortCol(null); }}
                >
                  <FileSpreadsheet size={12} />
                  <span style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis" }}>{wb.filename}</span>
                  <button className="ml-1 opacity-60 hover:opacity-100" onClick={(e) => { e.stopPropagation(); removeWorkbook(i); }}>
                    <X size={10} />
                  </button>
                </div>
              ))}
              <button
                className="flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium transition-all"
                style={{ color: "var(--accent)", background: "rgba(99,102,241,0.08)" }}
                onClick={() => fileRef.current?.click()}
              >
                <Plus size={11} /> Add
              </button>
            </div>
            <button onClick={() => setViewerOpen(false)} className="ml-2 p-1 rounded hover:bg-white/10">
              <X size={14} style={{ color: "var(--muted)" }} />
            </button>
          </div>

          {/* Sheet Info + Controls Bar */}
          <div className="flex items-center justify-between px-4 py-2 border-b flex-wrap gap-2" style={{ borderColor: "var(--border)", background: "rgba(0,0,0,0.08)" }}>
            <div className="flex items-center gap-3">
              <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                <span className="font-semibold" style={{ color: "var(--text)" }}>{activeWb.filename}</span>
                {" · "}{fmtSize(activeWb.fileSize)}
                {" · "}{activeSheet.rows.length} rows × {activeSheet.headers.length} cols
                {" · Uploaded "}{activeWb.uploadedAt}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }} />
                <input
                  className="input text-[12px] pl-7 py-1"
                  style={{ width: 180, height: 28 }}
                  placeholder="Search in sheet…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Sheet Tabs (if multiple sheets) */}
          {activeWb.sheets.length > 1 && (
            <div className="flex items-center gap-1 px-4 py-2 border-b overflow-x-auto" style={{ borderColor: "var(--border)", background: "rgba(0,0,0,0.04)" }}>
              {activeWb.sheets.map((s, i) => (
                <button
                  key={s.name}
                  className="px-3 py-1 rounded text-[11px] font-medium transition-all whitespace-nowrap"
                  style={{
                    background: activeSheetIdx === i ? "rgba(99,102,241,0.15)" : "transparent",
                    color: activeSheetIdx === i ? "var(--accent)" : "var(--muted)",
                    border: activeSheetIdx === i ? "1px solid rgba(99,102,241,0.3)" : "1px solid transparent",
                  }}
                  onClick={() => { setActiveSheetIdx(i); setSearchTerm(""); setSortCol(null); }}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}

          {/* Spreadsheet Table */}
          <div className="overflow-auto" style={{ maxHeight: 520 }}>
            <table className="w-full text-[12px]" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th className="sticky top-0 z-10 px-2 py-2 text-center font-bold text-[10px]"
                    style={{
                      background: "rgba(30,41,59,0.95)", color: "var(--muted)",
                      borderBottom: "2px solid var(--accent)", width: 36, minWidth: 36,
                    }}>
                    #
                  </th>
                  {activeSheet.headers.map((hdr, ci) => (
                    <th key={ci}
                      className="sticky top-0 z-10 px-3 py-2 text-left font-bold text-[11px] cursor-pointer select-none whitespace-nowrap"
                      style={{
                        background: "rgba(30,41,59,0.95)",
                        color: sortCol === ci ? "var(--accent)" : "var(--text)",
                        borderBottom: "2px solid var(--accent)",
                        textAlign: isNumericCol(ci) ? "right" : "left",
                        minWidth: 80,
                      }}
                      onClick={() => handleSort(ci)}
                    >
                      <span className="flex items-center gap-1" style={{ justifyContent: isNumericCol(ci) ? "flex-end" : "flex-start" }}>
                        {hdr}
                        {sortCol === ci && (
                          <ArrowUpDown size={10} style={{ color: "var(--accent)", opacity: 0.8 }} />
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={activeSheet.headers.length + 1} className="text-center py-12"
                      style={{ color: "var(--muted)" }}>
                      {searchTerm ? "No rows match your search" : "Empty sheet"}
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, ri) => (
                    <tr key={ri}
                      className="transition-colors"
                      style={{
                        background: ri % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)",
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(99,102,241,0.06)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = ri % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)")}
                    >
                      <td className="px-2 py-1.5 text-center font-mono text-[10px]"
                        style={{ color: "var(--muted)", opacity: 0.5, borderRight: "1px solid rgba(255,255,255,0.05)" }}>
                        {ri + 1}
                      </td>
                      {row.map((cell, ci) => (
                        <td key={ci}
                          className="px-3 py-1.5"
                          style={{
                            color: cell === null ? "var(--muted)" : "var(--text)",
                            textAlign: isNumericCol(ci) ? "right" : "left",
                            fontFamily: isNumericCol(ci) ? "var(--font-mono, monospace)" : "inherit",
                            whiteSpace: "nowrap",
                            maxWidth: 280,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {fmtCell(cell, ci)}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2 border-t" style={{ borderColor: "var(--border)", background: "rgba(0,0,0,0.08)" }}>
            <div className="text-[11px]" style={{ color: "var(--muted)" }}>
              Showing {filteredRows.length} of {activeSheet.rows.length} rows
              {searchTerm && ` · Filtered by "${searchTerm}"`}
            </div>
            <div className="flex items-center gap-2">
              <button
                className="btn btn-subtle text-[11px] flex items-center gap-1"
                style={{ padding: "4px 10px" }}
                onClick={() => removeWorkbook(activeWbIdx)}
              >
                <Trash2 size={11} /> Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Existing PO Table ──────────────────────────────────────────── */}
      <DataTable data={list.data} columns={cols} loading={list.isLoading} error={list.error}
        empty={{ title: "No purchase orders yet" }} rowKey={(r) => r.id}
        onRowClick={(r) => setDetailPo(r)}
      />

      {showNew && (
        <NewModal projects={projects.data ?? []} onClose={() => setShowNew(false)}
          onSubmit={(p) => create.mutate(p, { onSuccess: () => setShowNew(false) })}
          submitting={create.isPending} error={create.error?.message ?? null}
        />
      )}

      {detailPo && <PoDetailModal po={detailPo} onClose={() => setDetailPo(null)} />}
    </PageWrapper>
  );
}

function NewModal({ projects, onClose, onSubmit, submitting, error }: {
  projects: Project[]; onClose: () => void;
  onSubmit: (p: Record<string, unknown>) => void; submitting: boolean; error: string | null;
}) {
  const [f, setF] = useState({
    project_id: "", vendor: "", total_amount: "", qty_ordered: "", status: "draft",
    issued_date: "", expected_date: "", notes: "",
  });
  return (
    <ResourceModal title="New purchase order" onClose={onClose} submitting={submitting} error={error}
      onSubmit={(e) => { e.preventDefault();
        onSubmit({
          project_id: f.project_id || undefined,
          vendor: f.vendor, total_amount: Number(f.total_amount || 0),
          qty_ordered: f.qty_ordered ? Number(f.qty_ordered) : undefined,
          status: f.status, issued_date: f.issued_date || undefined,
          expected_date: f.expected_date || undefined,
          notes: f.notes || undefined,
        });
      }}
    >
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Project">
          <select className="input" value={f.project_id} onChange={(e) => setF({ ...f, project_id: e.target.value })}>
            <option value="">—</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Vendor" required>
          <input className="input" required value={f.vendor} onChange={(e) => setF({ ...f, vendor: e.target.value })} placeholder="Triple S Steel" />
        </Field>
      </div>
      <div className="grid-3" style={{ gap: 12 }}>
        <Field label="Amount ($)" required>
          <input className="input" type="number" step="0.01" required value={f.total_amount} onChange={(e) => setF({ ...f, total_amount: e.target.value })} />
        </Field>
        <Field label="Qty ordered"><input className="input" type="number" step="0.01" value={f.qty_ordered} onChange={(e) => setF({ ...f, qty_ordered: e.target.value })} /></Field>
        <Field label="Status">
          <select className="input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
      </div>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Issued date"><input className="input" type="date" value={f.issued_date} onChange={(e) => setF({ ...f, issued_date: e.target.value })} /></Field>
        <Field label="Expected date"><input className="input" type="date" value={f.expected_date} onChange={(e) => setF({ ...f, expected_date: e.target.value })} /></Field>
      </div>
      <Field label="Notes">
        <textarea className="input" rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} style={{ height: "auto", padding: "8px 12px", resize: "vertical" }} />
      </Field>
    </ResourceModal>
  );
}

// Review-before-issue is the missing step for a "draft" PO (spec D3 deliberately
// keeps po_status to draft/issued/partial/received/closed — no separate
// approval states — so "review & approve" here just means: look at what's
// about to be ordered, then move it from draft to issued). Once issued, the
// Receiving page (app/(dashboard)/dashboard/receiving/page.tsx) owns the rest
// of the lifecycle (partial/received), so this modal doesn't touch those.
function PoDetailModal({ po, onClose }: { po: PO; onClose: () => void }) {
  const updatePo = useUpdate<PO>("purchase_orders");
  const items = Array.isArray(po.items) ? po.items : [];

  function issue() {
    updatePo.mutate(
      { id: po.id, body: { status: "issued", issued_date: po.issued_date ?? new Date().toISOString().slice(0, 10) } },
      { onSuccess: onClose },
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(15,23,42,0.5)" }}>
      <div className="card" style={{ width: 640, maxHeight: "90vh", overflowY: "auto" }}>
        <div className="card-header" style={{ position: "sticky", top: 0, zIndex: 5, background: "var(--bg-card)" }}>
          <div>
            <div className="card-title flex items-center gap-2">
              <span className="font-mono">{po.po_number}</span>
              <StatusPill status={po.status} />
            </div>
            <div className="card-sub">{po.vendor}</div>
          </div>
          <button type="button" onClick={onClose} className="btn btn-sm" style={{ padding: 6, height: 28, width: 28, justifyContent: "center" }}>
            <X size={14} />
          </button>
        </div>
        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {po.status === "draft" && (
            <div className="p-3 rounded-lg border flex items-center gap-3" style={{ background: "rgba(217,119,6,0.08)", borderColor: "rgba(217,119,6,0.3)" }}>
              <span className="text-[12px]" style={{ color: "var(--text)", flex: 1 }}>
                This PO hasn&apos;t been reviewed or sent to the vendor yet. Issuing it locks in the order and makes it visible on Receiving.
              </span>
              <button className="btn btn-sm btn-primary" disabled={updatePo.isPending} onClick={issue}>
                {updatePo.isPending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                Issue PO
              </button>
            </div>
          )}
          {updatePo.error && <div className="pill pill-red" style={{ padding: "8px 12px", fontSize: 12 }}>{updatePo.error.message}</div>}

          <div className="grid-3" style={{ gap: 10 }}>
            <div className="info-cell">
              <div className="text-[11px]" style={{ color: "var(--muted)" }}>Amount</div>
              <div className="text-[13px] font-mono">${Number(po.total_amount).toLocaleString()}</div>
            </div>
            <div className="info-cell">
              <div className="text-[11px]" style={{ color: "var(--muted)" }}>Qty (rcv/ord)</div>
              <div className="text-[13px] font-mono">{po.qty_received ?? 0} / {po.qty_ordered ?? 0}</div>
            </div>
            <div className="info-cell">
              <div className="text-[11px]" style={{ color: "var(--muted)" }}>Expected</div>
              <div className="text-[13px]">{po.expected_date ? new Date(po.expected_date).toLocaleDateString() : "—"}</div>
            </div>
          </div>

          {items.length > 0 && (
            <div>
              <div className="text-[11px] uppercase font-semibold tracking-wider mb-1.5" style={{ color: "var(--muted)" }}>Items</div>
              <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                <table className="w-full text-[12px]" style={{ borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      <th className="text-left p-2">Profile</th>
                      <th className="text-left p-2">Grade</th>
                      <th className="text-right p-2">Qty</th>
                      <th className="text-right p-2">Unit price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, i) => (
                      <tr key={i} style={{ borderBottom: i < items.length - 1 ? "1px solid var(--border)" : undefined }}>
                        <td className="p-2">{it.profile ?? "—"}</td>
                        <td className="p-2">{it.grade ?? "—"}</td>
                        <td className="text-right p-2 font-mono">{it.qty ?? "—"}</td>
                        <td className="text-right p-2 font-mono">{it.unit_price != null ? `$${Number(it.unit_price).toFixed(2)}` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {po.notes && (
            <div>
              <div className="text-[11px] uppercase font-semibold tracking-wider mb-1.5" style={{ color: "var(--muted)" }}>Notes</div>
              <div className="text-[12px]" style={{ color: "var(--text)" }}>{po.notes}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
