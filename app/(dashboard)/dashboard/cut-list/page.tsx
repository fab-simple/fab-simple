"use client";

import { useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { useResourceList } from "@/hooks/useResource";
import { useGlobalProject } from "@/hooks/useGlobalProject";
import { FabAPI } from "@/lib/api";
import { Plus, Trash2, Wand2, Loader2 } from "lucide-react";

interface Project { id: string; name: string; }

interface CutInput { length: string; qty: string; mark: string; }

interface PackedBar {
  bar_index: number;
  cuts: { length: number; mark?: string }[];
  used_length: number;
  remnant: number;
  waste: number;
}

interface CutPlan {
  total_bars: number; total_used: number; total_stock: number;
  yield_percentage: number; waste_percentage: number;
  bars: PackedBar[];
}

export default function CutListPage() {
  const { selectedProjectId } = useGlobalProject();
  const projects = useResourceList<Project>("projects", { limit: "100" });
  const [profile, setProfile] = useState("W12x40");
  const [stockLength, setStockLength] = useState("480");
  const [kerf, setKerf] = useState("0.125");
  const [minRemnant, setMinRemnant] = useState("6");
  const [projectId, setProjectId] = useState(selectedProjectId ?? "");
  const [cuts, setCuts] = useState<CutInput[]>([
    { length: "", qty: "1", mark: "" },
  ]);
  const [plan, setPlan] = useState<CutPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addRow() { setCuts([...cuts, { length: "", qty: "1", mark: "" }]); }
  function removeRow(i: number) { setCuts(cuts.filter((_, idx) => idx !== i)); }
  function updateRow(i: number, key: keyof CutInput, v: string) {
    setCuts(cuts.map((c, idx) => idx === i ? { ...c, [key]: v } : c));
  }

  async function optimize() {
    setBusy(true); setError(null); setPlan(null);
    try {
      const result = await FabAPI.cutOptimize({
        project_id: projectId || undefined,
        profile,
        stock_length: Number(stockLength),
        kerf: Number(kerf),
        min_remnant: Number(minRemnant),
        cuts: cuts
          .filter((c) => c.length && c.qty)
          .map((c) => ({ length: Number(c.length), qty: Number(c.qty), mark: c.mark || undefined })),
      });
      setPlan(result as CutPlan);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Optimization failed");
    } finally { setBusy(false); }
  }

  return (
    <PageWrapper title="Cut List Optimizer">
      <div className="mb-6">
        <div className="text-[20px] font-bold" style={{ color: "var(--text)" }}>Cut List Optimizer</div>
        <div className="text-[12px]" style={{ color: "var(--muted)" }}>
          1D first-fit-decreasing bin packing with kerf allowance — produces optimized cut plan from your BOM
        </div>
      </div>

      <div className="grid-2 gap-md">
        <div className="card">
          <div className="card-header"><div className="card-title">Inputs</div></div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="grid-2" style={{ gap: 12 }}>
              <div>
                <label className="text-[11px] uppercase font-semibold tracking-wider" style={{ color: "var(--muted)" }}>Profile</label>
                <input className="input" value={profile} onChange={(e) => setProfile(e.target.value)} />
              </div>
              <div>
                <label className="text-[11px] uppercase font-semibold tracking-wider" style={{ color: "var(--muted)" }}>Project (optional)</label>
                <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                  <option value="">don&apos;t save</option>
                  {projects.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <div className="grid-3" style={{ gap: 12 }}>
              <div>
                <label className="text-[11px] uppercase font-semibold tracking-wider" style={{ color: "var(--muted)" }}>Stock length (in)</label>
                <input className="input" type="number" step="0.01" value={stockLength} onChange={(e) => setStockLength(e.target.value)} />
              </div>
              <div>
                <label className="text-[11px] uppercase font-semibold tracking-wider" style={{ color: "var(--muted)" }}>Kerf (in)</label>
                <input className="input" type="number" step="0.001" value={kerf} onChange={(e) => setKerf(e.target.value)} />
              </div>
              <div>
                <label className="text-[11px] uppercase font-semibold tracking-wider" style={{ color: "var(--muted)" }}>Min remnant (in)</label>
                <input className="input" type="number" step="0.1" value={minRemnant} onChange={(e) => setMinRemnant(e.target.value)} />
              </div>
            </div>

            <div className="text-[12px] uppercase font-semibold tracking-wider mt-3" style={{ color: "var(--muted)" }}>Cut lengths</div>
            {cuts.map((c, i) => (
              <div key={i} className="grid-3" style={{ gap: 8, alignItems: "end" }}>
                <input className="input" type="number" step="0.01" placeholder="Length (in)" value={c.length} onChange={(e) => updateRow(i, "length", e.target.value)} />
                <input className="input" type="number" min="1" placeholder="Qty" value={c.qty} onChange={(e) => updateRow(i, "qty", e.target.value)} />
                <div style={{ display: "flex", gap: 4 }}>
                  <input className="input" placeholder="Mark (opt)" value={c.mark} onChange={(e) => updateRow(i, "mark", e.target.value)} style={{ flex: 1 }} />
                  <button className="btn" onClick={() => removeRow(i)} style={{ padding: "0 8px" }}><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
            <button className="btn" onClick={addRow}><Plus size={14} /> Add cut</button>

            {error && <div className="pill pill-red" style={{ padding: "8px 12px", fontSize: 12 }}>{error}</div>}

            <button className="btn btn-primary" onClick={optimize} disabled={busy} style={{ height: 40, justifyContent: "center" }}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
              {busy ? "Optimizing…" : projectId ? "Optimize & save to project" : "Optimize (don't save)"}
            </button>
            {projectId && plan && !busy && (
              <div className="text-[11px]" style={{ color: "var(--green)" }}>
                ✓ Saved to project — view under Production
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">Result</div></div>
          <div className="card-body">
            {!plan ? (
              <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>
                Run the optimizer to see the cut plan.
              </div>
            ) : (
              <>
                <div className="grid-3" style={{ gap: 12, marginBottom: 16 }}>
                  <div className="stat-card"><div className="stat-label">Bars</div><div className="stat-value" style={{ fontSize: 28 }}>{plan.total_bars}</div></div>
                  <div className="stat-card green"><div className="stat-label">Yield</div><div className="stat-value" style={{ fontSize: 28 }}>{plan.yield_percentage}%</div></div>
                  <div className="stat-card violet"><div className="stat-label">Waste</div><div className="stat-value" style={{ fontSize: 28 }}>{plan.waste_percentage}%</div></div>
                </div>
                <div style={{ maxHeight: 360, overflowY: "auto" }}>
                  {plan.bars.map((bar) => {
                    const usedPct = (bar.used_length / Number(stockLength)) * 100;
                    return (
                      <div key={bar.bar_index} style={{ marginBottom: 12 }}>
                        <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
                          <span className="text-[12px] font-bold font-mono" style={{ color: "var(--text)" }}>Bar #{bar.bar_index}</span>
                          <span className="text-[11px] font-mono" style={{ color: "var(--muted)" }}>
                            {bar.cuts.length} cuts · {bar.used_length.toFixed(2)}" used · {bar.remnant.toFixed(2)}" remnant
                          </span>
                        </div>
                        <div style={{ display: "flex", height: 18, borderRadius: 4, overflow: "hidden", background: "var(--bg-muted)" }}>
                          {bar.cuts.map((cut, idx) => {
                            const w = (cut.length / Number(stockLength)) * 100;
                            const color = ["#4F46E5", "#2563EB", "#7C3AED", "#EA580C", "#16A34A", "#0D9488"][idx % 6];
                            return (
                              <div key={idx} style={{ width: `${w}%`, background: color, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 9, fontWeight: 700 }}>
                                {cut.length.toFixed(0)}
                              </div>
                            );
                          })}
                          <div style={{ width: `${100 - usedPct}%`, background: "#94A3B8", opacity: 0.4 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
