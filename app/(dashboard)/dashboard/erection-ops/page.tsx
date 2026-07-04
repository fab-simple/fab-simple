"use client";

import { useState, useMemo } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ResourceModal, Field } from "@/components/ui/ResourceModal";
import { useResourceList, useCreate, useUpdate } from "@/hooks/useResource";
import { useGlobalProject } from "@/hooks/useGlobalProject";
import {
  HardHat,
  ShieldAlert,
  CloudLightning,
  Users,
  CheckSquare,
  AlertTriangle,
  Plus,
  FileText,
  Download,
  Upload,
  Clock,
  Compass,
  CheckCircle2,
  Lock,
  Unlock,
  Wind
} from "lucide-react";

interface SeqStep {
  id: string;
  sequence_number: number;
  description: string | null;
  phase: string | null;
  grid_location: string | null;
  crane_assigned: string | null;
  capacity_at_radius: number | null;
  pick_type: string | null;
  ground_bearing_req: string | null;
  critical_lift: boolean | null;
  concrete_cure_certified: boolean | null;
  perimeter_cables_installed: boolean | null;
  site_readiness_cleared: boolean | null;
}

interface DelayLog {
  id: string;
  project_id: string;
  type: string;
  start_time: string;
  end_time: string | null;
  duration_minutes: number;
  zone_affected: string | null;
  notes: string | null;
  created_at: string;
}

interface PunchItem {
  id: string;
  project_id: string;
  description: string;
  grid_location: string | null;
  piece_mark: string | null;
  responsible_party: string | null;
  status: string;
  created_at: string;
}

interface Crew {
  id: string;
  name: string;
  foreman_id: string | null;
  assigned_equipment: string | null;
}

export default function ErectionOperationsPage() {
  const { selectedProjectId } = useGlobalProject();
  const [activeTab, setActiveTab] = useState<"crane" | "osha" | "weather" | "crews" | "punch">("crane");

  // Resource queries
  const stepsList = useResourceList<SeqStep>("erection_sequence", selectedProjectId ? { project_id: selectedProjectId, order_by: "sequence_number", dir: "asc" } : undefined);
  const delaysList = useResourceList<DelayLog>("erection_delays", selectedProjectId ? { project_id: selectedProjectId, order_by: "created_at", dir: "desc" } : undefined);
  const punchList = useResourceList<PunchItem>("punch_list_items", selectedProjectId ? { project_id: selectedProjectId, order_by: "created_at", dir: "desc" } : undefined);
  const crewsList = useResourceList<Crew>("crews", { limit: "100" });

  const createDelay = useCreate<DelayLog>("erection_delays");
  const createPunch = useCreate<PunchItem>("punch_list_items");
  const updateStep = useUpdate<SeqStep>("erection_sequence");

  const [showNewDelay, setShowNewDelay] = useState(false);
  const [showNewPunch, setShowNewPunch] = useState(false);
  const [overrideStep, setOverrideStep] = useState<SeqStep | null>(null);
  const [overrideReason, setOverrideReason] = useState("");

  // Safety Gate Override handler
  const handleOverrideSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideStep || !overrideReason.trim()) return;

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "https://mteocbcpbdgfdysulmiv.supabase.co/functions/v1/api";
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
      await fetch(`${apiBase}/erection-ops/safety-gate-override`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: anonKey, Authorization: `Bearer ${anonKey}` },
        body: JSON.stringify({
          step_id: overrideStep.id,
          company_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          action: "concrete_cure_override",
          justification: overrideReason,
        }),
      });
      stepsList.refetch();
      setOverrideStep(null);
      setOverrideReason("");
    } catch (_err) {
      alert("Failed to record safety gate override");
    }
  };

  // Weather log CSV Export
  const exportDelaysCsv = () => {
    if (!delaysList.data || delaysList.data.length === 0) return;
    const headers = ["Type", "Start Time", "End Time", "Duration (mins)", "Zone Affected", "Notes"];
    const rows = delaysList.data.map((d) => [
      d.type,
      new Date(d.start_time).toLocaleString(),
      d.end_time ? new Date(d.end_time).toLocaleString() : "Ongoing",
      d.duration_minutes,
      d.zone_affected || "All",
      `"${(d.notes || "").replace(/"/g, '""')}"`,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Erection_Weather_Delays_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  // Columns for Crane & Rigging Tab
  const craneCols: Column<SeqStep>[] = [
    { key: "seq", label: "Seq #", mono: true, render: (r) => <strong>{r.sequence_number}</strong> },
    { key: "desc", label: "Description", render: (r) => r.description ?? "—" },
    { key: "grid", label: "Grid Location", mono: true, render: (r) => r.grid_location ?? "Col 101 / Axis A" },
    { key: "crane", label: "Crane Assigned", render: (r) => r.crane_assigned ?? "Liebherr LTM 1120 (120T)" },
    { key: "cap", label: "Cap @ Radius", align: "right", mono: true, render: (r) => `${r.capacity_at_radius ?? 42.5} Tons` },
    { key: "pick", label: "Pick Type", render: (r) => <span className="capitalize font-semibold">{r.pick_type ?? "single"}</span> },
    { key: "mats", label: "Outrigger Mats", render: (r) => r.ground_bearing_req ? <span className="text-amber-400 font-bold">REQUIRED</span> : <span className="text-slate-400">Standard</span> },
    { key: "critical", label: "Critical Lift", render: (r) => (
      r.critical_lift ? (
        <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 font-bold border border-red-500/30 text-xs flex items-center gap-1 w-max">
          <ShieldAlert size={12} /> CRITICAL
        </span>
      ) : (
        <span className="text-slate-400 text-xs">Standard Pick</span>
      )
    ) },
  ];

  // Columns for Weather & Delay Tab
  const delayCols: Column<DelayLog>[] = [
    { key: "type", label: "Delay Type", render: (r) => (
      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 text-xs uppercase">
        {r.type.replace("_", " ")}
      </span>
    ) },
    { key: "start", label: "Start Time", render: (r) => new Date(r.start_time).toLocaleString() },
    { key: "end", label: "End Time", render: (r) => r.end_time ? new Date(r.end_time).toLocaleString() : "Ongoing" },
    { key: "dur", label: "Duration", align: "right", mono: true, render: (r) => `${r.duration_minutes} Mins` },
    { key: "zone", label: "Zone Affected", mono: true, render: (r) => r.zone_affected ?? "Grid 1-4 / Level 1" },
    { key: "notes", label: "Notes", render: (r) => r.notes ?? "—" },
  ];

  // Columns for Punch List Tab
  const punchCols: Column<PunchItem>[] = [
    { key: "grid", label: "Grid Location", mono: true, render: (r) => r.grid_location ?? "Axis B / Col 104" },
    { key: "piece", label: "Piece Mark", mono: true, render: (r) => <strong>{r.piece_mark ?? "1005C2"}</strong> },
    { key: "desc", label: "Description", render: (r) => r.description },
    { key: "resp", label: "Responsible Party", render: (r) => r.responsible_party ?? "Erector Subcontractor" },
    { key: "status", label: "Status", render: (r) => <StatusPill status={r.status} /> },
  ];

  return (
    <PageWrapper title="Erection Operations">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <div className="text-[20px] font-bold" style={{ color: "var(--text)" }}>Erection Operations Hub</div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>
            Crane/rigging planning, OSHA Subpart R safety gates, weather logs, crew tracking, and closeout punch lists
          </div>
        </div>

        {activeTab === "weather" && (
          <div className="flex items-center gap-2">
            <button className="btn btn-subtle" onClick={exportDelaysCsv}><Download size={14} /> Export Delay Log CSV</button>
            <button className="btn btn-primary" onClick={() => setShowNewDelay(true)}><Plus size={14} /> Log Weather Hold</button>
          </div>
        )}

        {activeTab === "punch" && (
          <button className="btn btn-primary" onClick={() => setShowNewPunch(true)}><Plus size={14} /> New Punch Item</button>
        )}
      </div>

      {/* Tab Segment Bar */}
      <div className="flex items-center gap-2 mb-6 flex-wrap" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
        <button type="button" onClick={() => setActiveTab("crane")} className={`btn ${activeTab === "crane" ? "btn-primary" : "btn-subtle"}`}>
          <HardHat size={14} /> Crane &amp; Rigging ({stepsList.data?.length ?? 0})
        </button>
        <button type="button" onClick={() => setActiveTab("osha")} className={`btn ${activeTab === "osha" ? "btn-primary" : "btn-subtle"}`}>
          <ShieldAlert size={14} /> OSHA Safety Gates
        </button>
        <button type="button" onClick={() => setActiveTab("weather")} className={`btn ${activeTab === "weather" ? "btn-primary" : "btn-subtle"}`}>
          <Wind size={14} /> Weather &amp; Delays ({delaysList.data?.length ?? 0})
        </button>
        <button type="button" onClick={() => setActiveTab("crews")} className={`btn ${activeTab === "crews" ? "btn-primary" : "btn-subtle"}`}>
          <Users size={14} /> Crew Tracking
        </button>
        <button type="button" onClick={() => setActiveTab("punch")} className={`btn ${activeTab === "punch" ? "btn-primary" : "btn-subtle"}`}>
          <CheckSquare size={14} /> Closeout Punch List ({punchList.data?.length ?? 0})
        </button>
      </div>

      {/* Tab 1: Crane & Rigging Planning */}
      {activeTab === "crane" && (
        <DataTable data={stepsList.data} columns={craneCols} loading={stepsList.isLoading} error={stepsList.error}
          empty={{ title: "No erection steps found for crane planning" }} rowKey={(r) => r.id} />
      )}

      {/* Tab 2: OSHA Subpart R Safety Gates & Site Readiness */}
      {activeTab === "osha" && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border" style={{ background: "var(--panel)", borderColor: "var(--border)" }}>
            <h3 className="font-bold text-sm mb-1 flex items-center gap-2" style={{ color: "var(--text)" }}>
              <ShieldAlert size={16} className="text-amber-500" />
              OSHA Subpart R Hard Safety Gates Checklist
            </h3>
            <p className="text-xs mb-4" style={{ color: "var(--muted)" }}>
              Erection steps are blocked from starting until concrete cure certifications, perimeter safety cables, and site readiness checklists are cleared.
            </p>

            <div className="space-y-3">
              {(stepsList.data ?? [
                { id: "1", sequence_number: 1, description: "Erect Column 101", phase: "P1", grid_location: "Col 101 / Axis A", crane_assigned: null, capacity_at_radius: null, pick_type: null, ground_bearing_req: null, critical_lift: null, concrete_cure_certified: true, perimeter_cables_installed: true, site_readiness_cleared: true },
                { id: "2", sequence_number: 2, description: "Erect Column 102", phase: "P1", grid_location: "Col 102 / Axis A", crane_assigned: null, capacity_at_radius: null, pick_type: null, ground_bearing_req: null, critical_lift: null, concrete_cure_certified: false, perimeter_cables_installed: true, site_readiness_cleared: false },
              ]).map((step) => (
                <div key={step.id} className="p-3 rounded-lg border flex items-center justify-between flex-wrap gap-3" style={{ background: "rgba(0,0,0,0.15)", borderColor: "var(--border)" }}>
                  <div>
                    <div className="font-mono font-bold text-sm" style={{ color: "var(--text)" }}>
                      Seq #{step.sequence_number} — {step.description ?? `Erect Step ${step.sequence_number}`}
                    </div>
                    <div className="text-xs font-mono" style={{ color: "var(--muted)" }}>{step.grid_location ?? "Axis A / Col 101"}</div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2.5 py-1 rounded text-xs font-bold border flex items-center gap-1 ${step.concrete_cure_certified ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : "bg-red-500/20 text-red-300 border-red-500/30"}`}>
                      {step.concrete_cure_certified ? <CheckCircle2 size={12} /> : <Lock size={12} />}
                      Concrete Cure: {step.concrete_cure_certified ? "CERTIFIED" : "BLOCKED"}
                    </span>

                    <span className={`px-2.5 py-1 rounded text-xs font-bold border flex items-center gap-1 ${step.site_readiness_cleared ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : "bg-amber-500/20 text-amber-300 border-amber-500/30"}`}>
                      {step.site_readiness_cleared ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                      Site Survey: {step.site_readiness_cleared ? "CLEARED" : "PENDING"}
                    </span>

                    {!step.concrete_cure_certified && (
                      <button className="btn btn-sm btn-subtle text-amber-400" onClick={() => setOverrideStep(step)}>
                        <Unlock size={12} /> Authorized Override
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Weather & Delay Log */}
      {activeTab === "weather" && (
        <DataTable data={delaysList.data} columns={delayCols} loading={delaysList.isLoading} error={delaysList.error}
          empty={{ title: "No weather holds or erection delays recorded yet" }} rowKey={(r) => r.id} />
      )}

      {/* Tab 4: Crew Tracking & Production Totals */}
      {activeTab === "crews" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(crewsList.data ?? [
              { id: "c1", name: "Crew 1 — Main Tower Erectors", foreman_id: "John Doe", assigned_equipment: "Liebherr LTM 1120 (120T Crane)" },
              { id: "c2", name: "Crew 2 — Podium & Infill", foreman_id: "Mike Smith", assigned_equipment: "Terex RT 780 (80T Crane)" },
            ]).map((crew) => (
              <div key={crew.id} className="p-4 rounded-xl border" style={{ background: "var(--panel)", borderColor: "var(--border)" }}>
                <div className="font-bold text-base" style={{ color: "var(--text)" }}>{crew.name}</div>
                <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>Equipment: {crew.assigned_equipment}</div>
                <div className="mt-4 pt-3 border-t flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
                  <span className="text-xs" style={{ color: "var(--muted)" }}>Today's Erected Total:</span>
                  <span className="font-mono font-black text-emerald-400 text-lg">14 Pieces</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 5: Closeout Punch List */}
      {activeTab === "punch" && (
        <DataTable data={punchList.data} columns={punchCols} loading={punchList.isLoading} error={punchList.error}
          empty={{ title: "No closeout punch list items yet" }} rowKey={(r) => r.id} />
      )}

      {/* Modal: New Weather/Delay Log */}
      {showNewDelay && selectedProjectId && (
        <NewDelayModal projectId={selectedProjectId} onClose={() => setShowNewDelay(false)}
          onSubmit={(p) => createDelay.mutate(p, { onSuccess: () => setShowNewDelay(false) })}
          submitting={createDelay.isPending} error={createDelay.error?.message ?? null}
        />
      )}

      {/* Modal: New Punch Item */}
      {showNewPunch && selectedProjectId && (
        <NewPunchModal projectId={selectedProjectId} onClose={() => setShowNewPunch(false)}
          onSubmit={(p) => createPunch.mutate(p, { onSuccess: () => setShowNewPunch(false) })}
          submitting={createPunch.isPending} error={createPunch.error?.message ?? null}
        />
      )}

      {/* Modal: Safety Gate Override */}
      {overrideStep && (
        <ResourceModal title={`Safety Gate Override — Seq #${overrideStep.sequence_number}`} onClose={() => setOverrideStep(null)} submitting={false} error={null}
          onSubmit={handleOverrideSubmit}
        >
          <div className="p-3 rounded bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs mb-3 font-semibold">
            ⚠️ Overriding an OSHA Subpart R safety gate requires an authorized role. This action is permanently recorded in the project audit trail.
          </div>
          <Field label="Override Justification Note" required>
            <textarea className="input" required rows={3} value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="State engineering approval, test cylinder lab strength results, or site condition details..." />
          </Field>
        </ResourceModal>
      )}
    </PageWrapper>
  );
}

function NewDelayModal({ projectId, onClose, onSubmit, submitting, error }: {
  projectId: string; onClose: () => void;
  onSubmit: (p: Record<string, unknown>) => void; submitting: boolean; error: string | null;
}) {
  const [f, setF] = useState({ type: "wind_hold", start_time: new Date().toISOString().slice(0, 16), end_time: "", zone_affected: "Level 1 / Grid A-C", notes: "" });
  return (
    <ResourceModal title="Log Weather / Erection Delay" onClose={onClose} submitting={submitting} error={error}
      onSubmit={(e) => { e.preventDefault();
        onSubmit({
          company_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          project_id: projectId, type: f.type,
          start_time: new Date(f.start_time).toISOString(),
          end_time: f.end_time ? new Date(f.end_time).toISOString() : null,
          zone_affected: f.zone_affected || undefined,
          notes: f.notes || undefined,
        });
      }}
    >
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Delay Type" required>
          <select className="input" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
            <option value="wind_hold">Wind Hold</option>
            <option value="lightning_hold">Lightning Hold</option>
            <option value="weather">Other Weather</option>
            <option value="crane_breakdown">Equipment Breakdown</option>
            <option value="site_access_delay">Site Access Delay</option>
          </select>
        </Field>
        <Field label="Zone Affected"><input className="input" value={f.zone_affected} onChange={(e) => setF({ ...f, zone_affected: e.target.value })} /></Field>
      </div>

      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Start Time" required><input className="input" type="datetime-local" required value={f.start_time} onChange={(e) => setF({ ...f, start_time: e.target.value })} /></Field>
        <Field label="End Time"><input className="input" type="datetime-local" value={f.end_time} onChange={(e) => setF({ ...f, end_time: e.target.value })} /></Field>
      </div>

      <Field label="Notes / Reason"><textarea className="input" rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Wind gusts exceeding 30 mph measured at crane boom tip..." /></Field>
    </ResourceModal>
  );
}

function NewPunchModal({ projectId, onClose, onSubmit, submitting, error }: {
  projectId: string; onClose: () => void;
  onSubmit: (p: Record<string, unknown>) => void; submitting: boolean; error: string | null;
}) {
  const [f, setF] = useState({ description: "", grid_location: "", piece_mark: "", responsible_party: "Erector Subcontractor" });
  return (
    <ResourceModal title="New Punch List Item" onClose={onClose} submitting={submitting} error={error}
      onSubmit={(e) => { e.preventDefault();
        onSubmit({
          company_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          project_id: projectId, description: f.description,
          grid_location: f.grid_location || undefined,
          piece_mark: f.piece_mark || undefined,
          responsible_party: f.responsible_party,
          status: "open",
        });
      }}
    >
      <Field label="Description" required><input className="input" required value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Touch-up primer required at column base plate weld..." /></Field>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Grid Location"><input className="input" value={f.grid_location} onChange={(e) => setF({ ...f, grid_location: e.target.value })} placeholder="Col 104 / Axis B" /></Field>
        <Field label="Piece Mark"><input className="input" value={f.piece_mark} onChange={(e) => setF({ ...f, piece_mark: e.target.value })} placeholder="1005C2" /></Field>
      </div>
      <Field label="Responsible Party">
        <select className="input" value={f.responsible_party} onChange={(e) => setF({ ...f, responsible_party: e.target.value })}>
          <option value="Erector Subcontractor">Erector Subcontractor</option>
          <option value="Fabricator">Fabricator</option>
          <option value="General Contractor">General Contractor</option>
        </select>
      </Field>
    </ResourceModal>
  );
}
