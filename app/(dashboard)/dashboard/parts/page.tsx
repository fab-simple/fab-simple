"use client";

import { useEffect, useMemo, useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ResourceModal, Field } from "@/components/ui/ResourceModal";
import {
  useResourceList,
  useResourcePaged,
  useCreate,
  useUpdate,
  usePoFromPartsPreview,
  useCreatePoFromParts,
} from "@/hooks/useResource";
import { useCsvExport } from "@/hooks/useCsvExport";
import { useGlobalProject } from "@/hooks/useGlobalProject";
import { FabAPI, getRole, type CreatePoFromPartsResult } from "@/lib/api";
import { Plus, Search, Loader2, X, ShoppingCart } from "lucide-react";

interface Part {
  id: string;
  part_mark: string;
  assembly_mark: string | null;
  name: string | null;          // Tekla "Name" column — member type/label (e.g. W-BEAM, COLUMN)
  profile: string;
  grade: string | null;
  length: string | null;
  weight: number | null;
  quantity: number;
  status: string;
  phase: string | null;
  heat_number: string | null;
  project_id: string;
  drawing_id: string | null;
  assigned_user_id: string | null;
}

interface Project { id: string; name: string; number: string; }

const STATUS_OPTIONS = ["not_started", "ordered", "in_progress", "complete", "shipped", "on_hold"];

// Roles allowed to create purchase orders (mirrors purchase_orders.insertable).
const PO_ROLES = ["owner", "pm", "accounting"];

export default function PartsPage() {
  const { selectedProjectId } = useGlobalProject();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showNew, setShowNew] = useState(false);
  const [showCreatePo, setShowCreatePo] = useState(false);
  const [editing, setEditing] = useState<Part | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  // Debounce the search input so we don't hit the API on every keystroke.
  // Server-side ilike on 50k rows + RLS is ~150ms; per-keystroke would
  // saturate the Edge Function and make the UI feel chatty.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Build the server-side filter set. Stable identity = stable query key.
  const filters = useMemo(() => {
    const f: Record<string, string | undefined> = {};
    if (statusFilter) f.status = statusFilter;
    if (selectedProjectId) f.project_id = selectedProjectId;
    if (search) f.part_mark__ilike = search;
    return f;
  }, [statusFilter, selectedProjectId, search]);

  const list = useResourcePaged<Part>("parts", {
    initialPerPage: 25,
    initialOrderBy: "created_at",
    initialDir: "desc",
    filters,
  });
  const projects = useResourceList<Project>("projects", { per_page: 100 });
  const create = useCreate<Part>("parts"); // projects still needed for the "create new part" modal
  const update = useUpdate<Part>("parts");

  // Reset to page 1 whenever the filter set changes. (useResourcePaged
  // already resets on sort changes; filter changes are our responsibility
  // since they're external state.)
  useEffect(() => {
    list.setPage(1);
    setSelected(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter, selectedProjectId]);

  async function bulkUpdateStatus(status: string) {
    if (selected.size === 0) return;
    if (!confirm(`Update ${selected.size} part(s) to "${status}"?`)) return;
    setBulkBusy(true);
    try {
      const result = await FabAPI.bulkUpdate("parts", {
        ids: Array.from(selected),
        patch: { status },
      });
      if (result.failed === 0) {
        alert(`Updated ${result.succeeded} part(s) to "${status}".`);
      } else if (result.succeeded === 0) {
        const firstErr = result.failures[0]?.error?.message ?? "unknown error";
        alert(`No parts were updated.\n\nFirst error: ${firstErr}`);
      } else {
        const firstErr = result.failures[0]?.error?.message ?? "unknown error";
        alert(
          `${result.succeeded} updated, ${result.failed} failed.\n\n` +
          `First failure: ${firstErr}`,
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(`Bulk update failed: ${msg}`);
    } finally {
      setBulkBusy(false);
      setSelected(new Set());
      list.refetch();
    }
  }

  // CSV export operates on whatever the user is currently looking at.
  // For "export all 50k", they should use the dedicated Reports / CSV-
  // import-export tooling — exporting an entire table via the browser
  // is what got us into the 1000-row truncation in the first place.
  useCsvExport({
    filename: "parts",
    data: list.data?.rows,
    transform: (p) => ({
      qty:         p.quantity,
      mark:        p.part_mark,
      profile:     p.profile,
      name:        p.name,
      length:      p.length,
      grade:       p.grade,
      part_weight_lb: p.weight,
      heat_number: p.heat_number,
      assembly:    p.assembly_mark,
      status:      p.status,
    }),
  });

  // Columns match the source sheet order: QTY | Mark | Profile | Name | Length | Grade | Part Weight | Heat # | Status
  const cols: Column<Part>[] = [
    { key: "qty",     label: "QTY",         align: "right", mono: true,  sortField: "quantity",    sortAccessor: (r) => r.quantity,      render: (r) => r.quantity },
    { key: "mark",   label: "Mark",         mono: true,                  sortField: "part_mark",   sortAccessor: (r) => r.part_mark,     render: (r) => <strong style={{ fontWeight: 600 }}>{r.part_mark}</strong> },
    { key: "profile",label: "Profile",      mono: true,                  sortField: "profile",     sortAccessor: (r) => r.profile,       render: (r) => r.profile },
    { key: "name",   label: "Name",                                      sortField: "name",        sortAccessor: (r) => r.name,          render: (r) => r.name ? <span style={{ color: "var(--muted)" }}>{r.name}</span> : "—" },
    { key: "length", label: "Length",       align: "right", mono: true,  sortField: "length",      sortAccessor: (r) => r.length ?? "",  render: (r) => r.length || "—" },
    { key: "grade",  label: "Grade",                                     sortField: "grade",       sortAccessor: (r) => r.grade,         render: (r) => r.grade ?? "—" },
    { key: "weight", label: "Part Weight",  align: "right", mono: true,  sortField: "weight",      sortAccessor: (r) => r.weight ?? 0,   render: (r) => r.weight != null ? Number(r.weight).toFixed(1) + " lb" : "—" },
    { key: "heat",   label: "Heat #",       mono: true,                  sortField: "heat_number", sortAccessor: (r) => r.heat_number,   render: (r) => r.heat_number ?? "—" },
    { key: "status", label: "Status",                                    sortField: "status",      sortAccessor: (r) => r.status,        render: (r) => <StatusPill status={r.status} /> },
  ];

  const total = list.data?.total ?? 0;

  // "Create PO from not-started parts" is available to procurement roles only,
  // and requires a specific project to be selected in the global project bar.
  const canCreatePo = PO_ROLES.includes(getRole() ?? "");
  const selectedProject = projects.data?.find((p) => p.id === selectedProjectId) ?? null;

  return (
    <PageWrapper title="Parts">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[20px] font-bold" style={{ color: "var(--text)" }}>Parts List</div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>
            {total} part{total === 1 ? "" : "s"}
            {(statusFilter || selectedProjectId || search) && total > 0 && " (filtered)"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute" style={{ left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
            <input className="input" placeholder="Search part marks…" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} style={{ paddingLeft: 30, width: 240, height: 32 }} />
          </div>

          <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ height: 32, width: 160 }}>
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
          </select>
          {canCreatePo && (
            <button
              className="btn"
              onClick={() => setShowCreatePo(true)}
              disabled={!selectedProjectId}
              title={selectedProjectId ? "Create a purchase order from this project's not-started parts" : "Select a project first"}
            >
              <ShoppingCart size={14} /> Create PO
            </button>
          )}
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
        data={list.data?.rows}
        columns={cols}
        loading={list.isLoading}
        error={list.error}
        empty={{ title: "No parts yet", subtitle: "Import a Tekla / SDS2 CSV or XLSX, or add manually." }}
        rowKey={(r) => r.id}
        onRowClick={(r) => setEditing(r)}
        selectable={{ selected, onChange: setSelected }}
        server={{
          page: list.page,
          perPage: list.perPage,
          total,
          hasMore: list.data?.has_more ?? false,
          onPageChange: list.setPage,
          onPerPageChange: list.setPerPage,
          orderBy: list.orderBy,
          dir: list.dir,
          onSortChange: list.setSort,
          fetching: list.isFetching && !list.isLoading,
          pageSizeOptions: [25, 50, 100, 200],
        }}
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
      {showCreatePo && selectedProjectId && (
        <CreatePoModal
          projectId={selectedProjectId}
          projectName={selectedProject?.name ?? "this project"}
          onClose={() => setShowCreatePo(false)}
          onCreated={() => {
            setShowCreatePo(false);
            list.refetch();
          }}
        />
      )}
    </PageWrapper>
  );
}

/**
 * Turns a project's not_started parts into a new draft purchase order,
 * aggregated by material (profile + grade). Shows a server-computed preview so
 * the user sees exactly what will be ordered before confirming.
 */
function CreatePoModal({
  projectId,
  projectName,
  onClose,
  onCreated,
}: {
  projectId: string;
  projectName: string;
  onClose: () => void;
  onCreated: (result: CreatePoFromPartsResult) => void;
}) {
  const preview = usePoFromPartsPreview(projectId, true);
  const createPo = useCreatePoFromParts();
  const [form, setForm] = useState({ vendor: "", expected_date: "", total_amount: "", notes: "" });

  const partsCount = preview.data?.parts_count ?? 0;
  const hasParts = partsCount > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createPo.mutate(
      {
        project_id: projectId,
        vendor: form.vendor,
        expected_date: form.expected_date || undefined,
        total_amount: form.total_amount ? Number(form.total_amount) : undefined,
        notes: form.notes || undefined,
      },
      { onSuccess: onCreated },
    );
  }

  return (
    <ResourceModal
      title="Create PO from not-started parts"
      onClose={onClose}
      onSubmit={handleSubmit}
      submitting={createPo.isPending}
      error={createPo.error?.message ?? null}
      submitLabel={hasParts ? `Create PO (${partsCount} parts)` : "Create PO"}
      submitDisabled={!hasParts || preview.isLoading}
      width={640}
    >
      <div className="text-[12px] mb-3" style={{ color: "var(--muted)" }}>
        Project: <strong style={{ color: "var(--text)" }}>{projectName}</strong>
      </div>

      {/* Aggregated material preview */}
      {preview.isLoading ? (
        <div className="flex items-center gap-2 text-[13px] py-6 justify-center" style={{ color: "var(--muted)" }}>
          <Loader2 size={14} className="animate-spin" /> Loading not-started parts…
        </div>
      ) : preview.error ? (
        <div className="text-[13px] py-4" style={{ color: "var(--danger, #dc2626)" }}>
          Failed to load preview: {preview.error.message}
        </div>
      ) : !hasParts ? (
        <div className="card text-[13px] py-6 text-center" style={{ color: "var(--muted)" }}>
          No <strong>not-started</strong> parts in this project to order.
        </div>
      ) : (
        <div className="card mb-4" style={{ padding: 0, overflow: "hidden" }}>
          <div className="flex items-center justify-between px-3 py-2 text-[12px]" style={{ borderBottom: "1px solid var(--border)", color: "var(--muted)" }}>
            <span>{preview.data!.line_items.length} material line(s) · {partsCount} parts</span>
            <span>{preview.data!.total_weight_lb.toLocaleString()} lb total</span>
          </div>
          <div style={{ maxHeight: 220, overflowY: "auto" }}>
            <table className="w-full text-[12px]" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: "var(--muted)", textAlign: "left" }}>
                  <th className="px-3 py-1.5" style={{ fontWeight: 600 }}>Profile</th>
                  <th className="px-3 py-1.5" style={{ fontWeight: 600 }}>Grade</th>
                  <th className="px-3 py-1.5" style={{ fontWeight: 600, textAlign: "right" }}>Qty</th>
                  <th className="px-3 py-1.5" style={{ fontWeight: 600, textAlign: "right" }}>Weight (lb)</th>
                </tr>
              </thead>
              <tbody>
                {preview.data!.line_items.map((it) => (
                  <tr key={`${it.profile}-${it.grade ?? ""}`} style={{ borderTop: "1px solid var(--border)" }}>
                    <td className="px-3 py-1.5 font-mono">{it.profile}</td>
                    <td className="px-3 py-1.5">{it.grade ?? "—"}</td>
                    <td className="px-3 py-1.5 font-mono" style={{ textAlign: "right" }}>{it.qty}</td>
                    <td className="px-3 py-1.5 font-mono" style={{ textAlign: "right" }}>{it.total_weight_lb.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Vendor" required>
          <input className="input" required value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} placeholder="Triple S Steel" />
        </Field>
        <Field label="Expected date">
          <input className="input" type="date" value={form.expected_date} onChange={(e) => setForm({ ...form, expected_date: e.target.value })} />
        </Field>
      </div>
      <Field label="Total amount ($)">
        <input className="input" type="number" step="0.01" min="0" value={form.total_amount} onChange={(e) => setForm({ ...form, total_amount: e.target.value })} placeholder="Optional — parts carry no cost" />
      </Field>
      <Field label="Notes">
        <textarea className="input" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={{ height: "auto", padding: "8px 12px", resize: "vertical" }} />
      </Field>
    </ResourceModal>
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
    project_id:    initial?.project_id    ?? projects[0]?.id ?? "",
    part_mark:     initial?.part_mark     ?? "",
    assembly_mark: initial?.assembly_mark ?? "",
    name:          initial?.name          ?? "",
    profile:       initial?.profile       ?? "",
    grade:         initial?.grade         ?? "A992",
    length:        initial?.length         ?? "",
    weight:        initial?.weight?.toString()  ?? "",
    quantity:      initial?.quantity?.toString() ?? "1",
    heat_number:   initial?.heat_number   ?? "",
    phase:         initial?.phase         ?? "",
    status:        initial?.status        ?? "not_started",
  });

  return (
    <ResourceModal
      title={title}
      onClose={onClose}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          project_id:    form.project_id,
          part_mark:     form.part_mark,
          assembly_mark: form.assembly_mark || undefined,
          name:          form.name || undefined,
          profile:       form.profile,
          grade:         form.grade || undefined,
          length:        form.length || undefined,
          weight:        form.weight  ? Number(form.weight)  : undefined,
          quantity:      Number(form.quantity || 1),
          heat_number:   form.heat_number || undefined,
          phase:         form.phase || undefined,
          status:        form.status as Part["status"],
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
        <Field label="Name">
          <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="W-BEAM, COLUMN, BRACE…" />
        </Field>
      </div>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Grade">
          <input className="input" value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} />
        </Field>
        <Field label="Heat #">
          <input className="input" value={form.heat_number} onChange={(e) => setForm({ ...form, heat_number: e.target.value })} />
        </Field>
      </div>
      <div className="grid-3" style={{ gap: 12 }}>
        <Field label="Length">
          <input className="input" type="text" placeholder={"17'-9\" or 5400mm"} value={form.length} onChange={(e) => setForm({ ...form, length: e.target.value })} />
        </Field>
        <Field label="Part Weight (lb)">
          <input className="input" type="number" step="0.01" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} />
        </Field>
        <Field label="QTY">
          <input className="input" type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
        </Field>
      </div>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Phase">
          <input className="input" value={form.phase} onChange={(e) => setForm({ ...form, phase: e.target.value })} placeholder="P1" />
        </Field>
        <Field label="Status">
          <select className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
          </select>
        </Field>
      </div>
    </ResourceModal>
  );
}
