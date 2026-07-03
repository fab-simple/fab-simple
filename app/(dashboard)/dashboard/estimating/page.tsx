"use client";

import { useState, useEffect } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ResourceModal, Field } from "@/components/ui/ResourceModal";
import { useResourceList, useCreate, useUpdate } from "@/hooks/useResource";
import { FabAPI } from "@/lib/api";
import { Plus, Wand2, ChevronDown, ChevronRight, Save, Trash, AlertCircle } from "lucide-react";
import Link from "next/link";

interface Estimate {
  id: string;
  estimate_number: string;
  project_name: string;
  gc_name: string | null;
  status: string;
  total_amount: number;
  bid_due_date: string | null;
  created_at: string;
  architect_eor: string | null;
  project_location: string | null;
  bid_type: string | null;
  drawing_set_ref: string | null;
  unique_piece_marks: number | null;
  connection_complexity: string | null;
  detailing_hours: number | null;
  fabrication_hours: number | null;
  erection_hours: number | null;
  labor_rate: number | null;
  freight_mill_to_shop: number | null;
  freight_shop_to_site: number | null;
  paint_coating_required: boolean;
  coating_type: string | null;
  coating_pricing_method: string | null;
  coating_price_per_ton: number | null;
  coating_lump_sum: number | null;
  contingency_pct: number | null;
  margin_pct: number | null;
  exclusions_qualifications: string | null;
  materials_breakdown: Array<{ shape: string; tons: number; price_per_ton: number }>;
  alternates: Array<{ description: string; type: "add" | "deduct"; amount: number }>;
  notes: string | null;
  converted_project_id: string | null;
}

const STATUSES = ["draft", "submitted", "under_review", "won", "lost", "withdrawn"];

const DEFAULT_SHAPES = [
  { shape: "Wide Flange", tons: 0, price_per_ton: 1300 },
  { shape: "HSS / Tube", tons: 0, price_per_ton: 1450 },
  { shape: "Angle", tons: 0, price_per_ton: 1200 },
  { shape: "Plate", tons: 0, price_per_ton: 1100 },
  { shape: "Channel", tons: 0, price_per_ton: 1250 },
  { shape: "Misc Metal", tons: 0, price_per_ton: 1800 },
];

const LABOR_FACTORS: Record<string, { detailing: number; fabrication: number; erection: number }> = {
  simple_shear: { detailing: 1.5, fabrication: 6.0, erection: 2.0 },
  moment_connections: { detailing: 2.5, fabrication: 9.0, erection: 3.0 },
  mixed: { detailing: 2.0, fabrication: 7.5, erection: 2.5 },
  heavy_misc: { detailing: 4.0, fabrication: 15.0, erection: 6.0 },
};

export default function EstimatingPage() {
  const list = useResourceList<Estimate>("estimates", { order_by: "created_at", dir: "desc" });
  const create = useCreate<Estimate>("estimates");
  const update = useUpdate<Estimate>("estimates");
  
  const [selectedEstimate, setSelectedEstimate] = useState<Estimate | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [converting, setConverting] = useState<string | null>(null);

  async function awardProject(id: string) {
    setConverting(id);
    try {
      await FabAPI.convertEstimate({ estimate_id: id });
      list.refetch();
    } catch (e) {
      alert("Failed to award project: " + (e as Error).message);
    } finally {
      setConverting(null);
    }
  }

  const cols: Column<Estimate>[] = [
    { key: "num", label: "Est #", mono: true, render: (r) => <strong>{r.estimate_number}</strong> },
    { key: "name", label: "Project Name", render: (r) => r.project_name },
    { key: "gc", label: "General Contractor", render: (r) => r.gc_name ?? "—" },
    {
      key: "tons",
      label: "Tons",
      align: "right",
      mono: true,
      render: (r) => {
        const t = r.materials_breakdown?.reduce((sum, item) => sum + Number(item.tons || 0), 0) || 0;
        return t > 0 ? t.toFixed(2) : "—";
      }
    },
    {
      key: "total",
      label: "Total Bid",
      align: "right",
      mono: true,
      render: (r) => `$${Number(r.total_amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    },
    { key: "due", label: "Bid Due", render: (r) => r.bid_due_date ? new Date(r.bid_due_date).toLocaleDateString() : "—" },
    { key: "status", label: "Status", render: (r) => <StatusPill status={r.status} /> },
    {
      key: "action",
      label: "",
      render: (r) => {
        if (r.status === "won") {
          if (r.converted_project_id) {
            return (
              <Link href={`/dashboard/projects/${r.converted_project_id}`} className="btn btn-sm btn-outline text-xs">
                View Project
              </Link>
            );
          }
          return (
            <button
              className="btn btn-sm btn-primary flex items-center gap-1 text-xs"
              disabled={converting === r.id}
              onClick={(e) => {
                e.stopPropagation();
                awardProject(r.id);
              }}
            >
              <Wand2 size={12} /> Award Project
            </button>
          );
        }
        return null;
      },
    },
  ];

  return (
    <PageWrapper title="Estimating">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[20px] font-bold" style={{ color: "var(--text)" }}>Estimating Module</div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>
            Steel pricing and structural bidding panel · Won bids convert to project baseline budget automatically.
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>
          <Plus size={14} /> New Estimate
        </button>
      </div>

      <DataTable
        data={list.data}
        columns={cols}
        loading={list.isLoading}
        error={list.error}
        empty={{ title: "No estimates yet", subtitle: "Create an estimate to start bidding." }}
        rowKey={(r) => r.id}
        onRowClick={(row) => setSelectedEstimate(row)}
      />

      {showNew && (
        <EstimateModal
          onClose={() => setShowNew(false)}
          onSubmit={(p) => create.mutate(p, { onSuccess: () => setShowNew(false) })}
          submitting={create.isPending}
          error={create.error?.message ?? null}
          allEstimates={list.data ?? []}
        />
      )}

      {selectedEstimate && (
        <EstimateModal
          initial={selectedEstimate}
          onClose={() => setSelectedEstimate(null)}
          onSubmit={(p) => {
            update.mutate({ id: selectedEstimate.id, body: p }, { onSuccess: () => setSelectedEstimate(null) });
          }}
          submitting={update.isPending}
          error={update.error?.message ?? null}
          allEstimates={list.data ?? []}
        />
      )}
    </PageWrapper>
  );
}

function EstimateModal({
  initial, onClose, onSubmit, submitting, error, allEstimates,
}: {
  initial?: Estimate | null;
  onClose: () => void;
  onSubmit: (p: Record<string, unknown>) => void;
  submitting: boolean;
  error: string | null;
  allEstimates: Estimate[];
}) {
  const [f, setF] = useState({
    project_name: "",
    gc_name: "",
    architect_eor: "",
    project_location: "",
    bid_due_date: "",
    bid_type: "Lump Sum",
    drawing_set_ref: "",
    unique_piece_marks: "",
    connection_complexity: "simple_shear",
    detailing_hours: "",
    fabrication_hours: "",
    erection_hours: "",
    labor_rate: "75",
    freight_mill_to_shop: "",
    freight_shop_to_site: "",
    paint_coating_required: false,
    coating_type: "Shop Primer",
    coating_pricing_method: "per_ton",
    coating_price_per_ton: "",
    coating_lump_sum: "",
    contingency_pct: "0",
    margin_pct: "15",
    exclusions_qualifications: "",
    notes: "",
    status: "draft",
    total_amount: "", // Override
  });

  const [materials, setMaterials] = useState<Array<{ shape: string; tons: string; price_per_ton: string }>>([]);
  const [alternates, setAlternates] = useState<Array<{ description: string; type: "add" | "deduct"; amount: string }>>([]);
  
  const [sections, setSections] = useState({
    bid_info: true,
    material_labor: true,
    freight_coatings: false,
    alternates: false,
    exclusions: false,
    status_notes: false,
  });

  const toggleSection = (sec: keyof typeof sections) => {
    setSections(prev => ({ ...prev, [sec]: !prev[sec] }));
  };

  // Load initial estimate data if editing
  useEffect(() => {
    if (initial) {
      setF({
        project_name: initial.project_name || "",
        gc_name: initial.gc_name || "",
        architect_eor: initial.architect_eor || "",
        project_location: initial.project_location || "",
        bid_due_date: initial.bid_due_date || "",
        bid_type: initial.bid_type || "Lump Sum",
        drawing_set_ref: initial.drawing_set_ref || "",
        unique_piece_marks: initial.unique_piece_marks?.toString() || "",
        connection_complexity: initial.connection_complexity || "simple_shear",
        detailing_hours: initial.detailing_hours?.toString() || "",
        fabrication_hours: initial.fabrication_hours?.toString() || "",
        erection_hours: initial.erection_hours?.toString() || "",
        labor_rate: initial.labor_rate?.toString() || "75",
        freight_mill_to_shop: initial.freight_mill_to_shop?.toString() || "",
        freight_shop_to_site: initial.freight_shop_to_site?.toString() || "",
        paint_coating_required: !!initial.paint_coating_required,
        coating_type: initial.coating_type || "Shop Primer",
        coating_pricing_method: initial.coating_pricing_method || "per_ton",
        coating_price_per_ton: initial.coating_price_per_ton?.toString() || "",
        coating_lump_sum: initial.coating_lump_sum?.toString() || "",
        contingency_pct: initial.contingency_pct?.toString() || "0",
        margin_pct: initial.margin_pct?.toString() || "15",
        exclusions_qualifications: initial.exclusions_qualifications || "",
        notes: initial.notes || "",
        status: initial.status || "draft",
        total_amount: initial.total_amount?.toString() || "",
      });

      if (initial.materials_breakdown && initial.materials_breakdown.length > 0) {
        setMaterials(initial.materials_breakdown.map(m => ({
          shape: m.shape,
          tons: m.tons?.toString() || "0",
          price_per_ton: m.price_per_ton?.toString() || "0",
        })));
      } else {
        setMaterials(DEFAULT_SHAPES.map(s => ({ shape: s.shape, tons: "0", price_per_ton: s.price_per_ton.toString() })));
      }

      setAlternates((initial.alternates || []).map(a => ({
        description: a.description,
        type: a.type || "add",
        amount: a.amount?.toString() || "0",
      })));
    } else {
      // New estimate: load default shapes
      setMaterials(DEFAULT_SHAPES.map(s => ({ shape: s.shape, tons: "0", price_per_ton: s.price_per_ton.toString() })));
      
      // Load company template for exclusions
      FabAPI.getOrganization().then((org) => {
        if (org.default_exclusions_qualifications) {
          setF(prev => ({ ...prev, exclusions_qualifications: org.default_exclusions_qualifications || "" }));
        }
      }).catch(err => console.warn("Could not fetch company default exclusions", err));
    }
  }, [initial]);

  // Update material category row
  const updateMaterial = (idx: number, key: "shape" | "tons" | "price_per_ton", val: string) => {
    const next = [...materials];
    next[idx] = { ...next[idx], [key]: val };
    setMaterials(next);
  };

  const addMaterialRow = () => {
    setMaterials(prev => [...prev, { shape: "Custom Shape", tons: "0", price_per_ton: "1200" }]);
  };

  const removeMaterialRow = (idx: number) => {
    setMaterials(prev => prev.filter((_, i) => i !== idx));
  };

  // Alternates table handlers
  const updateAlternate = (idx: number, key: "description" | "type" | "amount", val: string) => {
    const next = [...alternates];
    next[idx] = { ...next[idx], [key]: val } as typeof alternates[0];
    setAlternates(next);
  };

  const addAlternateRow = () => {
    setAlternates(prev => [...prev, { description: "", type: "add", amount: "0" }]);
  };

  const removeAlternateRow = (idx: number) => {
    setAlternates(prev => prev.filter((_, i) => i !== idx));
  };

  // Live Pricing calculations
  const totalTons = materials.reduce((sum, item) => sum + Number(item.tons || 0), 0);
  const materialCost = materials.reduce((sum, item) => sum + (Number(item.tons || 0) * Number(item.price_per_ton || 0)), 0);

  // Suggested labor hours calculation
  const complexityFactors = LABOR_FACTORS[f.connection_complexity] || LABOR_FACTORS.simple_shear;
  const sugDetailing = totalTons * complexityFactors.detailing;
  const sugFabrication = totalTons * complexityFactors.fabrication;
  const sugErection = totalTons * complexityFactors.erection;

  // Detailing hours actually used (typed or placeholder suggestion)
  const detHoursUsed = f.detailing_hours !== "" ? Number(f.detailing_hours) : sugDetailing;
  const fabHoursUsed = f.fabrication_hours !== "" ? Number(f.fabrication_hours) : sugFabrication;
  const ereHoursUsed = f.erection_hours !== "" ? Number(f.erection_hours) : sugErection;
  const laborRate = Number(f.labor_rate || 75);

  const laborCost = (detHoursUsed + fabHoursUsed + ereHoursUsed) * laborRate;
  
  const freightCost = Number(f.freight_mill_to_shop || 0) + Number(f.freight_shop_to_site || 0);

  let coatingCost = 0;
  if (f.paint_coating_required) {
    if (f.coating_pricing_method === "per_ton") {
      coatingCost = totalTons * Number(f.coating_price_per_ton || 0);
    } else {
      coatingCost = Number(f.coating_lump_sum || 0);
    }
  }

  const subtotal = materialCost + laborCost + freightCost + coatingCost;

  const marginPct = Number(f.margin_pct || 15);
  const marginAmt = subtotal * (marginPct / 100);

  const contingencyPct = Number(f.contingency_pct || 0);
  const contingencyAmt = subtotal * (contingencyPct / 100);

  const calculatedTotal = subtotal + marginAmt + contingencyAmt;
  const finalBidPrice = f.total_amount !== "" ? Number(f.total_amount) : calculatedTotal;

  // Detailing / fabrication suggesting averages from historical won estimates
  const wonEstimatesOfComplexity = allEstimates.filter(e => e.status === "won" && e.connection_complexity === f.connection_complexity);
  let histDet = 0, histFab = 0, histEre = 0, histCount = 0;
  wonEstimatesOfComplexity.forEach(we => {
    const wt = we.materials_breakdown?.reduce((s, it) => s + Number(it.tons || 0), 0) || 0;
    if (wt > 0) {
      histDet += (we.detailing_hours || 0) / wt;
      histFab += (we.fabrication_hours || 0) / wt;
      histEre += (we.erection_hours || 0) / wt;
      histCount++;
    }
  });
  const histSugDet = histCount > 0 ? (histDet / histCount) * totalTons : 0;
  const histSugFab = histCount > 0 ? (histFab / histCount) * totalTons : 0;
  const histSugEre = histCount > 0 ? (histEre / histCount) * totalTons : 0;

  // Exclusions qualifications template save
  const [savingTemplate, setSavingTemplate] = useState(false);
  const saveTemplate = async () => {
    setSavingTemplate(true);
    try {
      await FabAPI.updateOrganization({ default_exclusions_qualifications: f.exclusions_qualifications });
      alert("Exclusions template successfully updated for your company!");
    } catch (e) {
      alert("Failed to save template: " + (e as Error).message);
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Status validation
    if (f.status !== "draft") {
      if (totalTons <= 0) {
        alert("Estimating total tons must be greater than 0 to submit, won, or review.");
        return;
      }
      if (!f.unique_piece_marks || Number(f.unique_piece_marks) <= 0) {
        alert("Unique Piece Marks is required and must be greater than 0 to submit.");
        return;
      }
    }

    const payload = {
      project_name: f.project_name,
      gc_name: f.gc_name || null,
      architect_eor: f.architect_eor || null,
      project_location: f.project_location || null,
      bid_due_date: f.bid_due_date || null,
      bid_type: f.bid_type,
      drawing_set_ref: f.drawing_set_ref || null,
      unique_piece_marks: f.unique_piece_marks ? Number(f.unique_piece_marks) : null,
      connection_complexity: f.connection_complexity,
      detailing_hours: detHoursUsed || null,
      fabrication_hours: fabHoursUsed || null,
      erection_hours: ereHoursUsed || null,
      labor_rate: laborRate,
      freight_mill_to_shop: f.freight_mill_to_shop ? Number(f.freight_mill_to_shop) : null,
      freight_shop_to_site: f.freight_shop_to_site ? Number(f.freight_shop_to_site) : null,
      paint_coating_required: f.paint_coating_required,
      coating_type: f.coating_type || null,
      coating_pricing_method: f.coating_pricing_method || null,
      coating_price_per_ton: f.coating_price_per_ton ? Number(f.coating_price_per_ton) : null,
      coating_lump_sum: f.coating_lump_sum ? Number(f.coating_lump_sum) : null,
      contingency_pct: Number(f.contingency_pct || 0),
      margin_pct: Number(f.margin_pct || 15),
      exclusions_qualifications: f.exclusions_qualifications || null,
      notes: f.notes || null,
      status: f.status,
      total_amount: finalBidPrice,
      materials_breakdown: materials.map(m => ({
        shape: m.shape,
        tons: Number(m.tons || 0),
        price_per_ton: Number(m.price_per_ton || 0),
      })),
      alternates: alternates.map(a => ({
        description: a.description,
        type: a.type,
        amount: Number(a.amount || 0),
      })),
    };

    onSubmit(payload);
  };

  // Convert estimate to won & convert directly inside modal
  const [awardingModal, setAwardingModal] = useState(false);
  const awardProjectDirectly = async () => {
    if (!initial?.id) return;
    setAwardingModal(true);
    try {
      await FabAPI.convertEstimate({ estimate_id: initial.id });
      onClose();
      window.location.reload();
    } catch (e) {
      alert("Error converting project: " + (e as Error).message);
    } finally {
      setAwardingModal(false);
    }
  };

  return (
    <ResourceModal
      title={initial ? `Edit estimate #${initial.estimate_number}` : "New Estimate"}
      onClose={onClose}
      onSubmit={handleFormSubmit}
      submitting={submitting || awardingModal}
      error={error}
      width={1000}
      submitLabel={initial ? "Save Estimate" : "Create Estimate"}
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 24, alignItems: "start" }}>
        
        {/* Left Column - Form Sections */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          
          {/* Section: Bid Info */}
          <div className="card" style={{ border: "1px solid var(--border)" }}>
            <div
              onClick={() => toggleSection("bid_info")}
              className="card-header flex items-center justify-between cursor-pointer py-3 px-4"
              style={{ background: "rgba(255,255,255,0.02)" }}
            >
              <div className="font-semibold text-sm">1. Bid Information</div>
              {sections.bid_info ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </div>
            {sections.bid_info && (
              <div className="card-body p-4 flex flex-col gap-3">
                <div className="grid-2 gap-md">
                  <Field label="Project name" required>
                    <input className="input" required value={f.project_name} onChange={(e) => setF({ ...f, project_name: e.target.value })} />
                  </Field>
                  <Field label="GC name">
                    <input className="input" value={f.gc_name} onChange={(e) => setF({ ...f, gc_name: e.target.value })} />
                  </Field>
                </div>
                <div className="grid-2 gap-md">
                  <Field label="Architect / EOR">
                    <input className="input" value={f.architect_eor} onChange={(e) => setF({ ...f, architect_eor: e.target.value })} />
                  </Field>
                  <Field label="Project location">
                    <input className="input" value={f.project_location} onChange={(e) => setF({ ...f, project_location: e.target.value })} />
                  </Field>
                </div>
                <div className="grid-3 gap-sm">
                  <Field label="Bid due" required>
                    <input className="input" type="date" required value={f.bid_due_date} onChange={(e) => setF({ ...f, bid_due_date: e.target.value })} />
                  </Field>
                  <Field label="Bid type">
                    <select className="input" value={f.bid_type} onChange={(e) => setF({ ...f, bid_type: e.target.value })}>
                      <option value="Lump Sum">Lump Sum</option>
                      <option value="T&M">T&M</option>
                      <option value="Negotiated">Negotiated</option>
                      <option value="Design-Build">Design-Build</option>
                    </select>
                  </Field>
                  <Field label="Drawing Set Ref">
                    <input className="input" value={f.drawing_set_ref} onChange={(e) => setF({ ...f, drawing_set_ref: e.target.value })} placeholder="e.g. IFC Revision 2" />
                  </Field>
                </div>
              </div>
            )}
          </div>

          {/* Section: Material & Labor */}
          <div className="card" style={{ border: "1px solid var(--border)" }}>
            <div
              onClick={() => toggleSection("material_labor")}
              className="card-header flex items-center justify-between cursor-pointer py-3 px-4"
              style={{ background: "rgba(255,255,255,0.02)" }}
            >
              <div className="font-semibold text-sm">2. Material & Labor</div>
              {sections.material_labor ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </div>
            {sections.material_labor && (
              <div className="card-body p-4 flex flex-col gap-4">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">MEMBER MATERIAL TAKE-OFF</div>
                <div className="tbl-wrap" style={{ border: "1px solid var(--border)", borderRadius: 6 }}>
                  <table style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th>Material Shape</th>
                        <th style={{ width: 100, textAlign: "right" }}>Tons</th>
                        <th style={{ width: 120, textAlign: "right" }}>$ / Ton</th>
                        <th style={{ width: 50 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {materials.map((m, idx) => (
                        <tr key={idx}>
                          <td>
                            <input
                              className="input text-xs font-semibold"
                              style={{ padding: "4px 8px" }}
                              value={m.shape}
                              onChange={(e) => updateMaterial(idx, "shape", e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              className="input text-xs text-right font-mono"
                              style={{ padding: "4px 8px" }}
                              type="number"
                              step="0.01"
                              value={m.tons}
                              onChange={(e) => updateMaterial(idx, "tons", e.target.value)}
                            />
                          </td>
                          <td>
                            <input
                              className="input text-xs text-right font-mono"
                              style={{ padding: "4px 8px" }}
                              type="number"
                              step="0.01"
                              value={m.price_per_ton}
                              onChange={(e) => updateMaterial(idx, "price_per_ton", e.target.value)}
                            />
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-sm text-red-500 hover:bg-red-500/10 border-none p-1"
                              onClick={() => removeMaterialRow(idx)}
                            >
                              <Trash size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between">
                  <button type="button" className="btn btn-sm" onClick={addMaterialRow}>
                    + Add Material
                  </button>
                  <div className="text-xs text-slate-400 font-mono">
                    Take-off: <strong className="text-white">{totalTons.toFixed(2)} tons</strong> blended at <strong className="text-white">${totalTons > 0 ? (materialCost / totalTons).toFixed(2) : "0"}/ton</strong>
                  </div>
                </div>

                <hr style={{ borderColor: "var(--border)", margin: "8px 0" }} />

                <div className="grid-2 gap-md">
                  <Field label="Unique Piece Marks" required>
                    <input
                      className="input font-mono"
                      type="number"
                      value={f.unique_piece_marks}
                      onChange={(e) => setF({ ...f, unique_piece_marks: e.target.value })}
                      placeholder="e.g. 150"
                    />
                  </Field>
                  <Field label="Connection Complexity">
                    <select
                      className="input"
                      value={f.connection_complexity}
                      onChange={(e) => setF({ ...f, connection_complexity: e.target.value })}
                    >
                      <option value="simple_shear">Simple Shear (1.5-6-2 hr/T)</option>
                      <option value="moment_connections">Moment Connections (2.5-9-3 hr/T)</option>
                      <option value="mixed">Mixed Connections (2.0-7.5-2.5 hr/T)</option>
                      <option value="heavy_misc">Heavy Misc (4.0-15-6 hr/T)</option>
                    </select>
                  </Field>
                </div>

                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-2">FABRICATION LABOR ESTIMATING</div>
                <div className="grid-4 gap-sm">
                  <Field label="Detailing Hours" hint={`Sug: ${sugDetailing.toFixed(1)} hrs`}>
                    <input
                      className="input font-mono"
                      type="number"
                      value={f.detailing_hours}
                      onChange={(e) => setF({ ...f, detailing_hours: e.target.value })}
                      placeholder={sugDetailing.toFixed(1)}
                    />
                  </Field>
                  <Field label="Fabrication Hours" hint={`Sug: ${sugFabrication.toFixed(1)} hrs`}>
                    <input
                      className="input font-mono"
                      type="number"
                      value={f.fabrication_hours}
                      onChange={(e) => setF({ ...f, fabrication_hours: e.target.value })}
                      placeholder={sugFabrication.toFixed(1)}
                    />
                  </Field>
                  <Field label="Erection Hours" hint={`Sug: ${sugErection.toFixed(1)} hrs`}>
                    <input
                      className="input font-mono"
                      type="number"
                      value={f.erection_hours}
                      onChange={(e) => setF({ ...f, erection_hours: e.target.value })}
                      placeholder={sugErection.toFixed(1)}
                    />
                  </Field>
                  <Field label="Labor Rate ($/hr)">
                    <input
                      className="input font-mono"
                      type="number"
                      value={f.labor_rate}
                      onChange={(e) => setF({ ...f, labor_rate: e.target.value })}
                    />
                  </Field>
                </div>
              </div>
            )}
          </div>

          {/* Section: Freight & Coatings */}
          <div className="card" style={{ border: "1px solid var(--border)" }}>
            <div
              onClick={() => toggleSection("freight_coatings")}
              className="card-header flex items-center justify-between cursor-pointer py-3 px-4"
              style={{ background: "rgba(255,255,255,0.02)" }}
            >
              <div className="font-semibold text-sm">3. Freight & Coatings</div>
              {sections.freight_coatings ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </div>
            {sections.freight_coatings && (
              <div className="card-body p-4 flex flex-col gap-4">
                <div className="grid-2 gap-md">
                  <Field label="Freight: Mill to Shop ($)">
                    <input
                      className="input font-mono"
                      type="number"
                      value={f.freight_mill_to_shop}
                      onChange={(e) => setF({ ...f, freight_mill_to_shop: e.target.value })}
                    />
                  </Field>
                  <Field label="Freight: Shop to Site ($)">
                    <input
                      className="input font-mono"
                      type="number"
                      value={f.freight_shop_to_site}
                      onChange={(e) => setF({ ...f, freight_shop_to_site: e.target.value })}
                    />
                  </Field>
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <input
                    type="checkbox"
                    id="paint_coating_required"
                    checked={f.paint_coating_required}
                    onChange={(e) => setF({ ...f, paint_coating_required: e.target.checked })}
                    style={{ width: 16, height: 16 }}
                  />
                  <label htmlFor="paint_coating_required" className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Paint / Coating Required
                  </label>
                </div>

                {f.paint_coating_required && (
                  <div className="card p-3 flex flex-col gap-3" style={{ background: "rgba(255,255,255,0.01)", border: "1px solid var(--border)" }}>
                    <div className="grid-2 gap-md">
                      <Field label="Coating Type">
                        <select className="input" value={f.coating_type} onChange={(e) => setF({ ...f, coating_type: e.target.value })}>
                          <option value="Shop Primer">Shop Primer</option>
                          <option value="Full Paint">Full Paint</option>
                          <option value="Galvanized">Galvanized</option>
                        </select>
                      </Field>
                      <Field label="Pricing Basis">
                        <div className="flex items-center gap-4 mt-2">
                          <label className="flex items-center gap-1 text-xs">
                            <input
                              type="radio"
                              name="coating_pricing_method"
                              value="per_ton"
                              checked={f.coating_pricing_method === "per_ton"}
                              onChange={() => setF({ ...f, coating_pricing_method: "per_ton" })}
                            />
                            $ / Ton
                          </label>
                          <label className="flex items-center gap-1 text-xs">
                            <input
                              type="radio"
                              name="coating_pricing_method"
                              value="lump_sum"
                              checked={f.coating_pricing_method === "lump_sum"}
                              onChange={() => setF({ ...f, coating_pricing_method: "lump_sum" })}
                            />
                            Lump Sum
                          </label>
                        </div>
                      </Field>
                    </div>

                    {f.coating_pricing_method === "per_ton" ? (
                      <Field label="Coating Price per Ton ($)">
                        <input
                          className="input font-mono"
                          type="number"
                          value={f.coating_price_per_ton}
                          onChange={(e) => setF({ ...f, coating_price_per_ton: e.target.value })}
                          placeholder="e.g. 150"
                        />
                      </Field>
                    ) : (
                      <Field label="Coating Lump Sum Amount ($)">
                        <input
                          className="input font-mono"
                          type="number"
                          value={f.coating_lump_sum}
                          onChange={(e) => setF({ ...f, coating_lump_sum: e.target.value })}
                        />
                      </Field>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section: Alternates */}
          <div className="card" style={{ border: "1px solid var(--border)" }}>
            <div
              onClick={() => toggleSection("alternates")}
              className="card-header flex items-center justify-between cursor-pointer py-3 px-4"
              style={{ background: "rgba(255,255,255,0.02)" }}
            >
              <div className="font-semibold text-sm">4. Bid Alternates</div>
              {sections.alternates ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </div>
            {sections.alternates && (
              <div className="card-body p-4 flex flex-col gap-3">
                <div className="tbl-wrap" style={{ border: "1px solid var(--border)", borderRadius: 6 }}>
                  <table style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th>Alternate Description</th>
                        <th style={{ width: 120 }}>Type</th>
                        <th style={{ width: 130, textAlign: "right" }}>Amount ($)</th>
                        <th style={{ width: 50 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {alternates.map((a, idx) => (
                        <tr key={idx}>
                          <td>
                            <input
                              className="input text-xs"
                              style={{ padding: "4px 8px" }}
                              value={a.description}
                              onChange={(e) => updateAlternate(idx, "description", e.target.value)}
                              placeholder="e.g. Detached Canopies alternate"
                            />
                          </td>
                          <td>
                            <select
                              className="input text-xs"
                              style={{ padding: "4px 8px" }}
                              value={a.type}
                              onChange={(e) => updateAlternate(idx, "type", e.target.value)}
                            >
                              <option value="add">Add</option>
                              <option value="deduct">Deduct</option>
                            </select>
                          </td>
                          <td>
                            <input
                              className="input text-xs text-right font-mono"
                              style={{ padding: "4px 8px" }}
                              type="number"
                              value={a.amount}
                              onChange={(e) => updateAlternate(idx, "amount", e.target.value)}
                            />
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-sm text-red-500 hover:bg-red-500/10 border-none p-1"
                              onClick={() => removeAlternateRow(idx)}
                            >
                              <Trash size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button type="button" className="btn btn-sm self-start" onClick={addAlternateRow}>
                  + Add Alternate
                </button>
              </div>
            )}
          </div>

          {/* Section: Exclusions & Qualifications */}
          <div className="card" style={{ border: "1px solid var(--border)" }}>
            <div
              onClick={() => toggleSection("exclusions")}
              className="card-header flex items-center justify-between cursor-pointer py-3 px-4"
              style={{ background: "rgba(255,255,255,0.02)" }}
            >
              <div className="font-semibold text-sm">5. Exclusions & Qualifications</div>
              {sections.exclusions ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </div>
            {sections.exclusions && (
              <div className="card-body p-4 flex flex-col gap-3">
                <Field label="Scope Exclusions & Qualifications text">
                  <textarea
                    className="input text-xs font-mono"
                    rows={8}
                    value={f.exclusions_qualifications}
                    onChange={(e) => setF({ ...f, exclusions_qualifications: e.target.value })}
                    style={{ height: "auto", resize: "vertical", padding: 10 }}
                  />
                </Field>
                <button
                  type="button"
                  className="btn btn-sm self-end"
                  disabled={savingTemplate}
                  onClick={saveTemplate}
                >
                  Save as Default Template
                </button>
              </div>
            )}
          </div>

          {/* Section: Status & Notes */}
          <div className="card" style={{ border: "1px solid var(--border)" }}>
            <div
              onClick={() => toggleSection("status_notes")}
              className="card-header flex items-center justify-between cursor-pointer py-3 px-4"
              style={{ background: "rgba(255,255,255,0.02)" }}
            >
              <div className="font-semibold text-sm">6. Status & Notes</div>
              {sections.status_notes ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </div>
            {sections.status_notes && (
              <div className="card-body p-4 flex flex-col gap-3">
                <div className="grid-2 gap-md">
                  <Field label="Estimate Status">
                    <select className="input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
                      {STATUSES.map(s => (
                        <option key={s} value={s}>
                          {s.toUpperCase().replace("_", " ")}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Total Override ($)" hint="Leave blank to auto-calculate">
                    <input
                      className="input font-mono"
                      type="number"
                      value={f.total_amount}
                      onChange={(e) => setF({ ...f, total_amount: e.target.value })}
                    />
                  </Field>
                </div>
                <Field label="Internal Estimating Notes">
                  <textarea
                    className="input text-xs"
                    rows={3}
                    value={f.notes}
                    onChange={(e) => setF({ ...f, notes: e.target.value })}
                    style={{ height: "auto", resize: "vertical", padding: 8 }}
                  />
                </Field>
              </div>
            )}
          </div>

        </div>

        {/* Right Column - pricing summary + comparables */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 0 }}>
          
          {/* Section: Summary */}
          <div className="card" style={{ border: "1.5px solid var(--primary-border, var(--border))", background: "rgba(255,255,255,0.01)" }}>
            <div className="card-header py-3 px-4 font-bold text-sm tracking-wider uppercase" style={{ color: "var(--primary)" }}>
              Pricing Summary
            </div>
            <div className="card-body p-4 flex flex-col gap-3">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Material Subtotal:</span>
                <span className="font-mono font-medium">${materialCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Labor Subtotal ({detHoursUsed + fabHoursUsed + ereHoursUsed} hrs):</span>
                <span className="font-mono font-medium">${laborCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Freight Subtotal:</span>
                <span className="font-mono font-medium">${freightCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Coatings Subtotal:</span>
                <span className="font-mono font-medium">${coatingCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              
              <hr style={{ borderColor: "var(--border)", margin: "4px 0" }} />
              
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-slate-300">ESTIMATED COST:</span>
                <span className="font-mono font-semibold">${subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>

              <div className="grid-2 gap-sm mt-1">
                <label className="flex flex-col gap-1 text-[10px] text-slate-400 uppercase font-semibold">
                  Margin %
                  <input
                    className="input font-mono"
                    style={{ padding: "4px 8px", fontSize: 11 }}
                    type="number"
                    value={f.margin_pct}
                    onChange={(e) => setF({ ...f, margin_pct: e.target.value })}
                  />
                </label>
                <label className="flex flex-col gap-1 text-[10px] text-slate-400 uppercase font-semibold">
                  Contingency %
                  <input
                    className="input font-mono"
                    style={{ padding: "4px 8px", fontSize: 11 }}
                    type="number"
                    value={f.contingency_pct}
                    onChange={(e) => setF({ ...f, contingency_pct: e.target.value })}
                  />
                </label>
              </div>

              <div className="flex justify-between text-xs mt-1">
                <span className="text-slate-400">Margin Amount ({marginPct}%):</span>
                <span className="font-mono font-medium">${marginAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Contingency Amount ({contingencyPct}%):</span>
                <span className="font-mono font-medium">${contingencyAmt.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>

              <hr style={{ borderColor: "var(--border)", margin: "4px 0" }} />

              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs">
                  <span className="font-bold text-slate-200">TOTAL CALCULATED BID:</span>
                  <span className="font-mono font-bold text-sm text-green-500">${calculatedTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                {f.total_amount !== "" && (
                  <div className="flex justify-between text-xs mt-1 border border-dashed border-red-500/30 rounded p-1 bg-red-500/5">
                    <span className="font-semibold text-red-400">OVERRIDDEN TOTAL:</span>
                    <span className="font-mono font-bold text-red-400">${Number(f.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>

              {/* Award Project directly from modal if Won */}
              {initial?.id && f.status === "won" && !initial.converted_project_id && (
                <button
                  type="button"
                  onClick={awardProjectDirectly}
                  className="btn btn-primary w-full flex items-center justify-center gap-1.5 mt-3 py-2 text-xs font-semibold"
                  style={{ background: "var(--success, #16A34A)" }}
                  disabled={submitting}
                >
                  <Wand2 size={13} />
                  Award Project Now
                </button>
              )}
              {initial?.converted_project_id && (
                <div className="pill pill-green flex items-center gap-1 mt-2 text-center justify-center p-2 text-xs">
                  <AlertCircle size={12} /> Project Handed Over
                </div>
              )}
            </div>
          </div>

          {/* Section: Comparable Jobs */}
          <div className="card" style={{ border: "1px solid var(--border)", background: "rgba(255,255,255,0.01)" }}>
            <div className="card-header py-2.5 px-4 font-bold text-xs tracking-wider uppercase text-slate-400">
              Comparable Jobs ({wonEstimatesOfComplexity.length})
            </div>
            <div className="card-body p-4 flex flex-col gap-3">
              {wonEstimatesOfComplexity.length === 0 ? (
                <div className="text-xs text-slate-500 text-center py-2">
                  No historical won bids with {f.connection_complexity.replace("_", " ")} complexity.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {wonEstimatesOfComplexity.slice(0, 3).map((we) => {
                    const wt = we.materials_breakdown?.reduce((s, it) => s + Number(it.tons || 0), 0) || 0;
                    return (
                      <div key={we.id} className="flex flex-col border-b border-slate-800 pb-2 last:border-0 last:pb-0">
                        <div className="flex justify-between font-semibold text-xs text-slate-300">
                          <span>{we.project_name}</span>
                          <span className="font-mono text-green-500">${(we.total_amount / (wt || 1)).toFixed(0)}/T</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-0.5">
                          <span>{wt.toFixed(1)} tons</span>
                          <span>Est #{we.estimate_number}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </ResourceModal>
  );
}
