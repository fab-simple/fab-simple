"use client";

import Link from "next/link";
import { use, useEffect } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { useResource, useResourceList, useUpdate } from "@/hooks/useResource";
import { useGlobalProject } from "@/hooks/useGlobalProject";
import { FabAPI } from "@/lib/api";
import { useState } from "react";
import { Loader2, AlertCircle, Archive, ArrowLeft, Wand2, Pencil } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Project {
  id: string; name: string; number: string | null; gc_name: string | null;
  contract_value: number | null; est_tonnage: number | null; status: string;
  start_date: string | null; deadline: string | null; description: string | null;
  color: string | null; is_archived: boolean;
  architect_eor?: string | null;
  project_location?: string | null;
  unique_piece_marks?: number | null;
  baseline_budget?: {
    material?: number;
    labor?: number;
    freight?: number;
    coating?: number;
    subtotal?: number;
    margin?: number;
    contingency?: number;
    total?: number;
  } | null;
  drawing_set_ref?: string | null;
  exclusions_qualifications?: string | null;
  estimate_id?: string | null;
}
interface Part { id: string; part_mark: string; profile: string; status: string; quantity: number; }
interface Drawing { id: string; drawing_number: string; revision: string; status: string; }
interface CO { id: string; co_number: string; description: string; amount: number; status: string; }

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const project = useResource<Project>("projects", id);
  const parts = useResourceList<Part>("parts", { project_id: id, limit: "20" });
  const drawings = useResourceList<Drawing>("drawings", { project_id: id, limit: "20" });
  const cos = useResourceList<CO>("change_orders", { project_id: id, limit: "20" });
  const update = useUpdate<Project>("projects");
  const { selectProject, selectedProjectId } = useGlobalProject();
  const [archiving, setArchiving] = useState(false);
  const [seedingAisc, setSeedingAisc] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const [jobNumberInput, setJobNumberInput] = useState("");
  const [isActivating, setIsActivating] = useState(false);

  // Initialize input
  useEffect(() => {
    if (project.data?.number) {
      setJobNumberInput(project.data.number);
    }
  }, [project.data?.number]);

  // Auto-scope the whole app to this project when the user opens the detail view.
  useEffect(() => {
    if (project.data && project.data.id !== selectedProjectId) {
      selectProject(project.data.id, project.data.name, project.data.number);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.data?.id]);

  if (project.isLoading) {
    return <PageWrapper title="…"><div className="flex items-center justify-center" style={{ padding: 60, color: "var(--muted)" }}><Loader2 size={18} className="animate-spin" /><span style={{ marginLeft: 10 }}>Loading project…</span></div></PageWrapper>;
  }
  if (project.error || !project.data) {
    return <PageWrapper title="Project"><div className="card" style={{ padding: 24, color: "#DC2626" }}><AlertCircle size={18} /> {project.error?.message ?? "Project not found"}</div></PageWrapper>;
  }

  const p = project.data;
  const completed = (parts.data ?? []).filter((x) => ["complete", "shipped"].includes(x.status)).length;
  const progress = parts.data?.length ? Math.round((completed / parts.data.length) * 100) : 0;

  async function archive() {
    setArchiving(true);
    try { await FabAPI.archiveProject(id); project.refetch(); } finally { setArchiving(false); }
  }
  async function seedAisc() {
    setSeedingAisc(true);
    try { await FabAPI.seedAisc(id); } finally { setSeedingAisc(false); }
  }

  return (
    <PageWrapper title={p.name}>
      <div className="flex items-center gap-2 mb-4">
        <Link href="/dashboard/projects" className="btn btn-sm"><ArrowLeft size={12} /> Back</Link>
      </div>

      {(!p.number || p.status === "awarded_setup") && (
        <div className="card" style={{ marginBottom: 24, border: "1.5px solid #EAB308", background: "rgba(234, 179, 8, 0.05)", padding: 20 }}>
          <div className="flex items-start gap-3">
            <AlertCircle size={18} style={{ color: "#EAB308", marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <div className="font-bold text-sm text-yellow-500">Project Pending Job Number</div>
              <div className="text-xs text-slate-400 mt-1">
                This project is won but cannot be activated across the shop floor until a PM assigns a Job Number.
              </div>
              <div className="flex items-center gap-2 mt-4 max-w-sm">
                <input
                  className="input text-xs"
                  value={jobNumberInput}
                  onChange={(e) => setJobNumberInput(e.target.value)}
                  placeholder="Enter Job Number (e.g. PRJ-2026-004)"
                  style={{ background: "rgba(0,0,0,0.2)" }}
                />
                <button
                  className="btn btn-primary btn-sm flex-shrink-0 text-xs py-2 px-3"
                  style={{ background: "#EAB308", borderColor: "#EAB308", color: "#0F172A" }}
                  disabled={!jobNumberInput.trim() || isActivating}
                  onClick={async () => {
                    setIsActivating(true);
                    try {
                      await update.mutateAsync({
                        id: p.id,
                        body: { number: jobNumberInput.trim(), status: "active" },
                      });
                      project.refetch();
                    } catch (e) {
                      alert("Failed to activate project: " + (e as Error).message);
                    } finally {
                      setIsActivating(false);
                    }
                  }}
                >
                  Activate Project
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-body" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 24 }}>
          <div style={{ flex: 1 }}>
            <div className="text-[22px] font-bold" style={{ color: "var(--text)" }}>{p.name}</div>
            <div className="text-[12px] font-mono" style={{ color: "var(--muted)", marginTop: 4 }}>{p.number ?? "—"}</div>
            <div className="text-[13px]" style={{ color: "var(--muted)", marginTop: 8 }}>{p.description ?? ""}</div>
            <div className="grid-4" style={{ gap: 16, marginTop: 20 }}>
              <Stat label="GC" value={p.gc_name ?? "—"} />
              <Stat label="Contract" value={p.contract_value ? formatCurrency(p.contract_value) : "—"} />
              <Stat label="Est. tonnage" value={p.est_tonnage ? `${p.est_tonnage} tons` : "—"} />
              <Stat label="Deadline" value={p.deadline ? new Date(p.deadline).toLocaleDateString() : "—"} />
            </div>
          </div>
          <div className="flex flex-col gap-2 items-end">
            <StatusPill status={p.status} />
            <button className="btn btn-sm" onClick={() => setShowEdit(true)}>
              <Pencil size={12} /> Edit project
            </button>
            <button className="btn btn-sm" onClick={seedAisc} disabled={seedingAisc || p.status === "awarded_setup"}>
              {seedingAisc ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
              Seed AISC checklist
            </button>
            <button className="btn btn-sm" onClick={archive} disabled={archiving || p.is_archived || p.status === "awarded_setup"}>
              {archiving ? <Loader2 size={12} className="animate-spin" /> : <Archive size={12} />}
              Archive
            </button>
          </div>
        </div>
        <div className="card-body" style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
            <span className="text-[12px] font-semibold" style={{ color: "var(--muted)" }}>Progress</span>
            <span className="text-[14px] font-bold font-mono" style={{ color: "var(--text)" }}>{completed} / {parts.data?.length ?? 0} ({progress}%)</span>
          </div>
          <div className="pbar"><div className="pbar-fill" style={{ width: `${progress}%`, background: p.color ?? "var(--primary)" }} /></div>
        </div>
      </div>

      <div className="grid-2 gap-md">
        <div className="card">
          <div className="card-header"><div className="card-title">Parts ({parts.data?.length ?? 0})</div></div>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Mark</th><th>Profile</th><th>Qty</th><th>Status</th></tr></thead>
              <tbody>
                {(parts.data ?? []).slice(0, 8).map((x) => (
                  <tr key={x.id}>
                    <td className="td-mono">{x.part_mark}</td>
                    <td style={{ fontSize: 12, color: "var(--muted)" }}>{x.profile}</td>
                    <td className="td-mono">{x.quantity}</td>
                    <td><StatusPill status={x.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><div className="card-title">Drawings ({drawings.data?.length ?? 0})</div></div>
          <div className="tbl-wrap">
            <table>
              <thead><tr><th>Drawing</th><th>Rev</th><th>Status</th></tr></thead>
              <tbody>
                {(drawings.data ?? []).map((d) => (
                  <tr key={d.id}>
                    <td className="td-mono">{d.drawing_number}</td>
                    <td className="td-mono">{d.revision}</td>
                    <td><StatusPill status={d.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card mt-section">
        <div className="card-header"><div className="card-title">Change Orders ({cos.data?.length ?? 0})</div></div>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>CO #</th><th>Description</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>
              {(cos.data ?? []).map((c) => (
                <tr key={c.id}>
                  <td className="td-mono">{c.co_number}</td>
                  <td>{c.description}</td>
                  <td className="td-mono">${Number(c.amount).toLocaleString()}</td>
                  <td><StatusPill status={c.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {p.baseline_budget && (
        <div className="card mt-section">
          <div className="card-header flex items-center justify-between" style={{ borderBottom: "1px solid var(--border)", paddingBottom: 12 }}>
            <div className="card-title">Original Estimate & Baseline Budget</div>
            {p.estimate_id && (
              <Link href="/dashboard/estimating" className="text-xs font-semibold hover:underline" style={{ color: "var(--primary)" }}>
                View in Estimating module &rarr;
              </Link>
            )}
          </div>
          <div className="card-body grid-2 gap-lg p-4" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">BASELINE BUDGET BREAKDOWN</div>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-xs border-b border-slate-800 pb-1.5">
                  <span className="text-slate-400">Material Cost:</span>
                  <span className="font-mono font-medium">${Number(p.baseline_budget.material || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-xs border-b border-slate-800 pb-1.5">
                  <span className="text-slate-400">Labor Cost:</span>
                  <span className="font-mono font-medium">${Number(p.baseline_budget.labor || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-xs border-b border-slate-800 pb-1.5">
                  <span className="text-slate-400">Freight Cost:</span>
                  <span className="font-mono font-medium">${Number(p.baseline_budget.freight || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-xs border-b border-slate-800 pb-1.5">
                  <span className="text-slate-400">Paint/Coating Cost:</span>
                  <span className="font-mono font-medium">${Number(p.baseline_budget.coating || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-xs pt-1">
                  <span className="font-bold text-slate-300">Total Awarded Budget:</span>
                  <span className="font-mono font-bold text-sm text-green-500">${Number(p.baseline_budget.total || p.contract_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">EXCLUSIONS & QUALIFICATIONS</div>
              <div
                className="text-xs font-mono p-3 rounded border border-slate-800 bg-slate-950/30 overflow-y-auto"
                style={{ maxHeight: 150, whiteSpace: "pre-wrap", border: "1px solid var(--border)" }}
              >
                {p.exclusions_qualifications || "No exclusions specified."}
              </div>
            </div>
          </div>
        </div>
      )}

      {showEdit && (
        <EditProjectModal
          project={p}
          onClose={() => setShowEdit(false)}
          onSubmit={async (payload) => {
            await update.mutateAsync({ id: p.id, body: payload });
            project.refetch();
            // Update sidebar picker name if changed
            if (payload.name || payload.number !== undefined) {
              selectProject(p.id, (payload.name as string) ?? p.name, (payload.number as string | null) ?? p.number);
            }
            setShowEdit(false);
          }}
          submitting={update.isPending}
          error={update.error?.message ?? null}
        />
      )}
    </PageWrapper>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase font-semibold tracking-wider" style={{ color: "var(--muted)" }}>{label}</div>
      <div className="text-[14px] font-semibold mt-1" style={{ color: "var(--text)" }}>{value}</div>
    </div>
  );
}

function EditProjectModal({
  project, onClose, onSubmit, submitting, error,
}: {
  project: Project;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => void;
  submitting: boolean;
  error: string | null;
}) {
  const [form, setForm] = useState({
    name: project.name,
    number: project.number ?? "",
    gc_name: project.gc_name ?? "",
    contract_value: project.contract_value != null ? String(project.contract_value) : "",
    contract_type: project.architect_eor ?? "",
    est_tonnage: project.est_tonnage != null ? String(project.est_tonnage) : "",
    status: project.status,
    start_date: project.start_date ?? "",
    deadline: project.deadline ?? "",
    description: project.description ?? "",
    color: project.color ?? "#4F46E5",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(15,23,42,0.5)" }} onClick={onClose}>
      <div className="card" style={{ width: 540, maxHeight: "85vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div className="card-header">
          <div className="card-title">Edit project</div>
        </div>
        <form
          className="card-body"
          onSubmit={(e) => {
            e.preventDefault();
            const payload: Record<string, unknown> = {
              name: form.name,
              number: form.number || undefined,
              gc_name: form.gc_name || undefined,
              contract_value: form.contract_value ? Number(form.contract_value) : undefined,
              est_tonnage: form.est_tonnage ? Number(form.est_tonnage) : undefined,
              status: form.status,
              start_date: form.start_date || undefined,
              deadline: form.deadline || undefined,
              description: form.description || undefined,
              color: form.color || undefined,
            };
            onSubmit(payload);
          }}
          style={{ display: "flex", flexDirection: "column", gap: 12 }}
        >
          <EditField label="Project name" required>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </EditField>
          <div className="grid-2" style={{ gap: 12 }}>
            <EditField label="Project number">
              <input className="input" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} placeholder="PRJ-2026-NNNN" />
            </EditField>
            <EditField label="Status">
              <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="active">Active</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </EditField>
          </div>
          <EditField label="General contractor">
            <input className="input" value={form.gc_name} onChange={(e) => setForm({ ...form, gc_name: e.target.value })} />
          </EditField>
          <div className="grid-2" style={{ gap: 12 }}>
            <EditField label="Contract value ($)">
              <input className="input" type="number" min="0" step="0.01" value={form.contract_value} onChange={(e) => setForm({ ...form, contract_value: e.target.value })} />
            </EditField>
            <EditField label="Est. tonnage">
              <input className="input" type="number" min="0" step="0.01" value={form.est_tonnage} onChange={(e) => setForm({ ...form, est_tonnage: e.target.value })} />
            </EditField>
          </div>
          <div className="grid-2" style={{ gap: 12 }}>
            <EditField label="Start date">
              <input className="input" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </EditField>
            <EditField label="Deadline">
              <input className="input" type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
            </EditField>
          </div>
          <EditField label="Description">
            <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ height: "auto", padding: "8px 12px", resize: "vertical" }} />
          </EditField>
          <EditField label="Color tag">
            <div className="flex items-center gap-3">
              <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} style={{ width: 36, height: 28, border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", padding: 0 }} />
              <span className="text-[11px] font-mono" style={{ color: "var(--muted)" }}>{form.color}</span>
            </div>
          </EditField>

          {error && <div className="pill pill-red" style={{ padding: "8px 12px", fontSize: 12 }}>{error}</div>}

          <div className="flex justify-end gap-2 mt-2">
            <button type="button" onClick={onClose} className="btn">Cancel</button>
            <button type="submit" disabled={submitting || !form.name.trim()} className="btn btn-primary">
              {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
              {submitting ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] uppercase font-semibold tracking-wider" style={{ color: "var(--muted)" }}>
        {label}{required && <span style={{ color: "#DC2626" }}> *</span>}
      </span>
      {children}
    </label>
  );
}
