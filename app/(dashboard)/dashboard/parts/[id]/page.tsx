"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer, Loader2, AlertCircle } from "lucide-react";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { useResource, useUpdate } from "@/hooks/useResource";
import { FabAPI, FabApiError } from "@/lib/api";

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
  drawing_id: string | null;
  project_id: string;
  notes: string | null;
  updated_at: string;
  created_at: string;
  assigned_user_id: string | null;
}

interface Project { id: string; name: string }
interface Drawing { id: string; drawing_number: string; revision: string }
interface WeldInspection {
  id: string;
  weld_number: string;
  joint_type: string;
  inspection_method: string;
  inspector_name: string | null;
  result: string;
  notes: string | null;
}
interface PaintInspection {
  id: string;
  insp_number: string;
  surface_prep: string;
  primer_dft: number;
  topcoat_dft: number;
  total_dft: number;
  required_min: number;
  inspector_name: string | null;
  result: string;
  inspection_date: string;
}
interface AuditEntry {
  id: string;
  action: string;
  old_values: { status?: string } | null;
  new_values: { status?: string } | null;
  created_at: string;
}

const DOT_COLORS: Record<string, string> = {
  not_started: "#94A3B8",
  ordered: "#3B82F6",
  in_progress: "#2563EB",
  complete: "#16A34A",
  shipped: "#0D9488",
  on_hold: "#DC2626",
};

const STATUS_LABEL: Record<string, string> = {
  not_started: "Not Started",
  ordered: "Ordered",
  in_progress: "In Progress",
  complete: "Completed",
  shipped: "Shipped",
  on_hold: "On Hold",
};

const STATUS_OPTIONS = ["not_started", "ordered", "in_progress", "complete", "shipped", "on_hold"];

export default function PartDetailPage() {
  const params = useParams();
  const id = (params?.id as string) ?? "";

  const partQ = useResource<Part>("parts", id);
  const updatePart = useUpdate<Part>("parts");

  const part = partQ.data;

  const projectQ = useQuery<Project, FabApiError>({
    queryKey: ["projects", "get", part?.project_id ?? null],
    queryFn: () => FabAPI.get<Project>("projects", part!.project_id),
    enabled: !!part?.project_id,
  });
  const drawingQ = useQuery<Drawing, FabApiError>({
    queryKey: ["drawings", "get", part?.drawing_id ?? null],
    queryFn: () => FabAPI.get<Drawing>("drawings", part!.drawing_id!),
    enabled: !!part?.drawing_id,
  });

  const weldsQ = useQuery<WeldInspection[], FabApiError>({
    queryKey: ["weld_inspections", "by-part", id],
    queryFn: () => FabAPI.list<WeldInspection>("weld_inspections", { part_id: id }),
    enabled: !!part?.id,
  });
  const paintQ = useQuery<PaintInspection[], FabApiError>({
    queryKey: ["paint_inspections", "by-part", id],
    queryFn: () => FabAPI.list<PaintInspection>("paint_inspections", { part_id: id }),
    enabled: !!part?.id,
  });
  const auditQ = useQuery<AuditEntry[], FabApiError>({
    queryKey: ["audit_log", "by-part", id],
    queryFn: () => FabAPI.list<AuditEntry>("audit_log", {
      table_name: "parts", record_id: id, order_by: "created_at", dir: "asc",
    }),
    enabled: !!part?.id,
  });

  const paintLatest = paintQ.data?.[0];
  const welds = weldsQ.data ?? [];

  const statusHistory = useMemo(() => {
    if (!part) return [];
    const entries: Array<{ status: string; time: string; action: string }> = [];
    entries.push({ status: "not_started", time: part.created_at, action: "created" });
    for (const a of auditQ.data ?? []) {
      const newStatus = a.new_values?.status;
      const oldStatus = a.old_values?.status;
      if (newStatus && newStatus !== oldStatus) {
        entries.push({ status: newStatus, time: a.created_at, action: a.action });
      }
    }
    if (entries[entries.length - 1]?.status !== part.status) {
      entries.push({ status: part.status, time: part.updated_at, action: "current" });
    }
    return entries;
  }, [part, auditQ.data]);

  if (partQ.isLoading) {
    return (
      <PageWrapper title="Part Detail">
        <div className="flex items-center justify-center" style={{ minHeight: 300, color: "var(--muted)" }}>
          <Loader2 size={20} className="animate-spin" />
          <span className="ml-3 text-[13px]">Loading part…</span>
        </div>
      </PageWrapper>
    );
  }

  if (partQ.error || !part) {
    return (
      <PageWrapper title="Part Detail">
        <div className="card" style={{ padding: 24 }}>
          <div className="flex items-center gap-3" style={{ color: "#DC2626" }}>
            <AlertCircle size={18} />
            <div>
              <div className="font-semibold">Part not found</div>
              <div className="text-[12px]" style={{ color: "var(--muted)" }}>
                {partQ.error?.message ?? "This part may have been removed."}
              </div>
            </div>
          </div>
          <Link href="/dashboard/parts" className="btn btn-sm mt-4"><ArrowLeft size={13} /> Back to parts</Link>
        </div>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper title={`Part Detail — ${part.part_mark}`}>
      <div className="flex items-center gap-3 mb-5">
        <Link href="/dashboard/parts" className="btn btn-sm btn-ghost">
          <ArrowLeft size={13} /> Back
        </Link>
        <span className="font-mono font-bold text-[15px]" style={{ color: "var(--primary)" }}>
          {part.part_mark}
        </span>
        <StatusPill status={part.status} />
        <div className="ml-auto no-print">
          <button className="btn btn-sm" onClick={() => window.print()}>
            <Printer size={13} /> Print
          </button>
        </div>
      </div>

      <div className="grid-2 gap-md">
        {/* Left: Part Info */}
        <div className="flex flex-col gap-5">
          <div className="card">
            <div className="card-header">
              <div className="card-title">Part Information</div>
            </div>
            <div className="card-body">
              <div className="grid-2" style={{ gap: 12 }}>
                {[
                  { label: "Part Mark",     value: part.part_mark, mono: true },
                  { label: "Assembly Mark", value: part.assembly_mark ?? "—", mono: true },
                  { label: "Drawing No.",   value: drawingQ.data ? `${drawingQ.data.drawing_number} Rev ${drawingQ.data.revision}` : (part.drawing_id ? "Loading…" : "—") },
                  { label: "Phase",         value: part.phase ?? "—" },
                  { label: "Profile",       value: part.profile, mono: true },
                  { label: "Grade",         value: part.grade ?? "—" },
                  { label: "Length",        value: part.length != null ? `${part.length} ft` : "—", mono: true },
                  { label: "Weight",        value: part.weight != null ? `${Number(part.weight).toLocaleString()} lbs` : "—", mono: true },
                  { label: "Heat Number",   value: part.heat_number ?? "—", mono: true },
                  { label: "Project",       value: projectQ.data?.name ?? "Loading…" },
                ].map(({ label, value, mono }) => (
                  <div key={label} className="info-cell">
                    <div className="info-cell-label">{label}</div>
                    <div className={`info-cell-value ${mono ? "font-mono text-[12px]" : ""}`}>{value}</div>
                  </div>
                ))}
              </div>
              {part.notes && (
                <div className="mt-4 pt-3" style={{ borderTop: "1px solid var(--border)" }}>
                  <div className="info-cell-label">Notes</div>
                  <div className="text-[12px] mt-1" style={{ color: "var(--text)" }}>{part.notes}</div>
                </div>
              )}
            </div>
          </div>

          {/* Paint Record */}
          {paintLatest && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">Latest Paint Inspection</div>
                <StatusPill status={paintLatest.result} />
              </div>
              <div className="card-body">
                <div className="grid-3" style={{ gap: 12, marginBottom: 12 }}>
                  <div className="info-cell text-center">
                    <div className="info-cell-label">Primer DFT</div>
                    <div className="info-cell-value font-mono">{paintLatest.primer_dft} mil</div>
                  </div>
                  <div className="info-cell text-center">
                    <div className="info-cell-label">Topcoat DFT</div>
                    <div className="info-cell-value font-mono">{paintLatest.topcoat_dft} mil</div>
                  </div>
                  <div className="info-cell text-center">
                    <div className="info-cell-label">Total DFT</div>
                    <div className="info-cell-value font-mono" style={{ color: paintLatest.total_dft >= paintLatest.required_min ? "var(--green)" : "var(--red)" }}>
                      {paintLatest.total_dft} mil
                    </div>
                  </div>
                </div>
                <div className="text-[12px]" style={{ color: "var(--muted)" }}>
                  Surface Prep: {paintLatest.surface_prep} · Inspector: {paintLatest.inspector_name ?? "—"} · {paintLatest.inspection_date}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Status History + Welds */}
        <div className="flex flex-col gap-5">
          <div className="card">
            <div className="card-header">
              <div className="card-title">Status History</div>
            </div>
            <div className="card-body">
              <div className="timeline">
                {statusHistory.length === 0 ? (
                  <div className="text-[12px] text-center py-3" style={{ color: "var(--muted)" }}>No status changes yet</div>
                ) : statusHistory.map((h, i) => (
                  <div key={i} className="timeline-item">
                    <div className="timeline-dot" style={{ background: DOT_COLORS[h.status] || "var(--border-2)", borderColor: DOT_COLORS[h.status] || "var(--border-2)" }} />
                    <div className="flex items-start justify-between">
                      <div>
                        <StatusPill status={h.status} size="sm" />
                        <div className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
                          {h.action}
                        </div>
                      </div>
                      <span className="font-mono text-[10px]" style={{ color: "var(--faint)" }}>
                        {new Date(h.time).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                <div className="text-[11px] font-semibold mb-2" style={{ color: "var(--muted)" }}>Update Status</div>
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((s) => (
                    <button
                      key={s}
                      disabled={updatePart.isPending || part.status === s}
                      className={`btn btn-sm ${part.status === s ? "btn-primary" : ""}`}
                      onClick={() => updatePart.mutate({ id: part.id, body: { status: s } })}
                    >
                      {STATUS_LABEL[s] ?? s}
                    </button>
                  ))}
                </div>
                {updatePart.error && (
                  <div className="text-[11px] mt-2" style={{ color: "#DC2626" }}>
                    {updatePart.error.message}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">Weld Inspections</div>
              <span className="text-[11px] font-mono" style={{ color: "var(--muted)" }}>
                {welds.length} record{welds.length === 1 ? "" : "s"}
              </span>
            </div>
            {welds.length > 0 ? (
              <div className="tbl-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Weld ID</th>
                      <th>Type</th>
                      <th>Method</th>
                      <th>Inspector</th>
                      <th>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {welds.map((w) => (
                      <tr key={w.id}>
                        <td className="td-mono">{w.weld_number}</td>
                        <td style={{ fontSize: 12 }}>{w.joint_type}</td>
                        <td><span className="pill pill-info">{w.inspection_method}</span></td>
                        <td style={{ fontSize: 12 }}>{(w.inspector_name ?? "—").split("/")[0].trim()}</td>
                        <td><StatusPill status={w.result} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="card-body text-center py-8" style={{ color: "var(--muted)", fontSize: 13 }}>
                No weld inspections recorded for this part
              </div>
            )}
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
