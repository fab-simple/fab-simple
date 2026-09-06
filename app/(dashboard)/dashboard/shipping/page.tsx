"use client";

import { useState, useMemo } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ResourceModal, Field } from "@/components/ui/ResourceModal";
import { useResourceList, useCreate } from "@/hooks/useResource";
import { useGlobalProject } from "@/hooks/useGlobalProject";
import { Plus, FileDown, Truck, CheckSquare, Square, AlertTriangle, Layers, Filter, Scale } from "lucide-react";
import { generateShippingBolPdf, type ShippingTicketReportData } from "@/lib/reports/shipping-bol-pdf";

interface Ship {
  id: string;
  ticket_number: string;
  load_number: string | null;
  truck_number: string | null;
  carrier: string | null;
  driver_name: string | null;
  ship_date: string;
  destination: string | null;
  total_pieces: number;
  total_weight: number | null;
  status: string;
  project_id: string | null;
  parts: Array<{
    mark: string;
    description?: string | null;
    quantity: number;
    weight_lbs: number;
    sequence?: string | null;
  }> | null;
}

interface Project {
  id: string;
  name: string;
  number: string;
  gc_name?: string | null;
}

interface Assembly {
  id: string;
  assembly_mark: string;
  description: string | null;
  total_weight: number | null;
  total_parts: number;
  completed_parts: number;
  status: string;
  project_id: string;
  sequence?: string | null;
}

interface Part {
  id: string;
  part_mark: string;
  assembly_mark?: string | null;
  profile: string;
  weight: number | null;
  quantity: number;
  status: string;
  project_id: string;
  phase?: string | null;
}

const STATUSES = ["pending", "loaded", "in_transit", "delivered"];
const HIGHWAY_LEGAL_WEIGHT_LIMIT = 45000; // 45,000 lbs legal flatbed load limit

export default function ShippingPage() {
  const { selectedProjectId } = useGlobalProject();
  const shipQuery = selectedProjectId
    ? { order_by: "ship_date", dir: "desc", project_id: selectedProjectId }
    : { order_by: "ship_date", dir: "desc" };

  const list = useResourceList<Ship>("shipping_tickets", shipQuery);
  const projects = useResourceList<Project>("projects", { limit: "100" });
  const create = useCreate<Ship>("shipping_tickets");
  const [showNew, setShowNew] = useState(false);

  const cols: Column<Ship>[] = [
    { key: "tkt", label: "Ticket #", mono: true, render: (r) => <strong>{r.ticket_number}</strong> },
    { key: "load", label: "Load #", mono: true, render: (r) => r.load_number ?? "—" },
    { key: "truck", label: "Truck / Trailer", mono: true, render: (r) => r.truck_number ?? "—" },
    { key: "carrier", label: "Carrier", render: (r) => r.carrier ?? "—" },
    { key: "ship", label: "Ship Date", render: (r) => r.ship_date ? new Date(r.ship_date).toLocaleDateString() : "—" },
    { key: "dest", label: "Destination", render: (r) => r.destination ?? "—" },
    { key: "pcs", label: "Pieces", align: "right", mono: true, render: (r) => r.total_pieces },
    {
      key: "wt",
      label: "Load Weight",
      align: "right",
      mono: true,
      render: (r) => {
        const wt = Number(r.total_weight || 0);
        const tons = (wt / 2000).toFixed(2);
        return wt > 0 ? (
          <div>
            <div>{wt.toLocaleString()} lb</div>
            <div className="text-[10px] text-slate-400">{tons} tons</div>
          </div>
        ) : "—";
      },
    },
    { key: "status", label: "Status", render: (r) => <StatusPill status={r.status} /> },
    {
      key: "action",
      label: "",
      render: (r) => {
        const proj = projects.data?.find((p) => p.id === r.project_id);
        const pdfData: ShippingTicketReportData = {
          ticket_number: r.ticket_number,
          load_number: r.load_number,
          truck_number: r.truck_number,
          carrier: r.carrier,
          driver_name: r.driver_name,
          ship_date: r.ship_date,
          destination: r.destination,
          total_pieces: r.total_pieces,
          total_weight: r.total_weight,
          status: r.status,
          project_name: proj?.name,
          customer_name: proj?.gc_name,
          items: r.parts || [],
        };
        return (
          <button
            type="button"
            className="btn btn-sm btn-outline flex items-center gap-1 text-[11px]"
            title="Download BOL Shipping Ticket PDF"
            onClick={(e) => {
              e.stopPropagation();
              generateShippingBolPdf(pdfData);
            }}
          >
            <FileDown size={12} /> BOL PDF
          </button>
        );
      },
    },
  ];

  return (
    <PageWrapper title="Shipping Tickets">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[20px] font-bold" style={{ color: "var(--text)" }}>Shipping Tickets &amp; Dispatch</div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>
            Smart load builder · Auto-calculates axle weights &amp; generates BOL-ready shipping manifests by erection sequence.
          </div>
        </div>
        <button className="btn btn-primary flex items-center gap-1.5" onClick={() => setShowNew(true)}>
          <Plus size={14} /> New Shipping Ticket
        </button>
      </div>

      <DataTable
        data={list.data}
        columns={cols}
        loading={list.isLoading}
        error={list.error}
        empty={{ title: "No shipping tickets yet", subtitle: "Create a load ticket to start dispatching steel." }}
        rowKey={(r) => r.id}
      />

      {showNew && (
        <SmartShippingModal
          projects={projects.data ?? []}
          onClose={() => setShowNew(false)}
          onSubmit={(p) => create.mutate(p, { onSuccess: () => setShowNew(false) })}
          submitting={create.isPending}
          error={create.error?.message ?? null}
        />
      )}
    </PageWrapper>
  );
}

function SmartShippingModal({
  projects,
  onClose,
  onSubmit,
  submitting,
  error,
}: {
  projects: Project[];
  onClose: () => void;
  onSubmit: (p: Record<string, unknown>) => void;
  submitting: boolean;
  error: string | null;
}) {
  const [projectId, setProjectId] = useState<string>(projects[0]?.id ?? "");
  const [selectedSequence, setSelectedSequence] = useState<string>("all");

  const [f, setF] = useState({
    load_number: "LOAD-01",
    truck_number: "",
    carrier: "",
    driver_name: "",
    ship_date: new Date().toISOString().slice(0, 10),
    destination: "",
    status: "pending",
  });

  // Fetch assemblies & parts for selected project
  const assemblies = useResourceList<Assembly>(
    "assemblies",
    projectId ? { project_id: projectId, limit: "300" } : undefined,
    { enabled: Boolean(projectId) }
  );

  const parts = useResourceList<Part>(
    "parts",
    projectId ? { project_id: projectId, limit: "500" } : undefined,
    { enabled: Boolean(projectId) }
  );

  // Extract unique sequences/lots available for this project
  const availableSequences = useMemo(() => {
    const seqs = new Set<string>();
    (assemblies.data || []).forEach((a) => a.sequence && seqs.add(a.sequence));
    (parts.data || []).forEach((p) => p.phase && seqs.add(p.phase));
    return Array.from(seqs).sort();
  }, [assemblies.data, parts.data]);

  // Selected items state: map of item key -> { mark, description, quantity, weight_lbs, sequence }
  const [selectedItems, setSelectedItems] = useState<
    Record<string, { mark: string; description: string; quantity: number; weight_lbs: number; sequence: string }>
  >({});

  // Filter assemblies by sequence
  const filteredAssemblies = useMemo(() => {
    const list = assemblies.data || [];
    if (selectedSequence === "all") return list;
    return list.filter((a) => a.sequence === selectedSequence);
  }, [assemblies.data, selectedSequence]);

  // Calculations
  const selectedList = Object.values(selectedItems);
  const totalPieces = selectedList.reduce((sum, it) => sum + it.quantity, 0);
  const totalWeightLbs = selectedList.reduce((sum, it) => sum + it.weight_lbs, 0);
  const totalTons = (totalWeightLbs / 2000).toFixed(2);
  const isOverweight = totalWeightLbs > HIGHWAY_LEGAL_WEIGHT_LIMIT;
  const loadPct = Math.min(100, Math.round((totalWeightLbs / HIGHWAY_LEGAL_WEIGHT_LIMIT) * 100));

  function toggleAssembly(a: Assembly) {
    const key = `asm_${a.id}`;
    const next = { ...selectedItems };
    if (next[key]) {
      delete next[key];
    } else {
      const wt = Number(a.total_weight || 0);
      next[key] = {
        mark: a.assembly_mark,
        description: a.description || `Assembly ${a.assembly_mark}`,
        quantity: Math.max(1, a.total_parts || 1),
        weight_lbs: wt,
        sequence: a.sequence || "Seq 1",
      };
    }
    setSelectedItems(next);
  }

  function toggleSelectAll() {
    if (Object.keys(selectedItems).length >= filteredAssemblies.length) {
      setSelectedItems({});
    } else {
      const next: Record<string, { mark: string; description: string; quantity: number; weight_lbs: number; sequence: string }> = {};
      filteredAssemblies.forEach((a) => {
        const key = `asm_${a.id}`;
        const wt = Number(a.total_weight || 0);
        next[key] = {
          mark: a.assembly_mark,
          description: a.description || `Assembly ${a.assembly_mark}`,
          quantity: Math.max(1, a.total_parts || 1),
          weight_lbs: wt,
          sequence: a.sequence || "Seq 1",
        };
      });
      setSelectedItems(next);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const proj = projects.find((p) => p.id === projectId);
    const payload = {
      project_id: projectId || undefined,
      load_number: f.load_number || "LOAD-01",
      truck_number: f.truck_number || undefined,
      carrier: f.carrier || undefined,
      driver_name: f.driver_name || undefined,
      ship_date: f.ship_date,
      destination: f.destination || undefined,
      total_pieces: totalPieces || 1,
      total_weight: totalWeightLbs || 0,
      status: f.status,
      parts: selectedList,
    };

    onSubmit(payload);

    // Automatically download BOL PDF
    generateShippingBolPdf({
      ticket_number: f.load_number || "NEW-TICKET",
      load_number: f.load_number,
      truck_number: f.truck_number,
      carrier: f.carrier,
      driver_name: f.driver_name,
      ship_date: f.ship_date,
      destination: f.destination,
      total_pieces: totalPieces,
      total_weight: totalWeightLbs,
      status: f.status,
      project_name: proj?.name,
      customer_name: proj?.gc_name,
      items: selectedList,
    });
  }

  return (
    <ResourceModal title="Create Shipping Ticket &amp; Bill of Lading" onClose={onClose} submitting={submitting} error={error} onSubmit={handleSubmit}>
      {/* Top Banner: Truck Load Gauge */}
      <div className="card p-3 mb-4" style={{ background: isOverweight ? "#FEF2F2" : "#F8FAFC", border: `1px solid ${isOverweight ? "#FCA5A5" : "#E2E8F0"}` }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Scale size={18} className={isOverweight ? "text-red-600" : "text-indigo-600"} />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Live Load Weight Gauge</span>
          </div>
          <div className="text-xs font-mono font-bold">
            <span style={{ color: isOverweight ? "#DC2626" : "#0284C7" }}>
              {totalWeightLbs.toLocaleString()} lb ({totalTons} tons)
            </span>
            <span className="text-slate-400 font-normal"> / 45,000 lb max</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
          <div
            className={`h-2.5 rounded-full transition-all duration-300 ${isOverweight ? "bg-red-600" : loadPct > 80 ? "bg-amber-500" : "bg-indigo-600"}`}
            style={{ width: `${loadPct}%` }}
          />
        </div>

        {isOverweight && (
          <div className="flex items-center gap-1.5 mt-2 text-[11px] font-semibold text-red-700">
            <AlertTriangle size={13} /> Overweight Alert: Load exceeds legal 45,000 lbs highway limit! Reduce selected assemblies.
          </div>
        )}
      </div>

      {/* Dispatch Details */}
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Project" required>
          <select className="input" required value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.number})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Load #">
          <input className="input" value={f.load_number} onChange={(e) => setF({ ...f, load_number: e.target.value })} placeholder="LOAD-01" />
        </Field>
      </div>

      <div className="grid-3" style={{ gap: 12 }}>
        <Field label="Truck / Trailer #">
          <input className="input" value={f.truck_number} onChange={(e) => setF({ ...f, truck_number: e.target.value })} placeholder="T-402 / Trailer 12" />
        </Field>
        <Field label="Carrier">
          <input className="input" value={f.carrier} onChange={(e) => setF({ ...f, carrier: e.target.value })} placeholder="Lone Star Heavy Haul" />
        </Field>
        <Field label="Driver Name">
          <input className="input" value={f.driver_name} onChange={(e) => setF({ ...f, driver_name: e.target.value })} placeholder="Robert Vance" />
        </Field>
      </div>

      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Ship Date" required>
          <input className="input" type="date" required value={f.ship_date} onChange={(e) => setF({ ...f, ship_date: e.target.value })} />
        </Field>
        <Field label="Destination">
          <input className="input" value={f.destination} onChange={(e) => setF({ ...f, destination: e.target.value })} placeholder="Dallas Jobsite Drop" />
        </Field>
      </div>

      {/* Assembly Selection Section */}
      <div className="mt-4 pt-4 border-t border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-indigo-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Select Fabricated Assemblies for Load ({filteredAssemblies.length})
            </span>
          </div>

          {availableSequences.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Filter size={12} className="text-slate-400" />
              <select
                className="input input-sm text-xs py-1 px-2"
                value={selectedSequence}
                onChange={(e) => setSelectedSequence(e.target.value)}
              >
                <option value="all">All Erection Sequences</option>
                {availableSequences.map((seq) => (
                  <option key={seq} value={seq}>
                    Sequence: {seq}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Assembly Table */}
        <div className="border border-slate-200 rounded-lg overflow-hidden max-h-56 overflow-y-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-100 text-slate-600 sticky top-0">
              <tr>
                <th className="p-2 w-8 text-center">
                  <button type="button" onClick={toggleSelectAll} className="text-slate-500 hover:text-slate-800">
                    {Object.keys(selectedItems).length >= filteredAssemblies.length && filteredAssemblies.length > 0 ? (
                      <CheckSquare size={14} className="text-indigo-600" />
                    ) : (
                      <Square size={14} />
                    )}
                  </button>
                </th>
                <th className="p-2">Assembly Mark</th>
                <th className="p-2">Description</th>
                <th className="p-2">Seq / Phase</th>
                <th className="p-2 text-right">Parts</th>
                <th className="p-2 text-right">Weight (lb)</th>
                <th className="p-2 text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssemblies.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-4 text-center text-slate-400">
                    No assemblies found for this project &amp; sequence. Import a BOM or create assemblies to select.
                  </td>
                </tr>
              ) : (
                filteredAssemblies.map((a) => {
                  const key = `asm_${a.id}`;
                  const isChecked = Boolean(selectedItems[key]);
                  const isComplete = a.completed_parts >= a.total_parts && a.total_parts > 0;

                  return (
                    <tr
                      key={a.id}
                      onClick={() => toggleAssembly(a)}
                      className={`cursor-pointer hover:bg-indigo-50/50 border-t border-slate-100 ${isChecked ? "bg-indigo-50/80" : ""}`}
                    >
                      <td className="p-2 text-center" onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => toggleAssembly(a)}>
                          {isChecked ? <CheckSquare size={14} className="text-indigo-600" /> : <Square size={14} className="text-slate-400" />}
                        </button>
                      </td>
                      <td className="p-2 font-mono font-bold text-slate-800">{a.assembly_mark}</td>
                      <td className="p-2 text-slate-600 truncate max-w-[140px]">{a.description || "—"}</td>
                      <td className="p-2 font-mono text-slate-500">{a.sequence || "Seq 1"}</td>
                      <td className="p-2 text-right font-mono">
                        {a.completed_parts}/{a.total_parts}
                      </td>
                      <td className="p-2 text-right font-mono font-bold text-slate-700">
                        {Number(a.total_weight || 0).toLocaleString()}
                      </td>
                      <td className="p-2 text-center">
                        {isComplete ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                            100% Ready
                          </span>
                        ) : (
                          <StatusPill status={a.status || "in_progress"} />
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Selected Load Summary Footer */}
        <div className="flex items-center justify-between mt-3 text-xs">
          <div className="text-slate-500 font-medium">
            Selected: <strong>{totalPieces}</strong> pieces ({Object.keys(selectedItems).length} assemblies)
          </div>
          <div className="font-mono font-bold text-slate-800">
            Total Weight: <span className="text-indigo-600">{totalWeightLbs.toLocaleString()} lb</span> ({totalTons} tons)
          </div>
        </div>
      </div>
    </ResourceModal>
  );
}
