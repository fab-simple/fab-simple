"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ResourceModal, Field } from "@/components/ui/ResourceModal";
import {
  useResourceList,
  useResourceListAll,
  useCreate,
  useImportMaterialRequirements,
} from "@/hooks/useResource";
import type { ImportMaterialRequirementsRow, ImportMaterialRequirementsResult } from "@/lib/api";
import { NewRfqModal } from "@/components/rfqs/NewRfqModal";
import {
  Plus,
  Loader2,
  X,
  CheckCircle2,
  Layers,
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

interface PartRow {
  id: string;
  part_mark: string;
  profile: string;
  name: string | null;
  grade: string | null;
  length: string | null;
  quantity: number;
}

interface AggregatedRow extends ImportMaterialRequirementsRow {
  sourceRowCount: number;
}

function aggregateParts(parts: PartRow[]): { aggregated: AggregatedRow[]; skippedCount: number } {
  const groups = new Map<string, AggregatedRow & { marksSet: Set<string> }>();
  let skippedCount = 0;

  for (const part of parts) {
    const profile = part.profile?.trim() ?? "";
    const qty = Number(part.quantity) || 0;
    if (!profile || !(qty > 0)) { skippedCount++; continue; }

    const name = part.name?.trim() || "";
    const grade = part.grade?.trim() || "";
    const length = part.length?.trim() || "";
    const mark = part.part_mark?.trim() || "";

    const key = [profile, name, grade, length].join("\x01");
    const existing = groups.get(key);
    if (existing) {
      existing.quantity += qty;
      existing.sourceRowCount += 1;
      if (mark) existing.marksSet.add(mark);
    } else {
      groups.set(key, {
        profile,
        name: name || undefined,
        grade: grade || undefined,
        length: length || undefined,
        quantity: qty,
        sourceRowCount: 1,
        marksSet: new Set(mark ? [mark] : []),
      });
    }
  }

  const aggregated = Array.from(groups.values())
    .map(({ marksSet, ...rest }) => {
      let notes: string | undefined = undefined;
      if (marksSet.size > 0) {
        const fullNotes = Array.from(marksSet).join(", ");
        notes = fullNotes.length > 490 ? `${fullNotes.slice(0, 470)}… (${marksSet.size} marks)` : fullNotes;
      }
      return { ...rest, notes };
    })
    .sort((a, b) => a.profile.localeCompare(b.profile) || (a.name ?? "").localeCompare(b.name ?? "") || (a.grade ?? "").localeCompare(b.grade ?? ""));

  return { aggregated, skippedCount };
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

  const defaultProjectId = selectedProjectIds.size === 1 ? Array.from(selectedProjectIds)[0] : activeProjects[0]?.id;

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
            maxWidth: 200,
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
    {
      key: "actions",
      label: "",
      align: "right",
      render: (r) => {
        if (r.status === "open") {
          return (
            <button
              type="button"
              className="btn btn-subtle btn-sm flex items-center gap-1 text-[11px]"
              style={{ height: 24, padding: "0 8px", whiteSpace: "nowrap" }}
              title="Raise an RFQ for this requirement"
              onClick={(e) => {
                e.stopPropagation();
                setRfqModalInitialMrIds([r.id]);
                setShowRfqModal(true);
              }}
            >
              <Send size={10} />
              Raise RFQ
            </button>
          );
        }
        return null;
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
          <button className="btn btn-subtle" onClick={() => setShowGenerate(true)} disabled={activeProjects.length === 0}>
            <Layers size={14} /> Generate from Parts
          </button>
          <button className="btn btn-subtle" onClick={() => setShowNew(true)} disabled={activeProjects.length === 0}>
            <Plus size={14} /> New requirement
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
              ? "No requirements match the checked project filter. Try unchecking some projects or add a new requirement."
              : "Click \"Generate from Parts\" to auto-create requirements from your imported parts list, or add one manually.",
        }}
        rowKey={(r) => r.id}
        selectable={{
          selected: selectedMrIds,
          onChange: setSelectedMrIds,
        }}
      />

      {/* New Requirement Modal */}
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

      {/* Generate from Parts Modal */}
      {showGenerate && (
        <GenerateFromPartsModal
          projects={activeProjects}
          initialProjectId={defaultProjectId}
          onClose={() => setShowGenerate(false)}
        />
      )}

      {/* Raise RFQ Modal directly on Material Requirements page */}
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
      name: row.name,
      grade: row.grade,
      quantity: row.quantity,
      length: row.length,
      notes: row.notes,
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
