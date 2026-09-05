"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { useResourceList } from "@/hooks/useResource";
import { NewRfqModal } from "@/components/rfqs/NewRfqModal";
import {
  X,
  CheckCircle2,
  Building2,
  CheckSquare,
  Square,
  Search,
  ChevronDown,
  ChevronUp,
  Send,
  PackageCheck,
  Zap,
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
      {/* Top Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <div className="text-[20px] font-bold" style={{ color: "var(--text)" }}>Material Requirements</div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>
            {statusCounts.all} requirements · {statusCounts.open} open
            {selectedProjectIds.size > 0
              ? ` · filtered by ${selectedProjectIds.size} of ${activeProjects.length} active projects`
              : ` · across all ${activeProjects.length} active projects`}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Primary Call to Action: Raise RFQ for open items */}
          <button
            className="btn btn-primary flex items-center gap-1.5"
            onClick={() => {
              setRfqModalInitialMrIds(undefined); // all open MRs
              setShowRfqModal(true);
            }}
            disabled={statusCounts.open === 0}
            title={statusCounts.open === 0 ? "No open requirements to raise an RFQ for" : "Create an RFQ to shop open requirements to vendors"}
          >
            <Send size={14} />
            Raise RFQ ({statusCounts.open} Open)
          </button>
        </div>
      </div>

      {/* Scalable Projects Filter Card */}
      <div
        className="card mb-3"
        style={{
          padding: "12px 16px",
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: 10,
        }}
      >
        <div className="flex items-center justify-between gap-3 flex-wrap mb-2.5 pb-2 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
              <Building2 size={14} style={{ color: "var(--primary)" }} />
              <span>Filter by Project</span>
            </div>

            {selectedProjectIds.size > 0 ? (
              <span className="pill pill-primary" style={{ fontSize: 11, padding: "1px 8px" }}>
                {selectedProjectIds.size} of {activeProjects.length} selected ({projectFilteredMrs.length} MRs)
              </span>
            ) : (
              <span className="pill" style={{ fontSize: 11, padding: "1px 8px", background: "var(--bg-muted)", color: "var(--muted)" }}>
                All {activeProjects.length} active projects ({activeMrs?.length ?? 0} MRs)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex items-center" style={{ minWidth: 180 }}>
              <Search size={13} style={{ position: "absolute", left: 8, color: "var(--muted)", pointerEvents: "none" }} />
              <input
                type="text"
                className="input text-[12px]"
                style={{ height: 28, paddingLeft: 26, paddingRight: 8 }}
                placeholder="Search projects…"
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
              />
              {projectSearch && (
                <button
                  type="button"
                  onClick={() => setProjectSearch("")}
                  className="btn btn-ghost"
                  style={{ position: "absolute", right: 2, padding: 2, height: 20, width: 20 }}
                >
                  <X size={11} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-[12px]">
              {selectedProjectIds.size > 0 && (
                <button
                  type="button"
                  onClick={selectAllProjects}
                  className="btn btn-subtle btn-sm"
                  style={{ height: 28, fontSize: 11, padding: "0 8px" }}
                >
                  Clear Selection
                </button>
              )}
              {selectedProjectIds.size < activeProjects.length && (
                <button
                  type="button"
                  onClick={selectEveryProject}
                  className="btn btn-subtle btn-sm"
                  style={{ height: 28, fontSize: 11, padding: "0 8px" }}
                >
                  Select All
                </button>
              )}
              {activeProjects.length > 8 && (
                <button
                  type="button"
                  onClick={() => setIsFilterExpanded(!isFilterExpanded)}
                  className="btn btn-subtle btn-sm flex items-center gap-1"
                  style={{ height: 28, fontSize: 11, padding: "0 8px" }}
                  title={isFilterExpanded ? "Collapse project list" : "Expand all projects"}
                >
                  <span>{isFilterExpanded ? "Collapse" : `Show all (${activeProjects.length})`}</span>
                  {isFilterExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                </button>
              )}
            </div>
          </div>
        </div>

        <div
          className="flex items-center gap-2 flex-wrap text-[12.5px]"
          style={{
            maxHeight: isFilterExpanded ? "none" : 96,
            overflowY: isFilterExpanded ? "visible" : "auto",
            paddingRight: 4,
          }}
        >
          <label
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border cursor-pointer select-none transition-colors"
            style={{
              background: isAllProjects ? "rgba(79,70,229,0.08)" : "transparent",
              borderColor: isAllProjects ? "var(--primary)" : "var(--border)",
              fontWeight: isAllProjects ? 600 : 400,
              color: isAllProjects ? "var(--primary)" : "var(--text)",
            }}
          >
            <input type="checkbox" className="sr-only" checked={isAllProjects} onChange={selectAllProjects} />
            {isAllProjects ? <CheckSquare size={14} /> : <Square size={14} />}
            <span>All Projects</span>
            <span
              className="pill"
              style={{
                fontSize: 10,
                padding: "0 6px",
                background: isAllProjects ? "var(--primary)" : "var(--bg-muted)",
                color: isAllProjects ? "#fff" : "var(--muted)",
              }}
            >
              {activeProjects.length} projects
            </span>
          </label>

          {visibleProjects.map((p) => {
            const isChecked = selectedProjectIds.has(p.id);
            const mrCount = mrCountsByProject.get(p.id) ?? 0;
            return (
              <label
                key={p.id}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border cursor-pointer select-none transition-colors"
                style={{
                  background: isChecked ? "rgba(79,70,229,0.08)" : "transparent",
                  borderColor: isChecked ? "var(--primary)" : "var(--border)",
                  color: isChecked ? "var(--primary)" : "var(--text)",
                  fontWeight: isChecked ? 600 : 400,
                }}
              >
                <input type="checkbox" className="sr-only" checked={isChecked} onChange={() => toggleProject(p.id)} />
                {isChecked ? <CheckSquare size={14} /> : <Square size={14} />}
                <span>{p.name}</span>
                {p.number && (
                  <span style={{ fontSize: 10, color: "var(--muted)" }}>({p.number})</span>
                )}
                <span
                  className="pill"
                  style={{
                    fontSize: 10,
                    padding: "0 6px",
                    background: isChecked ? "var(--primary)" : "var(--bg-muted)",
                    color: isChecked ? "#fff" : "var(--muted)",
                  }}
                >
                  {mrCount} MR{mrCount === 1 ? "" : "s"}
                </span>
              </label>
            );
          })}

          {visibleProjects.length === 0 && projectSearch && (
            <div className="text-[12px] py-1" style={{ color: "var(--muted)" }}>
              No projects found matching &ldquo;{projectSearch}&rdquo;
            </div>
          )}
        </div>
      </div>

      {/* Sourcing Status Lifecycle Tabs */}
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Tab: All */}
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`btn btn-sm ${statusFilter === "all" ? "btn-primary" : "btn-subtle"}`}
            style={{ fontSize: 12, height: 30, padding: "0 10px" }}
          >
            All ({statusCounts.all})
          </button>

          {/* Tab: Open (Needs RFQ) */}
          <button
            type="button"
            onClick={() => setStatusFilter("open")}
            className="btn btn-sm flex items-center gap-1.5 transition-colors"
            style={{
              fontSize: 12,
              height: 30,
              padding: "0 10px",
              background: statusFilter === "open" ? "#FEF3C7" : "transparent",
              color: statusFilter === "open" ? "#92400E" : "var(--text)",
              borderColor: statusFilter === "open" ? "#F59E0B" : "var(--border)",
              fontWeight: statusFilter === "open" ? 600 : 400,
            }}
          >
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span>Open · Needs RFQ</span>
            <span
              className="pill"
              style={{
                fontSize: 10,
                padding: "0 5px",
                background: statusFilter === "open" ? "#F59E0B" : "rgba(245,158,11,0.15)",
                color: statusFilter === "open" ? "#fff" : "#B45309",
              }}
            >
              {statusCounts.open}
            </span>
          </button>

          {/* Tab: RFQ Sent */}
          <button
            type="button"
            onClick={() => setStatusFilter("rfq_created")}
            className="btn btn-sm flex items-center gap-1.5 transition-colors"
            style={{
              fontSize: 12,
              height: 30,
              padding: "0 10px",
              background: statusFilter === "rfq_created" ? "rgba(99,102,241,0.12)" : "transparent",
              color: statusFilter === "rfq_created" ? "#4F46E5" : "var(--text)",
              borderColor: statusFilter === "rfq_created" ? "#6366F1" : "var(--border)",
              fontWeight: statusFilter === "rfq_created" ? 600 : 400,
            }}
          >
            <Send size={12} />
            <span>RFQ Sent</span>
            <span
              className="pill"
              style={{
                fontSize: 10,
                padding: "0 5px",
                background: statusFilter === "rfq_created" ? "#4F46E5" : "rgba(99,102,241,0.15)",
                color: statusFilter === "rfq_created" ? "#fff" : "#4F46E5",
              }}
            >
              {statusCounts.rfq_created}
            </span>
          </button>

          {/* Tab: Awarded */}
          <button
            type="button"
            onClick={() => setStatusFilter("awarded")}
            className="btn btn-sm flex items-center gap-1.5 transition-colors"
            style={{
              fontSize: 12,
              height: 30,
              padding: "0 10px",
              background: statusFilter === "awarded" ? "rgba(16,185,129,0.12)" : "transparent",
              color: statusFilter === "awarded" ? "#047857" : "var(--text)",
              borderColor: statusFilter === "awarded" ? "#10B981" : "var(--border)",
              fontWeight: statusFilter === "awarded" ? 600 : 400,
            }}
          >
            <CheckCircle2 size={12} />
            <span>Awarded</span>
            <span
              className="pill"
              style={{
                fontSize: 10,
                padding: "0 5px",
                background: statusFilter === "awarded" ? "#10B981" : "rgba(16,185,129,0.15)",
                color: statusFilter === "awarded" ? "#fff" : "#047857",
              }}
            >
              {statusCounts.awarded}
            </span>
          </button>

          {/* Tab: Fulfilled */}
          <button
            type="button"
            onClick={() => setStatusFilter("fulfilled")}
            className="btn btn-sm flex items-center gap-1.5 transition-colors"
            style={{
              fontSize: 12,
              height: 30,
              padding: "0 10px",
              background: statusFilter === "fulfilled" ? "rgba(6,182,212,0.12)" : "transparent",
              color: statusFilter === "fulfilled" ? "#0e7490" : "var(--text)",
              borderColor: statusFilter === "fulfilled" ? "#06B6D4" : "var(--border)",
              fontWeight: statusFilter === "fulfilled" ? 600 : 400,
            }}
          >
            <PackageCheck size={12} />
            <span>Fulfilled</span>
            <span
              className="pill"
              style={{
                fontSize: 10,
                padding: "0 5px",
                background: statusFilter === "fulfilled" ? "#06B6D4" : "rgba(6,182,212,0.15)",
                color: statusFilter === "fulfilled" ? "#fff" : "#0e7490",
              }}
            >
              {statusCounts.fulfilled}
            </span>
          </button>

          {statusCounts.cancelled > 0 && (
            <button
              type="button"
              onClick={() => setStatusFilter("cancelled")}
              className={`btn btn-sm ${statusFilter === "cancelled" ? "btn-primary" : "btn-subtle"}`}
              style={{ fontSize: 12, height: 30, padding: "0 10px" }}
            >
              Cancelled ({statusCounts.cancelled})
            </button>
          )}
        </div>
      </div>

      {/* Floating / Sticky Selection Bar for Raising RFQ on specific selected MRs */}
      {selectedMrIds.size > 0 && (
        <div
          className="card flex items-center justify-between gap-3 px-4 py-2.5 mb-3"
          style={{
            background: "rgba(79,70,229,0.06)",
            borderColor: "var(--primary)",
            borderRadius: 8,
          }}
        >
          <div className="flex items-center gap-2 text-[13px] flex-wrap">
            <span className="font-semibold" style={{ color: "var(--primary)" }}>
              {selectedMrIds.size} requirement{selectedMrIds.size === 1 ? "" : "s"} selected
            </span>
            {selectedOpenCount > 0 ? (
              <span className="text-[12px]" style={{ color: "var(--text)" }}>
                · <strong style={{ color: "#B45309" }}>{selectedOpenCount} open</strong> ready for RFQ
              </span>
            ) : (
              <span className="text-[12px]" style={{ color: "var(--muted)" }}>
                · (none of the selected items are in &ldquo;open&rdquo; status)
              </span>
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
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Opportunity Banner: when there are open items and viewing all */}
      {statusFilter === "all" && statusCounts.open > 0 && selectedMrIds.size === 0 && (
        <div
          className="flex items-center justify-between gap-3 p-3 rounded-lg border mb-3 text-[12px]"
          style={{
            background: "rgba(245,158,11,0.06)",
            borderColor: "rgba(245,158,11,0.25)",
            color: "var(--text)",
          }}
        >
          <div className="flex items-center gap-2">
            <Zap size={15} style={{ color: "#D97706", flexShrink: 0 }} />
            <span>
              <strong>{statusCounts.open} open requirement{statusCounts.open === 1 ? "" : "s"}</strong> waiting for vendor quotes.
              Filter by &ldquo;Open&rdquo; or click below to bundle them into an RFQ.
            </span>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-subtle flex items-center gap-1 text-[11px] font-semibold"
            style={{ color: "#B45309", borderColor: "rgba(245,158,11,0.4)" }}
            onClick={() => {
              setRfqModalInitialMrIds(undefined);
              setShowRfqModal(true);
            }}
          >
            <Send size={11} />
            Raise RFQ Now
          </button>
        </div>
      )}

      {/* Main Material Requirements Table */}
      <DataTable
        data={finalTableData}
        columns={cols}
        loading={list.isLoading || projectsQuery.isLoading}
        error={list.error}
        empty={{
          title: statusFilter !== "all"
            ? `No ${statusFilter.replace("_", " ")} material requirements`
            : "No material requirements found",
          subtitle: statusFilter !== "all"
            ? `There are currently no requirements with status "${statusFilter}". Try switching to the "All" tab.`
            : selectedProjectIds.size > 0
              ? "No requirements match the checked project filter. Try unchecking some projects."
              : "Import parts for any active project on the Import page — material requirements will be generated automatically.",
        }}
        rowKey={(r) => r.id}
        selectable={{
          selected: selectedMrIds,
          onChange: setSelectedMrIds,
        }}
      />

      {/* Raise RFQ Modal */}
      {showRfqModal && (
        <NewRfqModal
          initialSelectedMrIds={rfqModalInitialMrIds}
          onClose={() => {
            setShowRfqModal(false);
            setRfqModalInitialMrIds(undefined);
          }}
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
