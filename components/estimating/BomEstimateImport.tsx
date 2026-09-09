"use client";

// =============================================================================
// BOM Estimate Import — 3-step wizard modal
//
// Step 1: Upload & Detect — drag-and-drop or file picker
// Step 2: Review Parsed Data — material summary, bolt summary, warnings
// Step 3: Create Estimate — pre-fills estimate form with parsed data
// =============================================================================

import { useState, useRef, useCallback } from "react";
import {
  Upload, FileSpreadsheet, FileText, Loader2, CheckCircle2,
  AlertCircle, ChevronRight, ChevronLeft, X, Sparkles,
  Package, Wrench, Hammer, Info, Search, ListFilter,
} from "lucide-react";
import { importFileForEstimate } from "@/lib/parsers/bom-aggregator";
import type { ParsedBomResult, AggregatedEstimate, AggregatedMaterial } from "@/lib/parsers/types";
import { formatFeetInches } from "@/lib/parsers/types";

const ACCEPTED_EXTENSIONS = ".kss,.kis,.eje,.csv,.tsv,.txt,.xlsx,.xls";
const ACCEPTED_MIME =
  "text/csv,text/tab-separated-values,text/plain," +
  "application/vnd.ms-excel," +
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

interface BomEstimateImportProps {
  onClose: () => void;
  onImport: (aggregated: AggregatedEstimate) => void;
}

export function BomEstimateImport({ onClose, onImport }: BomEstimateImportProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedBomResult | null>(null);
  const [aggregated, setAggregated] = useState<AggregatedEstimate | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Editable pricing on Step 2
  const [editableMaterials, setEditableMaterials] = useState<AggregatedMaterial[]>([]);
  const [reviewTab, setReviewTab] = useState<"summary" | "members">("summary");
  const [memberSearch, setMemberSearch] = useState("");

  const handleFile = useCallback(async (f: File) => {
    setFile(f);
    setParseError(null);
    setParsing(true);

    try {
      const result = await importFileForEstimate(f);
      setParsed(result.parsed);
      setAggregated(result.aggregated);
      setEditableMaterials(result.aggregated.materials_breakdown.map((m) => ({ ...m })));
      setStep(2);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Failed to parse file");
    } finally {
      setParsing(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile],
  );

  const handleConfirmImport = () => {
    if (!aggregated) return;
    // Apply edited pricing
    const finalAggregated: AggregatedEstimate = {
      ...aggregated,
      materials_breakdown: editableMaterials,
    };
    onImport(finalAggregated);
  };

  const totalTons = editableMaterials.reduce((s, m) => s + m.tons, 0);
  const totalMaterialCost = editableMaterials.reduce((s, m) => s + m.tons * m.price_per_ton, 0);
  const totalBolts = parsed?.bolts.reduce((s, b) => s + b.quantity, 0) ?? 0;

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
      }}
    >
      <div
        style={{
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: 12, width: 780, maxHeight: "85vh", overflow: "auto",
          boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between"
          style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-3">
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: "linear-gradient(135deg, #3B82F6, #8B5CF6)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <FileSpreadsheet size={18} color="white" />
            </div>
            <div>
              <div className="font-bold text-sm" style={{ color: "var(--text)" }}>
                Import BOM for Estimating
              </div>
              <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                KISS (.kss) · EJE (.eje) · Tekla CSV/XLSX
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-sm"
            style={{ border: "none", padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Step indicator */}
        <div
          className="flex items-center gap-1"
          style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)", background: "var(--bg-muted)" }}
        >
          {[
            { n: 1, label: "Upload File" },
            { n: 2, label: "Review Data" },
            { n: 3, label: "Create Estimate" },
          ].map((s, i) => (
            <div key={s.n} className="flex items-center gap-1">
              {i > 0 && <ChevronRight size={12} style={{ color: "var(--muted)", margin: "0 4px" }} />}
              <div
                className="flex items-center gap-1.5 text-[11px] font-semibold"
                style={{
                  color: step >= s.n ? "var(--primary)" : "var(--muted)",
                  padding: "4px 10px",
                  borderRadius: 20,
                  background: step === s.n ? "rgba(59,130,246,0.1)" : "transparent",
                }}
              >
                <div
                  style={{
                    width: 18, height: 18, borderRadius: "50%", fontSize: 10,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: step >= s.n ? "var(--primary)" : "var(--border)",
                    color: step >= s.n ? "white" : "var(--muted)",
                    fontWeight: 700,
                  }}
                >
                  {step > s.n ? <CheckCircle2 size={11} /> : s.n}
                </div>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: 20 }}>
          {/* Step 1: Upload */}
          {step === 1 && (
            <div>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                style={{
                  border: `2px dashed ${dragOver ? "var(--primary)" : "var(--border)"}`,
                  borderRadius: 10,
                  padding: 40,
                  textAlign: "center",
                  background: dragOver ? "rgba(59,130,246,0.05)" : "var(--bg-muted)",
                  transition: "all 150ms",
                  cursor: "pointer",
                }}
                onClick={() => inputRef.current?.click()}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept={`${ACCEPTED_EXTENSIONS},${ACCEPTED_MIME}`}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                  style={{ display: "none" }}
                />

                {parsing ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 size={32} className="animate-spin" style={{ color: "var(--primary)" }} />
                    <div className="text-sm font-medium" style={{ color: "var(--text)" }}>
                      Parsing {file?.name}...
                    </div>
                  </div>
                ) : (
                  <>
                    <Upload size={32} style={{ margin: "0 auto", color: "var(--muted)", marginBottom: 12 }} />
                    <div className="text-sm font-semibold mb-1" style={{ color: "var(--text)" }}>
                      Drop your BOM file here
                    </div>
                    <div className="text-[12px]" style={{ color: "var(--muted)" }}>
                      or click to browse
                    </div>
                    <div className="flex items-center justify-center gap-2 mt-4">
                      {[
                        { ext: ".kss", label: "KISS", color: "#3B82F6" },
                        { ext: ".eje", label: "EJE", color: "#8B5CF6" },
                        { ext: ".csv", label: "CSV", color: "#10B981" },
                        { ext: ".xlsx", label: "XLSX", color: "#F59E0B" },
                      ].map((f) => (
                        <span
                          key={f.ext}
                          className="text-[10px] font-bold uppercase tracking-wider"
                          style={{
                            padding: "3px 8px", borderRadius: 4,
                            background: `${f.color}15`, color: f.color,
                            border: `1px solid ${f.color}30`,
                          }}
                        >
                          {f.label}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {parseError && (
                <div
                  className="flex items-start gap-2 mt-4 p-3 rounded-lg text-[12px]"
                  style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444" }}
                >
                  <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                  {parseError}
                </div>
              )}

              <div className="mt-4 p-3 rounded-lg" style={{ background: "var(--bg-muted)", border: "1px solid var(--border)" }}>
                <div className="text-[11px] font-semibold mb-2" style={{ color: "var(--muted)" }}>SUPPORTED FORMATS</div>
                <div className="grid grid-cols-2 gap-2 text-[11px]" style={{ color: "var(--text)" }}>
                  <div className="flex items-start gap-2">
                    <FileText size={12} className="mt-0.5 flex-shrink-0" style={{ color: "#3B82F6" }} />
                    <div><strong>KISS (.kss)</strong> — SDS2 / Tekla KISS export with members, plates, bolts</div>
                  </div>
                  <div className="flex items-start gap-2">
                    <FileText size={12} className="mt-0.5 flex-shrink-0" style={{ color: "#8B5CF6" }} />
                    <div><strong>EJE (.eje)</strong> — E.J.E. Industries format, fixed-width or delimited</div>
                  </div>
                  <div className="flex items-start gap-2">
                    <FileSpreadsheet size={12} className="mt-0.5 flex-shrink-0" style={{ color: "#10B981" }} />
                    <div><strong>CSV / TSV</strong> — Tekla BOM report, any steel spreadsheet</div>
                  </div>
                  <div className="flex items-start gap-2">
                    <FileSpreadsheet size={12} className="mt-0.5 flex-shrink-0" style={{ color: "#F59E0B" }} />
                    <div><strong>Excel (.xlsx)</strong> — SDS2 / Tekla material list export</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Review */}
          {step === 2 && parsed && aggregated && (
            <div className="flex flex-col gap-4">
              {/* File info */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="text-[10px] font-bold uppercase tracking-wider"
                    style={{
                      padding: "3px 8px", borderRadius: 4,
                      background: "rgba(59,130,246,0.1)", color: "var(--primary)",
                      border: "1px solid rgba(59,130,246,0.3)",
                    }}
                  >
                    {parsed.source.toUpperCase()}
                  </span>
                  <span className="text-[12px] font-medium" style={{ color: "var(--text)" }}>{parsed.filename}</span>
                </div>
                <button
                  type="button"
                  className="btn btn-sm text-[11px]"
                  onClick={() => { setStep(1); setFile(null); setParsed(null); setAggregated(null); }}
                >
                  Choose different file
                </button>
              </div>

              {/* Project info */}
              {(parsed.project.jobName || parsed.project.jobNumber || parsed.project.customer) && (
                <div className="card p-3" style={{ border: "1px solid var(--border)" }}>
                  <div className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--muted)" }}>
                    PROJECT INFO FROM FILE
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[12px]">
                    {parsed.project.jobName && (
                      <div><span style={{ color: "var(--muted)" }}>Name:</span> <strong>{parsed.project.jobName}</strong></div>
                    )}
                    {parsed.project.jobNumber && (
                      <div><span style={{ color: "var(--muted)" }}>Job #:</span> <strong>{parsed.project.jobNumber}</strong></div>
                    )}
                    {parsed.project.customer && (
                      <div><span style={{ color: "var(--muted)" }}>Customer:</span> <strong>{parsed.project.customer}</strong></div>
                    )}
                  </div>
                </div>
              )}

              {/* Summary stats */}
              <div className="grid grid-cols-4 gap-3">
                <StatCard icon={<Package size={14} />} label="Total Tons" value={totalTons.toFixed(2)} color="#3B82F6" />
                <StatCard icon={<Wrench size={14} />} label="Unique Marks" value={String(aggregated.unique_piece_marks)} color="#8B5CF6" />
                <StatCard icon={<Hammer size={14} />} label="Total Bolts" value={totalBolts.toLocaleString()} color="#F59E0B" />
                <StatCard
                  icon={<Sparkles size={14} />}
                  label="Complexity"
                  value={aggregated.connection_complexity.replace(/_/g, " ")}
                  color="#10B981"
                />
              </div>

              {/* View mode tab switcher */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className={`btn btn-sm text-xs ${reviewTab === "summary" ? "btn-primary" : "btn-outline"}`}
                    onClick={() => setReviewTab("summary")}
                  >
                    <FileSpreadsheet size={13} /> Shape Summary & Pricing
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm text-xs ${reviewTab === "members" ? "btn-primary" : "btn-outline"}`}
                    onClick={() => setReviewTab("members")}
                  >
                    <ListFilter size={13} /> Itemized Members ({parsed.members.length} items)
                  </button>
                </div>
                {reviewTab === "members" && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-xs">
                    <Search size={12} className="text-slate-400" />
                    <input
                      type="text"
                      placeholder="Filter mark or section..."
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      className="bg-transparent border-none outline-none text-xs w-44"
                    />
                  </div>
                )}
              </div>

              {/* Material breakdown table */}
              {reviewTab === "summary" && (
                <div className="card" style={{ border: "1px solid var(--border)" }}>
                  <div className="card-header py-2.5 px-4">
                    <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                      MATERIAL BREAKDOWN — Edit pricing before import
                    </div>
                  </div>
                  <div className="tbl-wrap" style={{ borderRadius: "0 0 6px 6px" }}>
                    <table style={{ margin: 0 }}>
                      <thead>
                        <tr>
                          <th>Shape Category</th>
                          <th style={{ width: 80, textAlign: "right" }}>Tons</th>
                          <th style={{ width: 60, textAlign: "right" }}>Marks</th>
                          <th style={{ width: 60, textAlign: "right" }}>Pieces</th>
                          <th style={{ width: 110, textAlign: "right" }}>$/Ton</th>
                          <th style={{ width: 120, textAlign: "right" }}>Line Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {editableMaterials.map((m, idx) => (
                          <tr key={m.shape}>
                            <td className="font-semibold text-xs">{m.shape}</td>
                            <td className="text-right font-mono text-xs">{m.tons.toFixed(2)}</td>
                            <td className="text-right font-mono text-xs">{m.uniqueMarks}</td>
                            <td className="text-right font-mono text-xs">{m.pieceCount}</td>
                            <td>
                              <input
                                className="input text-xs text-right font-mono"
                                style={{ padding: "3px 6px", width: "100%" }}
                                type="number"
                                value={m.price_per_ton}
                                onChange={(e) => {
                                  const next = [...editableMaterials];
                                  next[idx] = { ...next[idx]!, price_per_ton: parseFloat(e.target.value) || 0 };
                                  setEditableMaterials(next);
                                }}
                              />
                            </td>
                            <td className="text-right font-mono text-xs font-medium">
                              ${(m.tons * m.price_per_ton).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: "var(--bg-muted)" }}>
                          <td className="font-bold text-xs">TOTAL</td>
                          <td className="text-right font-mono text-xs font-bold">{totalTons.toFixed(2)}</td>
                          <td className="text-right font-mono text-xs font-bold">{aggregated.unique_piece_marks}</td>
                          <td className="text-right font-mono text-xs font-bold">
                            {editableMaterials.reduce((s, m) => s + m.pieceCount, 0)}
                          </td>
                          <td className="text-right font-mono text-xs" style={{ color: "var(--muted)" }}>
                            Blended: ${totalTons > 0 ? (totalMaterialCost / totalTons).toFixed(0) : "—"}
                          </td>
                          <td className="text-right font-mono text-xs font-bold" style={{ color: "var(--primary)" }}>
                            ${totalMaterialCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* Itemized Takeoff Table */}
              {reviewTab === "members" && (
                <div className="card" style={{ border: "1px solid var(--border)" }}>
                  <div className="card-header py-2 px-4 flex justify-between items-center">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      PARSED TAKEOFF ITEMS — Verified Lengths & AISC Weights
                    </div>
                    <div className="text-[11px] font-mono text-slate-400">
                      Total Weight: <strong className="text-blue-400">{(totalTons * 2000).toLocaleString()} lbs</strong> ({totalTons.toFixed(2)} tons)
                    </div>
                  </div>
                  <div className="tbl-wrap" style={{ maxHeight: 340, overflowY: "auto" }}>
                    <table style={{ margin: 0, fontSize: 11 }}>
                      <thead>
                        <tr>
                          <th>Mark</th>
                          <th>Section / Profile</th>
                          <th>Category</th>
                          <th style={{ textAlign: "right" }}>Qty</th>
                          <th style={{ textAlign: "right" }}>Length</th>
                          <th style={{ textAlign: "right" }}>Unit Wt</th>
                          <th style={{ textAlign: "right" }}>Piece Wt</th>
                          <th style={{ textAlign: "right" }}>Line Total Wt</th>
                          <th style={{ textAlign: "center" }}>Weight Source</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsed.members
                          .filter((m) =>
                            !memberSearch ||
                            m.pieceMark.toLowerCase().includes(memberSearch.toLowerCase()) ||
                            m.assemblyMark.toLowerCase().includes(memberSearch.toLowerCase()) ||
                            m.section.toLowerCase().includes(memberSearch.toLowerCase()),
                          )
                          .map((m, idx) => {
                            const lineWtLbs = m.weight * m.quantity;
                            return (
                              <tr key={idx}>
                                <td className="font-semibold font-mono">{m.pieceMark || m.assemblyMark || "—"}</td>
                                <td className="font-mono text-blue-400 font-medium">{m.section}</td>
                                <td>{m.category}</td>
                                <td className="text-right font-mono">{m.quantity}</td>
                                <td className="text-right font-mono">{formatFeetInches(m.length)}</td>
                                <td className="text-right font-mono text-slate-400">
                                  {m.unitWeightLbsPerFt ? `${m.unitWeightLbsPerFt} lb/ft` : "—"}
                                </td>
                                <td className="text-right font-mono">{m.weight ? `${m.weight.toFixed(1)} lb` : "0 lb"}</td>
                                <td className="text-right font-mono font-bold text-slate-200">
                                  {(lineWtLbs / 2000).toFixed(3)} t ({Math.round(lineWtLbs)} lb)
                                </td>
                                <td className="text-center">
                                  <span
                                    className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase"
                                    style={{
                                      background: m.weightSource === "file" ? "rgba(16,185,129,0.15)" : "rgba(59,130,246,0.15)",
                                      color: m.weightSource === "file" ? "#10B981" : "#3B82F6",
                                      border: `1px solid ${m.weightSource === "file" ? "rgba(16,185,129,0.3)" : "rgba(59,130,246,0.3)"}`,
                                    }}
                                  >
                                    {m.weightSource === "file" ? "FILE WEIGHT" : "AISC CALC"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Bolt summary */}
              {parsed.bolts.length > 0 && (
                <div className="card p-3" style={{ border: "1px solid var(--border)" }}>
                  <div className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--muted)" }}>
                    BOLT HARDWARE DETECTED
                  </div>
                  <div className="flex flex-wrap gap-3 text-[11px]">
                    {Object.entries(
                      parsed.bolts.reduce((acc, b) => {
                        const key = `${b.diameter}" ${b.grade}`;
                        acc[key] = (acc[key] ?? 0) + b.quantity;
                        return acc;
                      }, {} as Record<string, number>),
                    ).map(([key, qty]) => (
                      <div key={key} className="flex items-center gap-1.5 px-2 py-1 rounded" style={{ background: "var(--bg-muted)" }}>
                        <Wrench size={10} style={{ color: "#F59E0B" }} />
                        <span className="font-medium">{key}</span>
                        <span className="font-mono" style={{ color: "var(--muted)" }}>×{qty}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Warnings / Errors */}
              {parsed.warnings.length > 0 && (
                <details className="text-[11px]" style={{ color: "var(--muted)" }}>
                  <summary className="cursor-pointer font-semibold flex items-center gap-1">
                    <AlertCircle size={11} style={{ color: "#F59E0B" }} />
                    {parsed.warnings.length} warning{parsed.warnings.length === 1 ? "" : "s"}
                  </summary>
                  <div className="mt-1 pl-4 flex flex-col gap-0.5">
                    {parsed.warnings.slice(0, 20).map((w, i) => <div key={i}>{w}</div>)}
                    {parsed.warnings.length > 20 && <div>...and {parsed.warnings.length - 20} more</div>}
                  </div>
                </details>
              )}
              {parsed.errors.length > 0 && (
                <details className="text-[11px]" style={{ color: "#ef4444" }}>
                  <summary className="cursor-pointer font-semibold flex items-center gap-1">
                    <AlertCircle size={11} />
                    {parsed.errors.length} error{parsed.errors.length === 1 ? "" : "s"}
                  </summary>
                  <div className="mt-1 pl-4 flex flex-col gap-0.5">
                    {parsed.errors.slice(0, 20).map((e, i) => <div key={i}>{e}</div>)}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between"
          style={{ padding: "14px 20px", borderTop: "1px solid var(--border)", background: "var(--bg-muted)" }}
        >
          <div>
            {step === 2 && (
              <button
                type="button"
                className="btn btn-sm flex items-center gap-1"
                onClick={() => setStep(1)}
              >
                <ChevronLeft size={14} /> Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="btn btn-sm" onClick={onClose}>
              Cancel
            </button>
            {step === 2 && aggregated && (
              <button
                type="button"
                className="btn btn-primary flex items-center gap-1.5"
                onClick={handleConfirmImport}
              >
                <Sparkles size={14} />
                Create Estimate from BOM
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat card sub-component
// ---------------------------------------------------------------------------

function StatCard({
  icon, label, value, color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div
      className="flex flex-col gap-1 p-3 rounded-lg"
      style={{ background: `${color}08`, border: `1px solid ${color}20` }}
    >
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider" style={{ color }}>
        {icon} {label}
      </div>
      <div className="text-sm font-bold font-mono" style={{ color: "var(--text)" }}>
        {value}
      </div>
    </div>
  );
}
