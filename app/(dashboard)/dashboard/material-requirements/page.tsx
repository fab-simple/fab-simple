"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { useResourceList, useResourceListAll, useCreate, useImportMaterialRequirements } from "@/hooks/useResource";
import { NewRfqModal } from "@/components/rfqs/NewRfqModal";
import { ResourceModal, Field } from "@/components/ui/ResourceModal";
import type { ImportMaterialRequirementsRow, ImportMaterialRequirementsResult } from "@/lib/api";
import {
  X,
  CheckCircle2,
  CheckSquare,
  Square,
  Search,
  ChevronDown,
  ChevronUp,
  Send,
  PackageCheck,
  Zap,
  LayoutList,
  Clock,
  BadgeCheck,
  XCircle,
  Layers,
  Plus,
  Loader2,
} from "lucide-react";

interface MaterialRequirement {
  id: string;
  mr_number: string;
  profile: string;
  name: string | null;
  grade: string | null;
  quantity: number;
  length: string | null;
  weight?: number | null;
  required_date: string | null;
  status: string;
  notes: string | null;
  project_id: string;
}

interface Project {
  id: string;
  name: string;
  number?: string;
  status?: string;
  is_archived?: boolean;
}

type StatusTab = "all" | "open" | "rfq_created" | "awarded" | "fulfilled" | "cancelled";

export default function MaterialRequirementsPage() {
  const router = useRouter();

  // Fetch active projects (exclude archived projects)
  const projectsQuery = useResourceList<Project>("projects", {
    limit: "200",
    order_by: "name",
    dir: "asc",
    is_archived: "false",
  });

  const activeProjects = useMemo(() => {
    return (projectsQuery.data ?? []).filter(
      (p) => !p.is_archived && p.status !== "archived",
    );
  }, [projectsQuery.data]);

  const activeProjectIds = useMemo(() => new Set(activeProjects.map((p) => p.id)), [activeProjects]);
  const projectLookup = useMemo(() => new Map(activeProjects.map((p) => [p.id, p])), [activeProjects]);

  // Fetch all material requirements across the company
  const list = useResourceList<MaterialRequirement>("material_requirements", {
    order_by: "created_at",
    dir: "desc",
    per_page: 200,
  });

  const create = useCreate<MaterialRequirement>("material_requirements");

  // Default project for pre-filling modals (first active project alphabetically)
  const defaultProjectId = activeProjects[0]?.id;

  const [showNew, setShowNew] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [showRfqModal, setShowRfqModal] = useState(false);
  const [rfqModalInitialMrIds, setRfqModalInitialMrIds] = useState<string[] | undefined>(undefined);

  // Filters state
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set());
  const [projectSearch, setProjectSearch] = useState("");
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusTab>("all");

  // Row selection state for bulk actions
  const [selectedMrIds, setSelectedMrIds] = useState<Set<string>>(new Set());

  // Only consider MRs that belong to active (non-archived) projects
  const activeMrs = useMemo(() => {
    if (!list.data) return undefined;
    return list.data.filter((r) => activeProjectIds.has(r.project_id));
  }, [list.data, activeProjectIds]);

  // Project-filtered MRs (before status filter)
  const projectFilteredMrs = useMemo(() => {
    if (!activeMrs) return [];
    if (selectedProjectIds.size === 0) return activeMrs;
    return activeMrs.filter((r) => selectedProjectIds.has(r.project_id));
  }, [activeMrs, selectedProjectIds]);

  // Status counts based on the project-filtered set
  const statusCounts = useMemo(() => {
    const counts = {
      all: projectFilteredMrs.length,
      open: 0,
      rfq_created: 0,
      awarded: 0,
      fulfilled: 0,
      cancelled: 0,
    };
    for (const mr of projectFilteredMrs) {
      if (mr.status in counts) {
        counts[mr.status as keyof typeof counts]++;
      }
    }
    return counts;
  }, [projectFilteredMrs]);

  // Count MRs per active project
  const mrCountsByProject = useMemo(() => {
    const map = new Map<string, number>();
    for (const mr of activeMrs ?? []) {
      map.set(mr.project_id, (map.get(mr.project_id) ?? 0) + 1);
    }
    return map;
  }, [activeMrs]);

  function toggleProject(projectId: string) {
    setSelectedProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else next.add(projectId);
      return next;
    });
  }

  const isAllProjects = selectedProjectIds.size === 0 || (activeProjects.length > 0 && selectedProjectIds.size === activeProjects.length);

  function selectAllProjects() {
    setSelectedProjectIds(new Set());
  }

  function selectEveryProject() {
    setSelectedProjectIds(new Set(activeProjects.map((p) => p.id)));
  }

  // Filtered projects for the checklist
  const visibleProjects = useMemo(() => {
    if (!projectSearch.trim()) return activeProjects;
    const q = projectSearch.trim().toLowerCase();
    return activeProjects.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.number && p.number.toLowerCase().includes(q)),
    );
  }, [activeProjects, projectSearch]);

  // Final filtered MR rows for the table
  const finalTableData = useMemo(() => {
    if (!projectFilteredMrs) return undefined;
    if (statusFilter === "all") return projectFilteredMrs;
    return projectFilteredMrs.filter((r) => r.status === statusFilter);
  }, [projectFilteredMrs, statusFilter]);

  // Count how many of the currently checked rows are open
  const selectedOpenCount = useMemo(() => {
    if (selectedMrIds.size === 0 || !activeMrs) return 0;
    return activeMrs.filter((m) => selectedMrIds.has(m.id) && m.status === "open").length;
  }, [selectedMrIds, activeMrs]);

  // Table columns (no per-row "Raise RFQ" button as per requirements)
  const cols: Column<MaterialRequirement>[] = [
    {
      key: "num",
      label: "MR #",
      mono: true,
      sortAccessor: (r) => r.mr_number,
      render: (r) => <strong>{r.mr_number}</strong>,
    },
    {
      key: "project",
      label: "Project",
      sortAccessor: (r) => projectLookup.get(r.project_id)?.name ?? "",
      render: (r) => {
        const p = projectLookup.get(r.project_id);
        if (!p) return <span style={{ color: "var(--muted)" }}>—</span>;
        return (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium text-[13px]" style={{ color: "var(--text)" }}>{p.name}</span>
            {p.number && (
              <span className="pill" style={{ fontSize: 10, padding: "1px 5px", background: "var(--bg-muted)" }}>
                {p.number}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "profile",
      label: "Profile",
      mono: true,
      sortAccessor: (r) => r.profile,
      render: (r) => r.profile,
    },
    {
      key: "name",
      label: "Name",
      sortAccessor: (r) => r.name ?? "",
      render: (r) => r.name ?? "—",
    },
    {
      key: "grade",
      label: "Grade",
      sortAccessor: (r) => r.grade ?? "",
      render: (r) => r.grade ?? "—",
    },
    {
      key: "qty",
      label: "Quantity",
      align: "right",
      mono: true,
      sortAccessor: (r) => r.quantity,
      render: (r) => r.quantity,
    },
    {
      key: "len",
      label: "Length",
      align: "right",
      mono: true,
      sortAccessor: (r) => r.length ?? "",
      render: (r) => r.length ?? "—",
    },
    {
      key: "notes",
      label: "Notes",
      render: (r) => (
        <span
          title={r.notes ?? undefined}
          style={{
            maxWidth: 220,
            display: "inline-block",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            verticalAlign: "middle",
          }}
        >
          {r.notes ?? "—"}
        </span>
      ),
    },
    {
      key: "req",
      label: "Required by",
      sortAccessor: (r) => r.required_date ?? "",
      render: (r) => (r.required_date ? new Date(r.required_date).toLocaleDateString() : "—"),
    },
    {
      key: "status",
      label: "Status",
      sortAccessor: (r) => r.status,
      render: (r) => {
        if (r.status === "open") {
          return (
            <span
              className="pill inline-flex items-center gap-1.5 font-semibold"
              style={{
                background: "rgba(245,158,11,0.12)",
                color: "#B45309",
                borderColor: "rgba(245,158,11,0.35)",
              }}
              title="Open requirement — ready to be shopped out via an RFQ"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              Open · Needs RFQ
            </span>
          );
        }
        if (r.status === "rfq_created") {
          return (
            <span
              className="pill inline-flex items-center gap-1 font-medium"
              style={{
                background: "rgba(99,102,241,0.1)",
                color: "#4F46E5",
                borderColor: "rgba(99,102,241,0.25)",
              }}
              title="Included in an active RFQ shopping to vendors"
            >
              <Send size={11} />
              RFQ Sent
            </span>
          );
        }
        if (r.status === "awarded") {
          return (
            <span
              className="pill inline-flex items-center gap-1 font-medium"
              style={{
                background: "rgba(16,185,129,0.1)",
                color: "#047857",
                borderColor: "rgba(16,185,129,0.25)",
              }}
              title="Quote accepted and draft PO generated"
            >
              <CheckCircle2 size={11} />
              Awarded
            </span>
          );
        }
        if (r.status === "fulfilled") {
          return (
            <span
              className="pill inline-flex items-center gap-1 font-medium"
              style={{
                background: "rgba(6,182,212,0.1)",
                color: "#0e7490",
                borderColor: "rgba(6,182,212,0.25)",
              }}
              title="Fulfilled from inventory stock or delivery"
            >
              <PackageCheck size={11} />
              Fulfilled
            </span>
          );
        }
        return <span className="pill pill-ns">{r.status}</span>;
      },
    },
  ];

  return (
    <PageWrapper title="Material Requirements">

      {/* ── Command Bar ──────────────────────────────────────────── */}
      <div className="mr-command-bar">
        <div>
          <h1 className="mr-title">Material Requirements</h1>
          <p className="mr-subtitle">
            {statusCounts.all} total
            {selectedProjectIds.size > 0
              ? ` · ${selectedProjectIds.size} of ${activeProjects.length} projects`
              : ` · ${activeProjects.length} active projects`}
          </p>
        </div>
        <div className="mr-actions">
          <button
            className="btn btn-subtle flex items-center gap-1.5"
            onClick={() => setShowGenerate(true)}
            disabled={activeProjects.length === 0}
          >
            <Layers size={14} /> Generate from Parts
          </button>
          <button
            className="btn btn-subtle flex items-center gap-1.5"
            onClick={() => setShowNew(true)}
            disabled={activeProjects.length === 0}
          >
            <Plus size={14} /> New Requirement
          </button>
          <button
            className="btn btn-primary flex items-center gap-1.5"
            onClick={() => { setRfqModalInitialMrIds(undefined); setShowRfqModal(true); }}
            disabled={statusCounts.open === 0}
            title={statusCounts.open === 0 ? "No open requirements to raise an RFQ for" : "Bundle all open requirements into an RFQ"}
          >
            <Send size={14} />
            Raise RFQ
            {statusCounts.open > 0 && (
              <span className="mr-rfq-badge">{statusCounts.open} open</span>
            )}
          </button>
        </div>
      </div>

      {/* ── KPI Stat Strip ───────────────────────────────────────── */}
      <div className="mr-kpi-strip">

        {/* All */}
        <button
          type="button"
          className={`mr-kpi-card mr-kpi-all ${statusFilter === "all" ? "mr-kpi-active" : ""}`}
          onClick={() => setStatusFilter("all")}
        >
          <div className="mr-kpi-top">
            <span className="mr-kpi-icon-wrap mr-icon-all">
              <LayoutList size={15} />
            </span>
            <span className="mr-kpi-count">{statusCounts.all}</span>
          </div>
          <span className="mr-kpi-label">All Requirements</span>
          <span className="mr-kpi-accent mr-kpi-accent-all" />
        </button>

        {/* Open */}
        <button
          type="button"
          className={`mr-kpi-card mr-kpi-open ${statusFilter === "open" ? "mr-kpi-active" : ""}`}
          onClick={() => setStatusFilter("open")}
        >
          <div className="mr-kpi-top">
            <span className="mr-kpi-icon-wrap mr-icon-open">
              <Clock size={15} />
            </span>
            <div className="mr-kpi-header-row">
              <span className="mr-kpi-count">{statusCounts.open}</span>
              {statusCounts.open > 0 && <span className="mr-kpi-pulse" />}
            </div>
          </div>
          <span className="mr-kpi-label">Open · Needs RFQ</span>
          <span className="mr-kpi-accent mr-kpi-accent-open" />
        </button>

        {/* RFQ Sent */}
        <button
          type="button"
          className={`mr-kpi-card mr-kpi-rfq ${statusFilter === "rfq_created" ? "mr-kpi-active" : ""}`}
          onClick={() => setStatusFilter("rfq_created")}
        >
          <div className="mr-kpi-top">
            <span className="mr-kpi-icon-wrap mr-icon-rfq">
              <Send size={14} />
            </span>
            <span className="mr-kpi-count">{statusCounts.rfq_created}</span>
          </div>
          <span className="mr-kpi-label">RFQ Sent</span>
          <span className="mr-kpi-accent mr-kpi-accent-rfq" />
        </button>

        {/* Awarded */}
        <button
          type="button"
          className={`mr-kpi-card mr-kpi-awarded ${statusFilter === "awarded" ? "mr-kpi-active" : ""}`}
          onClick={() => setStatusFilter("awarded")}
        >
          <div className="mr-kpi-top">
            <span className="mr-kpi-icon-wrap mr-icon-awarded">
              <BadgeCheck size={15} />
            </span>
            <span className="mr-kpi-count">{statusCounts.awarded}</span>
          </div>
          <span className="mr-kpi-label">Awarded</span>
          <span className="mr-kpi-accent mr-kpi-accent-awarded" />
        </button>

        {/* Fulfilled */}
        <button
          type="button"
          className={`mr-kpi-card mr-kpi-fulfilled ${statusFilter === "fulfilled" ? "mr-kpi-active" : ""}`}
          onClick={() => setStatusFilter("fulfilled")}
        >
          <div className="mr-kpi-top">
            <span className="mr-kpi-icon-wrap mr-icon-fulfilled">
              <PackageCheck size={15} />
            </span>
            <span className="mr-kpi-count">{statusCounts.fulfilled}</span>
          </div>
          <span className="mr-kpi-label">Fulfilled</span>
          <span className="mr-kpi-accent mr-kpi-accent-fulfilled" />
        </button>

        {statusCounts.cancelled > 0 && (
          <button
            type="button"
            className={`mr-kpi-card mr-kpi-cancelled ${statusFilter === "cancelled" ? "mr-kpi-active" : ""}`}
            onClick={() => setStatusFilter("cancelled")}
          >
            <div className="mr-kpi-top">
              <span className="mr-kpi-icon-wrap mr-icon-cancelled">
                <XCircle size={15} />
              </span>
              <span className="mr-kpi-count">{statusCounts.cancelled}</span>
            </div>
            <span className="mr-kpi-label">Cancelled</span>
            <span className="mr-kpi-accent mr-kpi-accent-cancelled" />
          </button>
        )}
      </div>

      {/* ── Project Filter Bar ───────────────────────────────────── */}
      <div className="mr-filter-bar">
        {/* Search */}
        <div className="mr-filter-search">
          <Search size={13} className="mr-filter-search-icon" />
          <input
            type="text"
            className="mr-filter-search-input"
            placeholder="Search projects…"
            value={projectSearch}
            onChange={(e) => setProjectSearch(e.target.value)}
          />
          {projectSearch && (
            <button type="button" onClick={() => setProjectSearch("")} className="mr-filter-clear-btn">
              <X size={11} />
            </button>
          )}
        </div>

        {/* Divider */}
        <span className="mr-filter-divider" />

        {/* Chip: All Projects */}
        <label className={`mr-project-chip ${isAllProjects ? "mr-project-chip-active" : ""}`}>
          <input type="checkbox" className="sr-only" checked={isAllProjects} onChange={selectAllProjects} />
          {isAllProjects ? <CheckSquare size={13} /> : <Square size={13} />}
          <span>All Projects</span>
          <span className="mr-chip-count">{activeProjects.length}</span>
        </label>

        {/* Per-project chips */}
        {visibleProjects.map((p) => {
          const isChecked = selectedProjectIds.has(p.id);
          const mrCount = mrCountsByProject.get(p.id) ?? 0;
          return (
            <label key={p.id} className={`mr-project-chip ${isChecked ? "mr-project-chip-active" : ""}`}>
              <input type="checkbox" className="sr-only" checked={isChecked} onChange={() => toggleProject(p.id)} />
              {isChecked ? <CheckSquare size={13} /> : <Square size={13} />}
              <span className="mr-chip-name">{p.name}</span>
              {p.number && <span className="mr-chip-num">({p.number})</span>}
              <span className="mr-chip-count">{mrCount}</span>
            </label>
          );
        })}

        {/* Show more / collapse */}
        {activeProjects.length > 8 && (
          <button
            type="button"
            onClick={() => setIsFilterExpanded(!isFilterExpanded)}
            className="mr-project-chip"
            style={{ borderStyle: "dashed" }}
          >
            {isFilterExpanded ? (
              <><ChevronUp size={13} /> Collapse</>
            ) : (
              <><ChevronDown size={13} /> +{activeProjects.length - 8} more</>
            )}
          </button>
        )}

        {visibleProjects.length === 0 && projectSearch && (
          <span className="mr-filter-empty">No projects match &ldquo;{projectSearch}&rdquo;</span>
        )}

        {/* Clear filter shortcut */}
        {selectedProjectIds.size > 0 && (
          <button type="button" onClick={selectAllProjects} className="mr-filter-clear-link">
            <X size={11} /> Clear filter
          </button>
        )}
      </div>

      {/* ── Bulk Action Tray (contextual) ────────────────────────── */}
      {selectedMrIds.size > 0 && (
        <div className="mr-bulk-tray">
          <div className="mr-bulk-info">
            <span className="mr-bulk-count">{selectedMrIds.size} selected</span>
            {selectedOpenCount > 0 ? (
              <span className="mr-bulk-detail">
                <strong style={{ color: "#B45309" }}>{selectedOpenCount} open</strong> ready for RFQ
              </span>
            ) : (
              <span className="mr-bulk-detail muted">none of the selected items are open</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn btn-primary btn-sm flex items-center gap-1.5"
              disabled={selectedOpenCount === 0}
              onClick={() => {
                const openIds = Array.from(selectedMrIds).filter((id) => {
                  const item = activeMrs?.find((m) => m.id === id);
                  return item?.status === "open";
                });
                setRfqModalInitialMrIds(openIds);
                setShowRfqModal(true);
              }}
              title={selectedOpenCount === 0 ? "Select at least one open requirement to create an RFQ" : "Create an RFQ with the selected open requirements"}
            >
              <Send size={13} />
              Raise RFQ for Selected ({selectedOpenCount})
            </button>
            <button
              type="button"
              className="btn btn-subtle btn-sm"
              onClick={() => setSelectedMrIds(new Set())}
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* ── Open Items Callout (only when viewing All with no selection) ── */}
      {statusFilter === "all" && statusCounts.open > 0 && selectedMrIds.size === 0 && (
        <div className="mr-callout">
          <Zap size={14} className="mr-callout-icon" />
          <span className="mr-callout-text">
            <strong>{statusCounts.open} open requirement{statusCounts.open === 1 ? "" : "s"}</strong> waiting for vendor quotes
          </span>
          <button
            type="button"
            className="mr-callout-btn"
            onClick={() => { setRfqModalInitialMrIds(undefined); setShowRfqModal(true); }}
          >
            <Send size={11} /> Raise RFQ Now
          </button>
        </div>
      )}

      {/* ── Main Table ───────────────────────────────────────────── */}
      <DataTable
        data={finalTableData}
        columns={cols}
        loading={list.isLoading || projectsQuery.isLoading}
        error={list.error}
        empty={{
          title: statusFilter !== "all"
            ? `No ${statusFilter.replace("_", " ")} requirements`
            : "No material requirements found",
          subtitle: statusFilter !== "all"
            ? `No requirements with status "${statusFilter}". Switch to "All Requirements" above.`
            : selectedProjectIds.size > 0
              ? "No requirements match the selected projects."
              : `Click "Generate from Parts" to auto-create requirements from your parts list, or add one manually.`,
        }}
        rowKey={(r) => r.id}
        selectable={{
          selected: selectedMrIds,
          onChange: setSelectedMrIds,
        }}
      />

      {/* ── Modals ───────────────────────────────────────────────── */}
      {showNew && (
        <NewModal
          projects={activeProjects}
          defaultProjectId={defaultProjectId}
          onClose={() => setShowNew(false)}
          onSubmit={(p) => create.mutate(p, { onSuccess: () => setShowNew(false) })}
          submitting={create.isPending}
          error={create.error?.message ?? null}
        />
      )}
      {showGenerate && (
        <GenerateFromPartsModal
          projects={activeProjects}
          initialProjectId={defaultProjectId}
          onClose={() => setShowGenerate(false)}
        />
      )}
      {showRfqModal && (
        <NewRfqModal
          initialSelectedMrIds={rfqModalInitialMrIds}
          onClose={() => { setShowRfqModal(false); setRfqModalInitialMrIds(undefined); }}
          onSuccess={(rfqId) => {
            setShowRfqModal(false);
            setRfqModalInitialMrIds(undefined);
            setSelectedMrIds(new Set());
            list.refetch();
            router.push(`/dashboard/rfqs/${rfqId}`);
          }}
        />
      )}
    </PageWrapper>
  );
}


function NewModal({
  projects,
  defaultProjectId,
  onClose,
  onSubmit,
  submitting,
  error,
}: {
  projects: Project[];
  defaultProjectId?: string;
  onClose: () => void;
  onSubmit: (p: Record<string, unknown>) => void;
  submitting: boolean;
  error: string | null;
}) {
  const [f, setF] = useState({
    project_id: defaultProjectId ?? projects[0]?.id ?? "",
    profile: "",
    name: "",
    grade: "",
    quantity: "1",
    length: "",
    weight: "",
    required_date: "",
    notes: "",
  });

  return (
    <ResourceModal
      title="New material requirement"
      onClose={onClose}
      submitting={submitting}
      error={error}
      submitDisabled={!f.project_id || !f.profile.trim() || !f.name.trim()}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          project_id: f.project_id,
          profile: f.profile.trim(),
          name: f.name.trim(),
          grade: f.grade || undefined,
          quantity: Number(f.quantity),
          length: f.length.trim() || undefined,
          weight: f.weight ? Number(f.weight) : undefined,
          required_date: f.required_date || undefined,
          notes: f.notes || undefined,
        });
      }}
    >
      <Field label="Project" required>
        <select
          className="input"
          required
          value={f.project_id}
          onChange={(e) => setF({ ...f, project_id: e.target.value })}
        >
          <option value="" disabled>Select a project…</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} {p.number ? `(${p.number})` : ""}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Profile" required>
          <input className="input" required value={f.profile} onChange={(e) => setF({ ...f, profile: e.target.value })} placeholder="W14x82" />
        </Field>
        <Field label="Name / Description" required>
          <input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="COLUMN" />
        </Field>
      </div>

      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Grade">
          <input className="input" value={f.grade} onChange={(e) => setF({ ...f, grade: e.target.value })} placeholder="A992" />
        </Field>
        <Field label="Quantity" required>
          <input className="input" type="number" min="0.01" step="0.01" required value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} />
        </Field>
      </div>

      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Length">
          <input className="input" value={f.length} onChange={(e) => setF({ ...f, length: e.target.value })} placeholder={'26\'-9 9/16"'} />
        </Field>
        <Field label="Weight (lb)">
          <input className="input" type="number" step="0.01" value={f.weight} onChange={(e) => setF({ ...f, weight: e.target.value })} />
        </Field>
      </div>

      <Field label="Required by">
        <input className="input" type="date" value={f.required_date} onChange={(e) => setF({ ...f, required_date: e.target.value })} />
      </Field>

      <Field label="Notes">
        <textarea
          className="input"
          rows={2}
          value={f.notes}
          onChange={(e) => setF({ ...f, notes: e.target.value })}
          style={{ height: "auto", padding: "8px 12px", resize: "vertical" }}
        />
      </Field>
    </ResourceModal>
  );
}

// ── Types & helpers for GenerateFromPartsModal ──────────────────────────────

interface PartRow {
  id: string;
  part_mark: string;
  profile: string | null;
  name: string | null;
  grade: string | null;
  quantity: number | null;
  length: string | null;
}

interface AggregatedRow {
  profile: string;
  name: string | null;
  grade: string | null;
  quantity: number;
  length: string | null;
  notes: string | null;
  sourceRowCount: number;
}

function aggregateParts(parts: PartRow[]): { aggregated: AggregatedRow[]; skippedCount: number } {
  let skippedCount = 0;
  const map = new Map<string, AggregatedRow>();

  for (const part of parts) {
    if (!part.profile || !part.quantity) {
      skippedCount++;
      continue;
    }
    const key = [part.profile, part.name ?? "", part.grade ?? "", part.length ?? ""].join("|");
    const existing = map.get(key);
    if (existing) {
      existing.quantity += part.quantity;
      existing.sourceRowCount++;
      // Append part_mark to notes
      const marks = existing.notes ? existing.notes.split(", ") : [];
      marks.push(part.part_mark);
      existing.notes = marks.join(", ");
    } else {
      map.set(key, {
        profile: part.profile,
        name: part.name,
        grade: part.grade,
        quantity: part.quantity,
        length: part.length,
        notes: part.part_mark,
        sourceRowCount: 1,
      });
    }
  }

  return { aggregated: Array.from(map.values()), skippedCount };
}

function GenerateFromPartsModal({
  projects,
  initialProjectId,
  onClose,
}: {
  projects: Project[];
  initialProjectId?: string;
  onClose: () => void;
}) {
  const importMr = useImportMaterialRequirements();
  const [result, setResult] = useState<ImportMaterialRequirementsResult | null>(null);
  const [targetProjectId, setTargetProjectId] = useState<string>(initialProjectId ?? projects[0]?.id ?? "");

  const partsQuery = useResourceListAll<PartRow>(
    "parts",
    targetProjectId
      ? {
        project_id: targetProjectId,
        order_by: "part_mark",
        dir: "asc",
      }
      : undefined,
    { enabled: !!targetProjectId },
  );

  const parts = partsQuery.data ?? [];

  const { aggregated, skippedCount } = useMemo(
    () => aggregateParts(parts),
    [parts],
  );

  const canImport = aggregated.length > 0 && !partsQuery.isLoading && !!targetProjectId;

  function handleImport() {
    if (!canImport) return;
    const rows: ImportMaterialRequirementsRow[] = aggregated.map((row) => ({
      profile: row.profile,
      name: row.name ?? undefined,
      grade: row.grade ?? undefined,
      quantity: row.quantity,
      length: row.length ?? undefined,
      notes: row.notes ?? undefined,
    }));
    importMr.mutate({ project_id: targetProjectId, rows }, { onSuccess: (res) => setResult(res) });
  }

  const selectedProject = projects.find((p) => p.id === targetProjectId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(15,23,42,0.5)" }} onClick={onClose}>
      <div className="card" style={{ width: 760, maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div className="card-header" style={{ position: "sticky", top: 0, zIndex: 5, background: "var(--bg-card)" }}>
          <div>
            <div className="card-title">Generate Material Requirements from Parts</div>
            <div className="card-sub">
              Parts already imported for an active project are grouped by profile + name + grade + length
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn btn-sm" style={{ padding: 6, height: 28, width: 28, justifyContent: "center" }}>
            <X size={14} />
          </button>
        </div>

        <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label className="text-[12px] font-semibold block mb-1" style={{ color: "var(--text)" }}>
              Target Project
            </label>
            <select
              className="input"
              value={targetProjectId}
              onChange={(e) => {
                setTargetProjectId(e.target.value);
                setResult(null);
              }}
              disabled={importMr.isPending}
            >
              <option value="" disabled>Select a project…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.number ? `(${p.number})` : ""}
                </option>
              ))}
            </select>
          </div>

          {result ? (
            <>
              <div
                className="flex items-center gap-2 p-3 rounded-lg border"
                style={{ background: "rgba(34,197,94,0.08)", borderColor: "rgba(34,197,94,0.3)" }}
              >
                <CheckCircle2 size={16} style={{ color: "var(--green)" }} />
                <span className="text-[13px]" style={{ color: "var(--text)" }}>
                  Imported <strong>{result.summary.inserted}</strong> material requirement{result.summary.inserted === 1 ? "" : "s"} for <strong>{selectedProject?.name}</strong>
                  {result.summary.errors > 0 && <span style={{ color: "#DC2626" }}> · {result.summary.errors} failed</span>}
                </span>
              </div>
              {result.errors.length > 0 && (
                <details open>
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
              <div className="flex justify-end gap-2">
                <button className="btn btn-primary" onClick={onClose}>Done</button>
              </div>
            </>
          ) : !targetProjectId ? (
            <div className="py-8 text-center text-[13px]" style={{ color: "var(--muted)" }}>
              Please select an active project above to load its imported parts.
            </div>
          ) : partsQuery.isLoading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-[13px]" style={{ color: "var(--muted)" }}>
              <Loader2 size={16} className="animate-spin" /> Loading parts…
            </div>
          ) : partsQuery.error ? (
            <div className="text-[13px] py-4" style={{ color: "#DC2626" }}>
              Failed to load parts: {partsQuery.error.message}
            </div>
          ) : parts.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <Layers size={32} style={{ color: "var(--muted)" }} />
              <div className="text-[14px] font-semibold" style={{ color: "var(--text)" }}>No parts imported yet for this project</div>
              <div className="text-[12px]" style={{ color: "var(--muted)", maxWidth: 360 }}>
                Import a Tekla / SDS2 sheet on the <strong>Import Tekla Model</strong> page first —
                material requirements will be generated automatically from those parts.
              </div>
            </div>
          ) : (
            <>
              <div
                className="flex items-center gap-2 p-3 rounded-lg border text-[12px]"
                style={{ background: "rgba(79,70,229,0.05)", borderColor: "rgba(79,70,229,0.2)", color: "var(--muted)" }}
              >
                <Layers size={14} style={{ color: "var(--primary)", flexShrink: 0 }} />
                <span>
                  Using <strong style={{ color: "var(--text)" }}>{parts.length} part{parts.length === 1 ? "" : "s"}</strong> already
                  imported for this project — grouped into{" "}
                  <strong style={{ color: "var(--text)" }}>{aggregated.length} requirement{aggregated.length === 1 ? "" : "s"}</strong>
                  {skippedCount > 0 && (
                    <span style={{ color: "#D97706" }}> · {skippedCount} skipped (missing profile or quantity)</span>
                  )}
                </span>
              </div>

              <div>
                <div className="text-[11px] uppercase font-semibold tracking-wider mb-1.5" style={{ color: "var(--muted)" }}>
                  Preview — {aggregated.length} requirement{aggregated.length === 1 ? "" : "s"} after grouping
                </div>
                <div style={{ border: "1px solid var(--border)", borderRadius: 8, maxHeight: 320, overflowY: "auto" }}>
                  <table className="w-full text-[12px]" style={{ borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border)", position: "sticky", top: 0, background: "var(--bg-card)" }}>
                        <th className="text-left p-2">Profile</th>
                        <th className="text-left p-2">Name</th>
                        <th className="text-left p-2">Grade</th>
                        <th className="text-right p-2">Qty</th>
                        <th className="text-left p-2">Length</th>
                        <th className="text-left p-2">Part Marks (Notes)</th>
                        <th className="text-right p-2">Source parts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aggregated.map((row, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td className="p-2 font-mono">{row.profile}</td>
                          <td className="p-2">{row.name ?? "—"}</td>
                          <td className="p-2">{row.grade ?? "—"}</td>
                          <td className="p-2 text-right font-mono">{row.quantity}</td>
                          <td className="p-2">{row.length ?? "—"}</td>
                          <td className="p-2" style={{ color: "var(--muted)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {row.notes ?? "—"}
                          </td>
                          <td className="p-2 text-right font-mono" style={{ color: "var(--muted)" }}>{row.sourceRowCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {importMr.error && (
                <div className="pill pill-red" style={{ padding: "8px 12px", fontSize: 12 }}>{importMr.error.message}</div>
              )}

              <div className="flex justify-end gap-2">
                <button type="button" onClick={onClose} className="btn">Cancel</button>
                <button type="button" className="btn btn-primary" disabled={!canImport || importMr.isPending} onClick={handleImport}>
                  {importMr.isPending ? <Loader2 size={14} className="animate-spin" /> : <Layers size={14} />}
                  {importMr.isPending ? "Importing…" : `Import ${aggregated.length || ""} requirement${aggregated.length === 1 ? "" : "s"}`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
