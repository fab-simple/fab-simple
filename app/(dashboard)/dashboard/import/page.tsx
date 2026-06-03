"use client";

import { useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { useResourceList } from "@/hooks/useResource";
import { FabAPI } from "@/lib/api";
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle, Info } from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";

interface Project { id: string; name: string; }

interface ImportResult {
  summary: { inserted: number; updated: number; skipped: number; errors: number; units: string };
  skipped: Array<{ row: number; part_mark?: string; reason: string }>;
  errors: Array<{ row: number; reason: string }>;
  mapping?: { matched_fields: string[]; unmapped_headers: string[] };
}

// Accepted extensions (kept in sync with <input accept=...>). The importer
// auto-detects which parser to use from the extension so Excel exports from
// Tekla / SDS2 can be uploaded without a manual CSV conversion step.
const ACCEPT_EXT = ".csv,.tsv,.txt,.xlsx,.xls";
const ACCEPT_MIME =
  "text/csv,text/tab-separated-values,text/plain," +
  "application/vnd.ms-excel," +
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function isExcelFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".xlsx") || name.endsWith(".xls");
}

function dropBlankRows(rows: Record<string, string>[]): Record<string, string>[] {
  return rows.filter((r) => Object.values(r).some((v) => v && v.trim() !== ""));
}

// Real-world Tekla / SDS2 exports almost always wrap the BOM with a title +
// metadata preamble:
//
//     ASSEMBLY LIST
//     PROJECT NAME: Austin Chinese Church   Date: 05/18/2026
//     JOB NUMBER:   25-305                  Time: 02:19:38pm
//     Mark  Qty  Profile  NAME  Ext. Area  Unit. Weight  Ext. Weight  Finish
//     1001AB1  4  RB3/4"  ANCHOR ROD  ...
//
// To handle that without making the user pre-clean their exports, we scan the
// first 30 rows for the one that *looks* like a header (≥2 cells match a known
// BOM field keyword) and treat that as row 0.
const HEADER_HINTS = new Set([
  // part identity
  "mark", "partmark", "piecemark", "pieceid", "partid", "partpos", "memberid", "membermark",
  // assembly / name
  "assembly", "assemblymark", "assemblypos", "mainpart", "name",
  // section / material
  "profile", "section", "shape", "size", "profilename", "sectionsize",
  "material", "grade", "spec", "matl", "materialgrade",
  // geometry
  "length", "len", "lengthmm", "lengthin", "cutlength",
  "weight", "wt", "weightlbs", "weightkg", "weightea",
  "extweight", "extendedweight", "totalweight", "unitweight",
  "extarea", "surfacearea", "paintarea",
  // qty
  "qty", "quantity", "count", "pcs", "pieces", "noofpieces",
  // process / tracking
  "phase", "lot", "sequence", "seq", "lotnumber",
  "heat", "heatno", "heatnumber",
  "finish", "paint", "coating",
]);

const normHeader = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

function detectHeaderRowIdx(matrix: string[][]): number {
  let bestIdx = 0;
  let bestScore = 0;
  const max = Math.min(matrix.length, 30);
  for (let i = 0; i < max; i++) {
    const row = matrix[i] ?? [];
    let score = 0;
    for (const cell of row) {
      if (!cell) continue;
      if (HEADER_HINTS.has(normHeader(String(cell)))) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  // ≥2 matches required; otherwise assume there's no preamble and use row 0.
  return bestScore >= 2 ? bestIdx : 0;
}

function matrixToRows(matrix: string[][], headerIdx: number): Record<string, string>[] {
  const headers = (matrix[headerIdx] ?? []).map((h) => String(h ?? "").trim());
  const out: Record<string, string>[] = [];
  for (let i = headerIdx + 1; i < matrix.length; i++) {
    const cells = matrix[i] ?? [];
    const obj: Record<string, string> = {};
    let anyValue = false;
    for (let j = 0; j < headers.length; j++) {
      const h = headers[j];
      if (!h) continue; // skip unlabeled columns (often trailing blanks)
      const raw = cells[j];
      const v = raw == null ? "" : String(raw).trim();
      if (v !== "") anyValue = true;
      obj[h] = v;
    }
    if (anyValue) out.push(obj);
  }
  return out;
}

// XLSX export → JSON rows. We force every cell to a string so the backend's
// column-alias matcher (which calls String(v).trim()) keeps working unchanged
// — Excel otherwise hands us Date objects for date columns and numbers for
// numeric columns, which breaks downstream parsing.
async function parseExcelRows(file: File): Promise<Record<string, string>[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  // Use the first sheet by default. Tekla/SDS2 exports put the BOM on sheet 1;
  // if a customer reports a multi-sheet export we'll add a picker.
  const firstSheetName = wb.SheetNames[0];
  if (!firstSheetName) return [];
  const sheet = wb.Sheets[firstSheetName];
  // Parse as a 2D matrix so we can auto-detect where the real header row lives.
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: false,
  }).map((row) => (row as unknown[]).map((c) => (c == null ? "" : String(c))));
  const headerIdx = detectHeaderRowIdx(matrix);
  return dropBlankRows(matrixToRows(matrix, headerIdx));
}

async function parseCsvRows(file: File): Promise<Record<string, string>[]> {
  const text = await file.text();
  // Parse without a header row so we can run the same preamble detection that
  // we use for Excel — Tekla also produces CSVs with title/metadata banners.
  const parsed = Papa.parse<string[]>(text, { header: false, skipEmptyLines: true });
  const matrix = (parsed.data as string[][]).map((row) => row.map((c) => String(c ?? "")));
  const headerIdx = detectHeaderRowIdx(matrix);
  return dropBlankRows(matrixToRows(matrix, headerIdx));
}

export default function ImportPage() {
  const projects = useResourceList<Project>("projects", { limit: "100" });
  const [projectId, setProjectId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [units, setUnits] = useState<"auto" | "imperial" | "metric">("auto");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleImport() {
    if (!file || !projectId) return;
    setImporting(true);
    setError(null);
    setResult(null);
    try {
      const rows = isExcelFile(file)
        ? await parseExcelRows(file)
        : await parseCsvRows(file);
      if (rows.length === 0) {
        throw new Error("No rows found in file. Check that the first row contains column headers.");
      }
      const res = await FabAPI.importCsv({ project_id: projectId, rows, units });
      setResult(res as ImportResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <PageWrapper title="Import">
      <div className="mb-6">
        <div className="text-[20px] font-bold" style={{ color: "var(--text)" }}>Tekla / SDS2 Import</div>
        <div className="text-[12px]" style={{ color: "var(--muted)" }}>Imports parts from BOM exports (CSV or XLSX) — auto-detects units and 9 column variants</div>
      </div>

      <div className="card">
        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label className="text-[11px] uppercase font-semibold tracking-wider" style={{ color: "var(--muted)" }}>Project</label>
            <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)} style={{ marginTop: 4 }}>
              <option value="">— select project —</option>
              {projects.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div>
            <label className="text-[11px] uppercase font-semibold tracking-wider" style={{ color: "var(--muted)" }}>Units</label>
            <select className="input" value={units} onChange={(e) => setUnits(e.target.value as "auto" | "imperial" | "metric")} style={{ marginTop: 4 }}>
              <option value="auto">Auto-detect</option>
              <option value="imperial">Imperial (in / lb)</option>
              <option value="metric">Metric (mm / kg)</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] uppercase font-semibold tracking-wider" style={{ color: "var(--muted)" }}>BOM file</label>
            <div style={{
              marginTop: 4,
              border: "2px dashed var(--border)",
              borderRadius: 8,
              padding: 24,
              textAlign: "center",
              background: "var(--bg-muted)",
            }}>
              <FileText size={24} style={{ margin: "0 auto", color: "var(--muted)", marginBottom: 8 }} />
              <input
                id="bom-input"
                type="file"
                accept={`${ACCEPT_EXT},${ACCEPT_MIME}`}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                style={{ display: "none" }}
              />
              <label htmlFor="bom-input" className="btn btn-primary" style={{ cursor: "pointer" }}>
                <Upload size={14} /> Choose file
              </label>
              <div className="text-[11px] mt-2" style={{ color: "var(--muted)" }}>
                Accepts <code>.csv</code>, <code>.tsv</code>, <code>.xlsx</code>, <code>.xls</code>
              </div>
              {file && (
                <div className="text-[12px] mt-2" style={{ color: "var(--text)" }}>
                  Selected: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
                  <span className="pill" style={{ marginLeft: 8, fontSize: 10 }}>
                    {isExcelFile(file) ? "XLSX" : "CSV"}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            {error && <span className="pill pill-red" style={{ padding: "6px 10px", fontSize: 12 }}>{error}</span>}
            <button className="btn btn-primary" disabled={!file || !projectId || importing} onClick={handleImport}>
              {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {importing ? "Importing…" : "Import parts"}
            </button>
          </div>
        </div>
      </div>

      {result && (
        <div className="card mt-section">
          <div className="card-header">
            <div className="card-title">Import results</div>
            <span className="pill" style={{ fontSize: 10 }}>Units: {result.summary.units}</span>
          </div>
          <div className="card-body">
            <div className="grid-4" style={{ gap: 12, marginBottom: 16 }}>
              <Tally label="Inserted" value={result.summary.inserted} icon={<CheckCircle2 size={14} style={{ color: "#16A34A" }} />} />
              <Tally label="Updated"  value={result.summary.updated}  icon={<Info size={14} style={{ color: "#2563EB" }} />} />
              <Tally label="Skipped"  value={result.summary.skipped}  icon={<AlertCircle size={14} style={{ color: "#D97706" }} />} />
              <Tally label="Errors"   value={result.summary.errors}   icon={<AlertCircle size={14} style={{ color: "#DC2626" }} />} />
            </div>
            {result.mapping && (result.mapping.matched_fields.length > 0 || result.mapping.unmapped_headers.length > 0) && (
              <div style={{
                background: "var(--bg-muted)",
                borderRadius: 6,
                padding: "10px 12px",
                marginBottom: 16,
                display: "flex",
                gap: 18,
                flexWrap: "wrap",
                fontSize: 12,
              }}>
                {result.mapping.matched_fields.length > 0 && (
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div className="text-[11px] uppercase font-semibold tracking-wider" style={{ color: "var(--muted)", marginBottom: 4 }}>
                      Mapped columns ({result.mapping.matched_fields.length})
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {result.mapping.matched_fields.map((f) => (
                        <span key={f} className="pill" style={{ fontSize: 10, background: "#DCFCE7", color: "#166534" }}>
                          {f}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {result.mapping.unmapped_headers.length > 0 && (
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <div className="text-[11px] uppercase font-semibold tracking-wider" style={{ color: "var(--muted)", marginBottom: 4 }}>
                      Ignored columns ({result.mapping.unmapped_headers.length})
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {result.mapping.unmapped_headers.map((h) => (
                        <span key={h} className="pill" style={{ fontSize: 10, background: "#FEF3C7", color: "#92400E" }}>
                          {h}
                        </span>
                      ))}
                    </div>
                    <div className="text-[11px]" style={{ color: "var(--muted)", marginTop: 4 }}>
                      We don&apos;t have a destination field for these yet — they were preserved in the BOM file but skipped on import.
                    </div>
                  </div>
                )}
              </div>
            )}
            {result.skipped.length > 0 && (
              <details>
                <summary className="text-[13px] font-semibold cursor-pointer" style={{ color: "var(--text)" }}>
                  Skipped rows ({result.skipped.length})
                </summary>
                <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
                  {result.skipped.map((s, i) => (
                    <div key={i} className="flex gap-2 py-1" style={{ borderBottom: "1px solid var(--bg-muted)" }}>
                      <span style={{ width: 50 }}>row {s.row}</span>
                      <span style={{ flex: 1 }}>{s.part_mark} — {s.reason}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
            {result.errors.length > 0 && (
              <details style={{ marginTop: 8 }}>
                <summary className="text-[13px] font-semibold cursor-pointer" style={{ color: "#DC2626" }}>
                  Errors ({result.errors.length})
                </summary>
                <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
                  {result.errors.map((e, i) => (
                    <div key={i} className="flex gap-2 py-1" style={{ borderBottom: "1px solid var(--bg-muted)" }}>
                      <span style={{ width: 50 }}>row {e.row}</span>
                      <span>{e.reason}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        </div>
      )}
    </PageWrapper>
  );
}

function Tally({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="stat-card">
      <div className="stat-label flex items-center gap-1.5">{icon} {label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}
