"use client";

import { useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ResourceModal, Field } from "@/components/ui/ResourceModal";
import { useResourceList, useCreate, useUpdate } from "@/hooks/useResource";
import { useCsvExport } from "@/hooks/useCsvExport";
import { FabAPI } from "@/lib/api";
import { Plus, Search, Loader2, X } from "lucide-react";

interface Part {
  id: string;
  part_mark: string;
  assembly_mark: string | null;
  profile: string;
  grade: string | null;
  length: number | null;
  weight: number | null;
  quantity: number;
  status: string;
  phase: string | null;
  heat_number: string | null;
  project_id: string;
  drawing_id: string | null;
  assigned_user_id: string | null;
}

interface Project { id: string; name: string; }

const STATUS_OPTIONS = ["not_started", "in_progress", "complete", "shipped", "on_hold"];

export default function PartsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Part | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  async function bulkUpdateStatus(status: string) {
    if (selected.size === 0) return;
    if (!confirm(`Update ${selected.size} part(s) to "${status}"?`)) return;
    setBulkBusy(true);
    try {
      // allSettled so one rejection (RLS, validation, etc.) doesn't short-
      // circuit the rest. We surface the actual outcome to the user
      // instead of silently looking like a success.
      const ids = Array.from(selected);
      const results = await Promise.allSettled(
        ids.map((id) => FabAPI.update("parts", id, { status })),
      );
      const failures = results
        .map((r, i) => ({ id: ids[i], result: r }))
        .filter((x) => x.result.status === "rejected");
      const successCount = ids.length - failures.length;

      if (failures.length === 0) {
        alert(`Updated ${successCount} part(s) to "${status}".`);
      } else if (successCount === 0) {
        const firstErr = (failures[0].result as PromiseRejectedResult).reason;
        const msg = firstErr instanceof Error ? firstErr.message : String(firstErr);
        alert(`No parts were updated.\n\nFirst error: ${msg}`);
      } else {
        const firstErr = (failures[0].result as PromiseRejectedResult).reason;
        const msg = firstErr instanceof Error ? firstErr.message : String(firstErr);
        alert(
          `${successCount} updated, ${failures.length} failed.\n\n` +
          `First failure: ${msg}`,
        );
      }
    } finally {
      setBulkBusy(false);
      setSelected(new Set());
      list.refetch();
    }
  }

  const query: Record<string, string> = { order_by: "created_at", dir: "desc" };
  if (statusFilter) query.status = statusFilter;
  if (search) query.part_mark__ilike = search;

  const list = useResourceList<Part>("parts", query);
  const projects = useResourceList<Project>("projects", { limit: "100" });
  const create = useCreate<Part>("parts");
  const update = useUpdate<Part>("parts");

  useCsvExport({
    filename: "parts",
    data: list.data,
    transform: (p) => ({
      part_mark: p.part_mark, assembly_mark: p.assembly_mark, profile: p.profile,
      grade: p.grade, length_in: p.length, weight_lb: p.weight, quantity: p.quantity,
      heat_number: p.heat_number, status: p.status,
    }),
  });

  const cols: Column<Part>[] = [
    { key: "mark", label: "Part Mark", mono: true, sortAccessor: (r) => r.part_mark, render: (r) => r.part_mark },
    { key: "asm", label: "Assembly", mono: true, sortAccessor: (r) => r.assembly_mark, render: (r) => r.assembly_mark ?? "—" },
    { key: "profile", label: "Profile", sortAccessor: (r) => r.profile, render: (r) => <span style={{ color: "var(--muted)" }}>{r.profile}</span> },
    { key: "grade", label: "Grade", sortAccessor: (r) => r.grade, render: (r) => r.grade ?? "—" },
    { key: "qty", label: "Qty", align: "right", mono: true, sortAccessor: (r) => r.quantity, render: (r) => r.quantity },
    { key: "weight", label: "Weight", align: "right", mono: true, sortAccessor: (r) => r.weight ?? 0, render: (r) => r.weight ? Number(r.weight).toFixed(0) + " lb" : "—" },
    { key: "heat", label: "Heat #", mono: true, sortAccessor: (r) => r.heat_number, render: (r) => r.heat_number ?? "—" },
    { key: "status", label: "Status", sortAccessor: (r) => r.status, render: (r) => <StatusPill status={r.status} /> },
  ];

  return (
    <PageWrapper title="Parts">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[20px] font-bold" style={{ color: "var(--text)" }}>Parts List</div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>{list.data?.length ?? 0} parts</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute" style={{ left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
            <input className="input" placeholder="Search part marks…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 30, width: 240, height: 32 }} />
          </div>
          <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ height: 32, width: 160 }}>
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
          </select>
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>
            <Plus size={14} /> New Part
          </button>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="card flex items-center gap-2 px-3 py-2 mb-3" style={{ background: "rgba(79,70,229,0.04)", borderColor: "var(--primary)" }}>
          <span className="text-[12px] font-semibold" style={{ color: "var(--primary)" }}>
            {bulkBusy && <Loader2 size={12} className="animate-spin inline mr-1" />}
            {selected.size} selected
          </span>
          <span className="text-[12px]" style={{ color: "var(--muted)" }}>Bulk set status:</span>
          {STATUS_OPTIONS.map((s) => (
            <button key={s} className="btn btn-sm" disabled={bulkBusy} onClick={() => bulkUpdateStatus(s)}>
              {s.replace(/_/g, " ")}
            </button>
          ))}
          <button className="btn btn-sm" onClick={() => setSelected(new Set())} title="Clear" style={{ marginLeft: "auto" }}>
            <X size={12} />
          </button>
        </div>
      )}

      <DataTable
        data={list.data}
        columns={cols}
        loading={list.isLoading}
        error={list.error}
        empty={{ title: "No parts yet", subtitle: "Import a Tekla CSV or add manually." }}
        rowKey={(r) => r.id}
        onRowClick={(r) => setEditing(r)}
        selectable={{ selected, onChange: setSelected }}
      />

      {showNew && (
        <PartModal
          title="New part"
          projects={projects.data ?? []}
          onClose={() => setShowNew(false)}
          onSubmit={(payload) => create.mutate(payload, { onSuccess: () => setShowNew(false) })}
          submitting={create.isPending}
          error={create.error?.message ?? null}
        />
      )}
      {editing && (
        <PartModal
          title={`Edit ${editing.part_mark}`}
          initial={editing}
          projects={projects.data ?? []}
          onClose={() => setEditing(null)}
          onSubmit={(payload) =>
            update.mutate({ id: editing.id, body: payload }, { onSuccess: () => setEditing(null) })
          }
          submitting={update.isPending}
          error={update.error?.message ?? null}
        />
      )}
    </PageWrapper>
  );
}

function PartModal({
  title, initial, projects, onClose, onSubmit, submitting, error,
}: {
  title: string;
  initial?: Part;
  projects: Project[];
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => void;
  submitting: boolean;
  error: string | null;
}) {
  const [form, setForm] = useState({
    project_id: initial?.project_id ?? projects[0]?.id ?? "",
    part_mark: initial?.part_mark ?? "",
    assembly_mark: initial?.assembly_mark ?? "",
    profile: initial?.profile ?? "",
    grade: initial?.grade ?? "A992",
    length: initial?.length?.toString() ?? "",
    weight: initial?.weight?.toString() ?? "",
    quantity: initial?.quantity?.toString() ?? "1",
    heat_number: initial?.heat_number ?? "",
    phase: initial?.phase ?? "",
    status: initial?.status ?? "not_started",
  });

  return (
    <ResourceModal
      title={title}
      onClose={onClose}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          project_id: form.project_id,
          part_mark: form.part_mark,
          assembly_mark: form.assembly_mark || undefined,
          profile: form.profile,
          grade: form.grade || undefined,
          length: form.length ? Number(form.length) : undefined,
          weight: form.weight ? Number(form.weight) : undefined,
          quantity: Number(form.quantity || 1),
          heat_number: form.heat_number || undefined,
          phase: form.phase || undefined,
          status: form.status as Part["status"],
        });
      }}
      submitting={submitting}
      error={error}
      width={520}
    >
      <Field label="Project" required>
        <select className="input" required value={form.project_id} onChange={(e) => setForm({ ...form, project_id: e.target.value })}>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Part mark" required>
          <input className="input" required value={form.part_mark} onChange={(e) => setForm({ ...form, part_mark: e.target.value })} />
        </Field>
        <Field label="Assembly mark">
          <input className="input" value={form.assembly_mark} onChange={(e) => setForm({ ...form, assembly_mark: e.target.value })} />
        </Field>
      </div>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Profile" required>
          <input className="input" required value={form.profile} onChange={(e) => setForm({ ...form, profile: e.target.value })} placeholder="W14x82" />
        </Field>
        <Field label="Grade">
          <input className="input" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} />
        </Field>
      </div>
      <div className="grid-3" style={{ gap: 12 }}>
        <Field label="Length (in)">
          <input className="input" type="number" step="0.001" value={form.length} onChange={(e) => setForm({ ...form, length: e.target.value })} />
        </Field>
        <Field label="Weight (lb)">
          <input className="input" type="number" step="0.01" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />
        </Field>
        <Field label="Qty">
          <input className="input" type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
        </Field>
      </div>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Heat #">
          <input className="input" value={form.heat_number} onChange={(e) => setForm({ ...form, heat_number: e.target.value })} />
        </Field>
        <Field label="Phase">
          <input className="input" value={form.phase} onChange={(e) => setForm({ ...form, phase: e.target.value })} placeholder="P1" />
        </Field>
      </div>
      <Field label="Status">
        <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
      </Field>
    </ResourceModal>
  );
}
