"use client";

import { useState } from "react";
import Link from "next/link";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { useResourceList, useCreate } from "@/hooks/useResource";
import { useCsvExport } from "@/hooks/useCsvExport";
import { formatCurrency } from "@/lib/utils";
import { Plus, Loader2, AlertCircle, Calendar } from "lucide-react";

interface Project {
  id: string;
  name: string;
  number: string | null;
  gc_name: string | null;
  contract_value: number | null;
  contract_type: string | null;
  est_tonnage: number | null;
  status: string;
  start_date: string | null;
  deadline: string | null;
  description: string | null;
  color: string | null;
  is_archived: boolean;
}

export default function ProjectsPage() {
  const list = useResourceList<Project>("projects", { order_by: "created_at", dir: "desc", is_archived: "false" });
  const create = useCreate<Project>("projects");

  useCsvExport({
    filename: "projects",
    data: list.data,
    transform: (p) => ({
      number: p.number, name: p.name, gc: p.gc_name,
      contract_value: p.contract_value, est_tonnage: p.est_tonnage,
      status: p.status, start_date: p.start_date, deadline: p.deadline,
    }),
  });
  const [showNew, setShowNew] = useState(false);

  const projects: Project[] = list.data ?? [];

  return (
    <PageWrapper title="Projects">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[20px] font-bold" style={{ color: "var(--text)" }}>Projects</div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>{projects.length} active</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>
          <Plus size={14} /> New project
        </button>
      </div>

      {list.isLoading && (
        <div className="card" style={{ padding: 40, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)" }}>
          <Loader2 size={18} className="animate-spin" />
          <span style={{ marginLeft: 12, fontSize: 13 }}>Loading projects…</span>
        </div>
      )}

      {list.error && (
        <div className="card" style={{ padding: 24, display: "flex", alignItems: "center", gap: 12, color: "#DC2626" }}>
          <AlertCircle size={18} />
          <div>
            <div className="font-semibold">Failed to load projects</div>
            <div className="text-[12px]" style={{ color: "var(--muted)" }}>{list.error.message}</div>
          </div>
        </div>
      )}

      {!list.isLoading && !list.error && projects.length === 0 && (
        <div className="card text-center" style={{ padding: 40, color: "var(--muted)", fontSize: 13 }}>
          No projects yet. Click <strong>New project</strong> to create one.
        </div>
      )}

      <div className="grid-3 gap-md">
        {projects.map((p) => (
          <Link key={p.id} href={`/dashboard/projects/${p.id}`} className="card project-card" style={{ textDecoration: "none", color: "inherit", display: "block" }}>
            <div className="card-header">
              <div style={{ flex: 1 }}>
                <div className="text-[14px] font-bold" style={{ color: "var(--text)" }}>{p.name}</div>
                <div className="text-[11px] font-mono" style={{ color: "var(--muted)" }}>{p.number ?? "—"}</div>
              </div>
              <StatusPill status={p.status} size="sm" />
            </div>
            <div className="card-body">
              <div className="text-[12px]" style={{ color: "var(--muted)", marginBottom: 12 }}>
                {p.description ?? "—"}
              </div>
              <div className="grid-2" style={{ gap: 12 }}>
                <div>
                  <div className="text-[10px] uppercase font-semibold tracking-wider" style={{ color: "var(--muted)" }}>GC</div>
                  <div className="text-[12px] font-semibold" style={{ color: "var(--text)" }}>{p.gc_name ?? "—"}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-semibold tracking-wider" style={{ color: "var(--muted)" }}>Contract</div>
                  <div className="text-[12px] font-semibold font-mono" style={{ color: "var(--text)" }}>
                    {p.contract_value ? formatCurrency(p.contract_value) : "—"}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 mt-3 text-[11px]" style={{ color: "var(--muted)" }}>
                <Calendar size={11} />
                {p.deadline ? new Date(p.deadline).toLocaleDateString() : "no deadline"}
              </div>
            </div>
          </Link>
        ))}
      </div>

      {showNew && (
        <NewProjectModal
          onClose={() => setShowNew(false)}
          onSubmit={(payload) => {
            create.mutate(payload, { onSuccess: () => setShowNew(false) });
          }}
          submitting={create.isPending}
          error={create.error?.message ?? null}
        />
      )}
    </PageWrapper>
  );
}

function NewProjectModal({
  onClose, onSubmit, submitting, error,
}: {
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => void;
  submitting: boolean;
  error: string | null;
}) {
  const [form, setForm] = useState({
    name: "",
    number: "",
    gc_name: "",
    contract_value: "",
    deadline: "",
    description: "",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(15,23,42,0.5)" }} onClick={onClose}>
      <div className="card" style={{ width: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="card-header">
          <div className="card-title">New project</div>
        </div>
        <form
          className="card-body"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({
              name: form.name,
              number: form.number || undefined,
              gc_name: form.gc_name || undefined,
              contract_value: form.contract_value ? Number(form.contract_value) : undefined,
              deadline: form.deadline || undefined,
              description: form.description || undefined,
              status: "active",
            });
          }}
          style={{ display: "flex", flexDirection: "column", gap: 12 }}
        >
          <Field label="Project name" required>
            <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Project number">
            <input className="input" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} placeholder="PRJ-2026-NNNN" />
          </Field>
          <Field label="General contractor">
            <input className="input" value={form.gc_name} onChange={(e) => setForm({ ...form, gc_name: e.target.value })} />
          </Field>
          <div className="grid-2" style={{ gap: 12 }}>
            <Field label="Contract value ($)">
              <input className="input" type="number" min="0" value={form.contract_value} onChange={(e) => setForm({ ...form, contract_value: e.target.value })} />
            </Field>
            <Field label="Deadline">
              <input className="input" type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
            </Field>
          </div>
          <Field label="Description">
            <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ height: "auto", padding: "8px 12px", resize: "vertical" }} />
          </Field>

          {error && <div className="pill pill-red" style={{ padding: "8px 12px", fontSize: 12 }}>{error}</div>}

          <div className="flex justify-end gap-2 mt-2">
            <button type="button" onClick={onClose} className="btn">Cancel</button>
            <button type="submit" disabled={submitting} className="btn btn-primary">
              {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
              {submitting ? "Creating…" : "Create project"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] uppercase font-semibold tracking-wider" style={{ color: "var(--muted)" }}>
        {label}{required && <span style={{ color: "#DC2626" }}> *</span>}
      </span>
      {children}
    </label>
  );
}
