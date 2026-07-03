"use client";

import { useEffect, useMemo, useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ResourceModal, Field } from "@/components/ui/ResourceModal";
import { useResourceList, useResourcePaged, useCreate, useUpdate } from "@/hooks/useResource";
import { useCsvExport } from "@/hooks/useCsvExport";
import { useGlobalProject } from "@/hooks/useGlobalProject";
import { FabAPI } from "@/lib/api";
import { Plus, Search, Loader2, X } from "lucide-react";

interface Part {
  id: string;
  part_mark: string;
  assembly_mark: string | null;
  name: string | null;          // Tekla "Name" column — member type/label (e.g. W-BEAM, COLUMN)
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

interface Project { id: string; name: string; number: string; }

const STATUS_OPTIONS = ["not_started", "in_progress", "complete", "shipped", "on_hold"];

// Display length stored as decimal inches in feet-inches notation (17'-9")
// so it matches what the user sees in their Tekla/SDS2 sheet.
function formatLength(inches: number | null): string {
  if (inches == null) return "—";
  const totalIn = Number(inches);
  if (!isFinite(totalIn) || totalIn <= 0) return "—";
  if (totalIn < 12) return `${totalIn.toFixed(3).replace(/\.?0+$/, "")}\u2033`; // pure inches if tiny
  const ft = Math.floor(totalIn / 12);
  const inPart = totalIn - ft * 12;
  const inStr = inPart < 0.001 ? "0" : inPart.toFixed(3).replace(/\.?0+$/, "");
  return `${ft}\u2032-${inStr}\u2033`; // e.g.  17′-9″
}

export default function PartsPage() {
  const { selectedProjectId } = useGlobalProject();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [showNew, setShowNew] = useState(false);
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
      length_in:   p.length,
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
    { key: "length", label: "Length",       align: "right", mono: true,  sortField: "length",      sortAccessor: (r) => r.length ?? 0,   render: (r) => formatLength(r.length) },
    { key: "grade",  label: "Grade",                                     sortField: "grade",       sortAccessor: (r) => r.grade,         render: (r) => r.grade ?? "—" },
    { key: "weight", label: "Part Weight",  align: "right", mono: true,  sortField: "weight",      sortAccessor: (r) => r.weight ?? 0,   render: (r) => r.weight != null ? Number(r.weight).toFixed(1) + " lb" : "—" },
    { key: "heat",   label: "Heat #",       mono: true,                  sortField: "heat_number", sortAccessor: (r) => r.heat_number,   render: (r) => r.heat_number ?? "—" },
    { key: "status", label: "Status",                                    sortField: "status",      sortAccessor: (r) => r.status,        render: (r) => <StatusPill status={r.status} /> },
  ];

  const total = list.data?.total ?? 0;

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
    project_id:    initial?.project_id    ?? projects[0]?.id ?? "",
    part_mark:     initial?.part_mark     ?? "",
    assembly_mark: initial?.assembly_mark ?? "",
    name:          initial?.name          ?? "",
    profile:       initial?.profile       ?? "",
    grade:         initial?.grade         ?? "A992",
    length:        initial?.length?.toString()  ?? "",
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
          length:        form.length  ? Number(form.length)  : undefined,
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
        <Field label="Length (decimal in.)">
          <input className="input" type="number" step="0.001" value={form.length} onChange={(e) => setForm({ ...form, length: e.target.value })} />
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
