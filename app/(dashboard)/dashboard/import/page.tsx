"use client";

import { useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { useResourceList } from "@/hooks/useResource";
import { FabAPI } from "@/lib/api";
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle, Info } from "lucide-react";
import Papa from "papaparse";

interface Project { id: string; name: string; }

interface ImportResult {
  summary: { inserted: number; updated: number; skipped: number; errors: number; units: string };
  skipped: Array<{ row: number; part_mark?: string; reason: string }>;
  errors: Array<{ row: number; reason: string }>;
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
    try {
      const text = await file.text();
      const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
      const res = await FabAPI.importCsv({ project_id: projectId, rows: parsed.data, units });
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
        <div className="text-[20px] font-bold" style={{ color: "var(--text)" }}>Tekla / SDS2 CSV Import</div>
        <div className="text-[12px]" style={{ color: "var(--muted)" }}>Imports parts from BOM exports — auto-detects units and 9 column variants</div>
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
            <label className="text-[11px] uppercase font-semibold tracking-wider" style={{ color: "var(--muted)" }}>CSV file</label>
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
                id="csv-input"
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                style={{ display: "none" }}
              />
              <label htmlFor="csv-input" className="btn btn-primary" style={{ cursor: "pointer" }}>
                <Upload size={14} /> Choose CSV
              </label>
              {file && (
                <div className="text-[12px] mt-2" style={{ color: "var(--text)" }}>
                  Selected: <strong>{file.name}</strong> ({(file.size / 1024).toFixed(1)} KB)
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
