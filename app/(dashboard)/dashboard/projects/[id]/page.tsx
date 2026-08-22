"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { useResource, useResourceList, useUpdate } from "@/hooks/useResource";
import { useGlobalProject } from "@/hooks/useGlobalProject";
import { FabAPI } from "@/lib/api";
import {
  Loader2,
  AlertCircle,
  Archive,
  ArrowLeft,
  Wand2,
  Pencil,
  Building2,
  FileText,
  Layers,
  Calendar,
  Compass,
  MessageSquare,
  DollarSign,
  CheckCircle2,
  Clock,
  ExternalLink,
  ShieldAlert,
  FileCheck,
  Wrench,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface BaselineBudget {
  scope_of_work?: string;
  est_tonnage?: number;
  unique_piece_marks?: number;
  detailing_hours?: number;
  fabrication_hours?: number;
  erection_hours?: number;
  labor_rate?: number;
  material_cost?: number;
  labor_cost?: number;
  equipment_cost?: number;
  subcontract_cost?: number;
  hardware_cost?: number;
  freight_cost?: number;
  coating_cost?: number;
  subtotal?: number;
  profit_margin_pct?: number;
  profit_margin_amount?: number;
  contingency_pct?: number;
  contingency_amount?: number;
  contract_value?: number;
  schedule_deadline?: string;
  // Legacy fields fallback
  material?: number;
  labor?: number;
  freight?: number;
  coating?: number;
  margin?: number;
  contingency?: number;
  total?: number;
}

interface Project {
  id: string;
  name: string;
  number: string | null;
  gc_name: string | null;
  contract_value: number | null;
  est_tonnage: number | null;
  status: string;
  start_date: string | null;
  deadline: string | null;
  description: string | null;
  color: string | null;
  is_archived: boolean;
  architect_eor?: string | null;
  project_location?: string | null;
  unique_piece_marks?: number | null;
  baseline_budget?: BaselineBudget | null;
  drawing_set_ref?: string | null;
  exclusions_qualifications?: string | null;
  estimate_id?: string | null;
  created_at?: string;
}

interface Part { id: string; part_mark: string; profile: string; status: string; quantity: number; }
interface Drawing { id: string; drawing_number: string; revision: string; status: string; }
interface CO { id: string; co_number: string; description: string; amount: number; status: string; }

export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const project = useResource<Project>("projects", id);
  const parts = useResourceList<Part>("parts", { project_id: id, limit: "50" });
  const drawings = useResourceList<Drawing>("drawings", { project_id: id, limit: "50" });
  const cos = useResourceList<CO>("change_orders", { project_id: id, limit: "50" });
  const update = useUpdate<Project>("projects");
  const { selectProject, selectedProjectId } = useGlobalProject();

  const [activeTab, setActiveTab] = useState<"overview" | "customer_contract" | "scope" | "budget" | "schedule_milestones" | "drawings" | "communication">("overview");
  const [archiving, setArchiving] = useState(false);
  const [seedingAisc, setSeedingAisc] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [jobNumberInput, setJobNumberInput] = useState("");
  const [isActivating, setIsActivating] = useState(false);

  useEffect(() => {
    if (project.data?.number) {
      setJobNumberInput(project.data.number);
    }
  }, [project.data?.number]);

  useEffect(() => {
    if (project.data && project.data.id !== selectedProjectId) {
      selectProject(project.data.id, project.data.name, project.data.number);
    }
  }, [project.data?.id]);

  if (project.isLoading) {
    return (
      <PageWrapper title="…">
        <div className="flex items-center justify-center p-12 text-slate-800">
          <Loader2 size={20} className="animate-spin mr-2 text-indigo-600" />
          <span className="font-bold text-base text-slate-900">Loading project details…</span>
        </div>
      </PageWrapper>
    );
  }

  if (project.error || !project.data) {
    return (
      <PageWrapper title="Project">
        <div className="card p-6 text-red-700 bg-red-50 border border-red-200 flex items-center gap-2 font-bold text-sm rounded-xl">
          <AlertCircle size={18} />
          {project.error?.message ?? "Project not found"}
        </div>
      </PageWrapper>
    );
  }

  const p = project.data;
  const b = p.baseline_budget;
  const completed = (parts.data ?? []).filter((x) => ["complete", "shipped"].includes(x.status)).length;
  const progress = parts.data?.length ? Math.round((completed / parts.data.length) * 100) : 0;

  async function archive() {
    setArchiving(true);
    try { await FabAPI.archiveProject(id); project.refetch(); } finally { setArchiving(false); }
  }

  async function seedAisc() {
    setSeedingAisc(true);
    try { await FabAPI.seedAisc(id); } finally { setSeedingAisc(false); }
  }

  // Budget calculations
  const matCost = b?.material_cost ?? b?.material ?? 0;
  const labCost = b?.labor_cost ?? b?.labor ?? 0;
  const equipCost = b?.equipment_cost ?? 0;
  const subCost = b?.subcontract_cost ?? 0;
  const hwCost = b?.hardware_cost ?? 0;
  const frtCost = b?.freight_cost ?? b?.freight ?? 0;
  const coatCost = b?.coating_cost ?? b?.coating ?? 0;
  const marginAmt = b?.profit_margin_amount ?? b?.margin ?? 0;
  const contAmt = b?.contingency_amount ?? b?.contingency ?? 0;
  const totalBudget = b?.contract_value ?? b?.total ?? p.contract_value ?? (matCost + labCost + equipCost + subCost + hwCost + frtCost + coatCost + marginAmt + contAmt);

  const milestones = [
    { title: "Project Award & Setup", date: p.created_at ? new Date(p.created_at).toLocaleDateString() : "Completed", status: "completed" },
    { title: "Detailing & Approval Drawings", date: p.drawing_set_ref || "In Progress", status: drawings.data?.length ? "completed" : "in_progress" },
    { title: "Mill Steel Order & Procurement", date: `${p.est_tonnage || 0} Tons`, status: parts.data?.length ? "completed" : "pending" },
    { title: "Shop Fabrication & Welding", date: `${progress}% Complete`, status: progress > 0 ? (progress === 100 ? "completed" : "in_progress") : "pending" },
    { title: "Coatings & Surface Finish", date: coatCost > 0 ? "Specified" : "Standard Shop Primer", status: "pending" },
    { title: "Field Erection & Final Handover", date: p.deadline ? new Date(p.deadline).toLocaleDateString() : "Target Date", status: "pending" },
  ];

  return (
    <PageWrapper title={p.name}>
      <div className="w-full max-w-full space-y-6">
        {/* Top Header Navigation */}
        <div className="flex items-center justify-between">
          <Link href="/dashboard/projects" className="btn btn-sm btn-outline flex items-center gap-1.5 text-xs font-bold text-slate-800 border-slate-300 bg-white hover:bg-slate-100">
            <ArrowLeft size={13} /> Back to Projects
          </Link>
          <div className="flex items-center gap-2">
            <StatusPill status={p.status} />
            <button className="btn btn-sm btn-outline text-xs font-bold text-slate-800 border-slate-300 bg-white hover:bg-slate-100" onClick={() => setShowEdit(true)}>
              <Pencil size={12} /> Edit Project
            </button>
            <button className="btn btn-sm btn-outline text-xs font-bold text-slate-800 border-slate-300 bg-white hover:bg-slate-100" onClick={seedAisc} disabled={seedingAisc || p.status === "awarded_setup"}>
              {seedingAisc ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
              Seed AISC Checklist
            </button>
            <button className="btn btn-sm btn-outline text-xs font-bold text-slate-800 border-slate-300 bg-white hover:bg-slate-100" onClick={archive} disabled={archiving || p.is_archived || p.status === "awarded_setup"}>
              {archiving ? <Loader2 size={12} className="animate-spin" /> : <Archive size={12} />}
              Archive
            </button>
          </div>
        </div>

        {/* Pending Job Number Alert Banner */}
        {(!p.number || p.status === "awarded_setup") && (
          <div className="w-full card border-amber-400 bg-amber-50 p-5 rounded-xl text-slate-900 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertCircle size={22} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="font-bold text-base text-amber-900">Project Awarded from Estimation — Pending Job Number</div>
                <div className="text-xs text-slate-800 mt-1 font-medium leading-relaxed">
                  All estimation data (Scope, Tonnage, Hours, Material/Labor Cost, Schedule) was automatically populated. Enter a Job Number below to activate across production.
                </div>
                <div className="flex items-center gap-3 mt-4 max-w-lg">
                  <input
                    className="input text-xs font-mono font-bold text-slate-950 bg-white border-amber-400 placeholder-slate-400 focus:ring-2 focus:ring-amber-500"
                    value={jobNumberInput}
                    onChange={(e) => setJobNumberInput(e.target.value)}
                    placeholder="Enter Job Number (e.g. PRJ-2026-004)"
                  />
                  <button
                    className="btn btn-primary btn-sm flex-shrink-0 text-xs font-bold py-2 px-4 bg-amber-500 border-amber-500 text-slate-950 hover:bg-amber-400 shadow-sm"
                    disabled={!jobNumberInput.trim() || isActivating}
                    onClick={async () => {
                      setIsActivating(true);
                      try {
                        await update.mutateAsync({
                          id: p.id,
                          body: { number: jobNumberInput.trim(), status: "active" },
                        });
                        project.refetch();
                      } catch (e) {
                        alert("Failed to activate project: " + (e as Error).message);
                      } finally {
                        setIsActivating(false);
                      }
                    }}
                  >
                    Activate Project
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Full-Width High-Contrast White Card Header */}
        <div className="w-full card p-6 bg-white border border-slate-200 rounded-xl shadow-sm text-slate-900">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-200">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-extrabold text-slate-950 tracking-tight leading-tight">{p.name}</h1>
                {p.number && <span className="font-mono text-xs px-3 py-1 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-900 font-bold">{p.number}</span>}
              </div>
              <div className="text-xs text-slate-700 flex flex-wrap items-center gap-x-6 gap-y-1 font-semibold">
                <span>General Contractor: <strong className="text-slate-950">{p.gc_name || "Unassigned"}</strong></span>
                <span>Jobsite Location: <strong className="text-slate-950">{p.project_location || "Not specified"}</strong></span>
                <span>Architect/EOR: <strong className="text-slate-950">{p.architect_eor || "Standard"}</strong></span>
              </div>
            </div>

            <div className="flex items-center gap-8">
              <div className="text-right">
                <div className="text-[11px] uppercase font-bold text-slate-700 tracking-wider">Contract Value</div>
                <div className="text-3xl font-extrabold font-mono text-emerald-700 mt-0.5">{formatCurrency(p.contract_value || totalBudget)}</div>
              </div>
              <div className="text-right border-l border-slate-200 pl-8">
                <div className="text-[11px] uppercase font-bold text-slate-700 tracking-wider">Steel Tonnage</div>
                <div className="text-3xl font-extrabold font-mono text-indigo-900 mt-0.5">{p.est_tonnage ? `${p.est_tonnage} Tons` : "—"}</div>
              </div>
            </div>
          </div>

          {/* Fabrication Progress Bar */}
          <div className="pt-4">
            <div className="flex items-center justify-between text-xs mb-2 font-bold">
              <span className="text-slate-800 flex items-center gap-2"><Layers size={15} className="text-indigo-600" /> Fabrication Progress</span>
              <span className="font-mono text-slate-950">{completed} / {parts.data?.length ?? 0} Parts ({progress}%)</span>
            </div>
            <div className="pbar h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
              <div className="pbar-fill h-full transition-all duration-300" style={{ width: `${progress}%`, background: p.color || "#4F46E5" }} />
            </div>
          </div>
        </div>

        {/* 8-Category Navigation Tabs (High-Contrast White & Dark Styling) */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto">
          <TabButton id="overview" label="Overview" icon={<Building2 size={15} />} active={activeTab} onClick={setActiveTab} />
          <TabButton id="customer_contract" label="Customer & Contract" icon={<FileText size={15} />} active={activeTab} onClick={setActiveTab} />
          <TabButton id="scope" label="Scope of Work" icon={<Layers size={15} />} active={activeTab} onClick={setActiveTab} />
          <TabButton id="budget" label="Budget & Costs" icon={<DollarSign size={15} />} active={activeTab} onClick={setActiveTab} />
          <TabButton id="schedule_milestones" label="Schedule & Milestones" icon={<Calendar size={15} />} active={activeTab} onClick={setActiveTab} />
          <TabButton id="drawings" label="Drawings & Parts" icon={<Compass size={15} />} active={activeTab} onClick={setActiveTab} />
          <TabButton id="communication" label="Communication & Notes" icon={<MessageSquare size={15} />} active={activeTab} onClick={setActiveTab} />
        </div>

        {/* Tab Content Sections */}
        {activeTab === "overview" && (
          <div className="w-full space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <StatCard icon={<Building2 className="text-indigo-700" />} label="General Contractor" value={p.gc_name || "—"} />
              <StatCard icon={<DollarSign className="text-emerald-700" />} label="Contract Value" value={formatCurrency(p.contract_value || totalBudget)} />
              <StatCard icon={<Layers className="text-indigo-900" />} label="Total Steel Tonnage" value={p.est_tonnage ? `${p.est_tonnage} Tons` : "—"} />
              <StatCard icon={<Calendar className="text-amber-700" />} label="Target Completion" value={p.deadline ? new Date(p.deadline).toLocaleDateString() : "—"} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Customer & Contract Quick Overview */}
              <div className="card p-6 bg-white border border-slate-200 rounded-xl shadow-sm text-slate-900">
                <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
                  <h3 className="font-extrabold text-base text-slate-950 flex items-center gap-2"><Building2 size={18} className="text-indigo-700" /> Customer Information</h3>
                  <button className="text-xs font-bold text-indigo-700 hover:text-indigo-900 underline" onClick={() => setActiveTab("customer_contract")}>View Full &rarr;</button>
                </div>
                <div className="space-y-3 text-xs">
                  <DataRow label="General Contractor" value={p.gc_name || "Not specified"} />
                  <DataRow label="Architect / EOR" value={p.architect_eor || "Not specified"} />
                  <DataRow label="Project Location" value={p.project_location || "Not specified"} />
                  <DataRow label="Drawing Set Ref" value={p.drawing_set_ref || "Standard Set"} />
                  <DataRow label="Award Status" value={p.status} />
                </div>
              </div>

              {/* Baseline Budget Quick Overview */}
              <div className="card p-6 bg-white border border-slate-200 rounded-xl shadow-sm text-slate-900">
                <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
                  <h3 className="font-extrabold text-base text-slate-950 flex items-center gap-2"><DollarSign size={18} className="text-emerald-700" /> Baseline Budget (From Estimation)</h3>
                  <button className="text-xs font-bold text-emerald-700 hover:text-emerald-900 underline" onClick={() => setActiveTab("budget")}>View Full Breakdown &rarr;</button>
                </div>
                <div className="space-y-3 text-xs">
                  <DataRow label="Material Baseline" value={formatCurrency(matCost)} />
                  <DataRow label="Labor Baseline (Fab/Detail/Erect)" value={formatCurrency(labCost)} />
                  <DataRow label="Equipment & Freight" value={formatCurrency(equipCost + frtCost)} />
                  <DataRow label="Subcontractor Services" value={formatCurrency(subCost)} />
                  <DataRow label="Profit Margin & Contingency" value={formatCurrency(marginAmt + contAmt)} />
                  <div className="pt-3 border-t border-slate-200 flex justify-between font-extrabold text-base text-emerald-800">
                    <span>Total Awarded Budget:</span>
                    <span className="font-mono text-lg">{formatCurrency(totalBudget)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Customer & Contract Tab */}
        {activeTab === "customer_contract" && (
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card p-6 bg-white border border-slate-200 rounded-xl shadow-sm space-y-5 text-slate-900">
              <h3 className="font-extrabold text-base text-slate-950 border-b border-slate-200 pb-3 flex items-center gap-2">
                <Building2 size={18} className="text-indigo-700" /> 1. Customer Information
              </h3>
              <div className="space-y-4 text-xs">
                <DataRow label="Customer / General Contractor" value={p.gc_name || "Unassigned"} />
                <DataRow label="Architect / Engineer of Record (EOR)" value={p.architect_eor || "Not specified"} />
                <DataRow label="Project Jobsite Location" value={p.project_location || "Not specified"} />
                <DataRow label="Primary Contact" value="General Contractor PM" />
                <DataRow label="Contact Email / Phone" value="Available on file" />
              </div>
            </div>

            <div className="card p-6 bg-white border border-slate-200 rounded-xl shadow-sm space-y-5 text-slate-900">
              <h3 className="font-extrabold text-base text-slate-950 border-b border-slate-200 pb-3 flex items-center gap-2">
                <FileText size={18} className="text-emerald-700" /> 2. Contract Details
              </h3>
              <div className="space-y-4 text-xs">
                <DataRow label="Final Contract Value" value={formatCurrency(p.contract_value || totalBudget)} />
                <DataRow label="Contract Type / Bid Type" value="Lump Sum Structural Steel" />
                <DataRow label="Award Status" value={p.status} />
                <DataRow label="Linked Estimate Reference" value={p.estimate_id ? `Estimate #${p.estimate_id.substring(0, 8)}` : "Direct Award"} />
                {p.estimate_id && (
                  <div className="pt-2">
                    <Link href="/dashboard/estimating" className="text-xs font-extrabold text-indigo-700 hover:text-indigo-900 flex items-center gap-1.5 underline">
                      <ExternalLink size={13} /> View original proposal in Estimating Module
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Scope of Work Tab */}
        {activeTab === "scope" && (
          <div className="w-full space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard icon={<Layers className="text-indigo-900" />} label="Structural Steel Tonnage" value={p.est_tonnage ? `${p.est_tonnage} Tons` : "—"} />
              <StatCard icon={<FileCheck className="text-indigo-700" />} label="Unique Piece Marks" value={p.unique_piece_marks ? String(p.unique_piece_marks) : "Auto-detected"} />
              <StatCard icon={<Wrench className="text-amber-700" />} label="Labor Rates & Hours" value={b?.detailing_hours ? `${(b.detailing_hours + (b.fabrication_hours || 0) + (b.erection_hours || 0)).toFixed(1)} hrs @ $${b.labor_rate || 75}/hr` : "$75.00/hr Baseline"} />
            </div>

            <div className="card p-6 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4 text-slate-900">
              <h3 className="font-extrabold text-base text-slate-950 border-b border-slate-200 pb-3 flex items-center gap-2">
                <ShieldAlert size={18} className="text-amber-700" /> 3. Scope of Work, Exclusions & Qualifications
              </h3>
              <div className="text-xs font-mono p-5 rounded-xl bg-slate-50 border border-slate-300 text-slate-950 leading-relaxed whitespace-pre-wrap font-bold break-words">
                {p.exclusions_qualifications || b?.scope_of_work || "Standard AISC 303 Code of Standard Practice for Steel Buildings applies."}
              </div>
            </div>
          </div>
        )}

        {/* High-Contrast White Background Budget & Costs Tab */}
        {activeTab === "budget" && (
          <div className="w-full space-y-6">
            <div className="card p-6 bg-white border border-slate-200 rounded-xl shadow-sm text-slate-900">
              <h3 className="font-extrabold text-lg text-slate-950 mb-6 flex items-center gap-2 border-b border-slate-200 pb-4">
                <DollarSign size={20} className="text-emerald-700" /> 7. Baseline Budget Breakdown (Populated from Estimation)
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-4">
                  <div className="text-xs font-extrabold uppercase text-slate-900 tracking-wider pb-1 border-b border-slate-200">Direct Fabrication & Material Costs</div>
                  <BudgetRow label="Material Baseline Cost (Steel Shapes, Plate, HSS)" amount={matCost} />
                  <BudgetRow label="Labor Cost (Fab, Detailing, Erection)" amount={labCost} />
                  <BudgetRow label="Equipment & Crane Rental" amount={equipCost} />
                  <BudgetRow label="Subcontractor Erection & Services" amount={subCost} />
                  <BudgetRow label="Bolts & Connection Hardware" amount={hwCost} />
                  <BudgetRow label="Freight (Mill-to-Shop & Shop-to-Site)" amount={frtCost} />
                  <BudgetRow label="Paint, Surface Prep & Coating" amount={coatCost} />
                </div>

                <div className="space-y-4 border-l border-slate-200 pl-0 md:pl-10">
                  <div className="text-xs font-extrabold uppercase text-slate-900 tracking-wider pb-1 border-b border-slate-200">Profit Margin & Contingency Summary</div>
                  <BudgetRow label="Subtotal Direct Costs" amount={matCost + labCost + equipCost + subCost + hwCost + frtCost + coatCost} bold />
                  <BudgetRow label={`Profit Margin (${b?.profit_margin_pct ?? 15}%)`} amount={marginAmt} highlighted />
                  <BudgetRow label={`Contingency Reserve (${b?.contingency_pct ?? 0}%)`} amount={contAmt} />
                  <div className="pt-6 border-t border-slate-300 flex justify-between items-center">
                    <span className="font-extrabold text-base text-slate-950">Total Awarded Contract Budget:</span>
                    <span className="font-mono font-extrabold text-2xl text-emerald-800">{formatCurrency(totalBudget)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Schedule & Milestones Tab */}
        {activeTab === "schedule_milestones" && (
          <div className="w-full space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard icon={<Calendar className="text-emerald-700" />} label="Project Award Date" value={p.created_at ? new Date(p.created_at).toLocaleDateString() : "Awarded"} />
              <StatCard icon={<Clock className="text-amber-700" />} label="Target Completion Deadline" value={p.deadline ? new Date(p.deadline).toLocaleDateString() : "Target Set"} />
              <StatCard icon={<CheckCircle2 className="text-indigo-700" />} label="Schedule Status" value="On Schedule" />
            </div>

            <div className="card p-6 bg-white border border-slate-200 rounded-xl shadow-sm space-y-5 text-slate-900">
              <h3 className="font-extrabold text-base text-slate-950 border-b border-slate-200 pb-3 flex items-center gap-2">
                <Calendar size={18} className="text-indigo-700" /> 4 & 8. Schedule & Key Milestones Timeline
              </h3>

              <div className="relative border-l-2 border-slate-300 ml-4 space-y-8 py-2">
                {milestones.map((m, idx) => (
                  <div key={idx} className="relative pl-8">
                    <div className={`absolute -left-3 top-0.5 w-6 h-6 rounded-full flex items-center justify-center text-xs font-extrabold ${m.status === "completed" ? "bg-emerald-600 text-white shadow-sm" : m.status === "in_progress" ? "bg-amber-500 text-white animate-pulse" : "bg-slate-200 text-slate-700 border border-slate-300"}`}>
                      {idx + 1}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-sm text-slate-950">{m.title}</span>
                      <span className="font-mono text-xs font-bold text-slate-700">{m.date}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Drawings & Parts Tab */}
        {activeTab === "drawings" && (
          <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card p-6 bg-white border border-slate-200 rounded-xl shadow-sm text-slate-900">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
                <h3 className="font-extrabold text-base text-slate-950 flex items-center gap-2"><Compass size={18} className="text-indigo-700" /> 5. Drawings Log ({drawings.data?.length ?? 0})</h3>
                <span className="text-xs text-slate-800 font-mono font-bold">Ref: {p.drawing_set_ref || "REV-0"}</span>
              </div>
              <div className="tbl-wrap">
                <table className="w-full text-slate-900">
                  <thead><tr className="border-b border-slate-200"><th className="text-slate-900 font-extrabold text-xs">Drawing #</th><th className="text-slate-900 font-extrabold text-xs">Rev</th><th className="text-slate-900 font-extrabold text-xs">Status</th></tr></thead>
                  <tbody>
                    {(drawings.data ?? []).map((d) => (
                      <tr key={d.id} className="border-b border-slate-100">
                        <td className="td-mono font-extrabold text-slate-950 text-xs">{d.drawing_number}</td>
                        <td className="td-mono text-slate-800 text-xs font-bold">{d.revision}</td>
                        <td><StatusPill status={d.status} /></td>
                      </tr>
                    ))}
                    {(!drawings.data || drawings.data.length === 0) && (
                      <tr><td colSpan={3} className="text-center py-6 text-xs text-slate-600 font-bold">No drawings logged yet. Upload drawing sets in Drawing Log module.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card p-6 bg-white border border-slate-200 rounded-xl shadow-sm text-slate-900">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
                <h3 className="font-extrabold text-base text-slate-950 flex items-center gap-2"><Layers size={18} className="text-indigo-700" /> Parts Manifest ({parts.data?.length ?? 0})</h3>
              </div>
              <div className="tbl-wrap">
                <table className="w-full text-slate-900">
                  <thead><tr className="border-b border-slate-200"><th className="text-slate-900 font-extrabold text-xs">Mark</th><th className="text-slate-900 font-extrabold text-xs">Profile</th><th className="text-slate-900 font-extrabold text-xs">Qty</th><th className="text-slate-900 font-extrabold text-xs">Status</th></tr></thead>
                  <tbody>
                    {(parts.data ?? []).slice(0, 10).map((x) => (
                      <tr key={x.id} className="border-b border-slate-100">
                        <td className="td-mono font-extrabold text-slate-950 text-xs">{x.part_mark}</td>
                        <td className="text-xs text-slate-800 font-bold">{x.profile}</td>
                        <td className="td-mono text-slate-900 font-bold text-xs">{x.quantity}</td>
                        <td><StatusPill status={x.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Communication & Notes Tab */}
        {activeTab === "communication" && (
          <div className="w-full space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="card p-6 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4 text-slate-900">
                <h3 className="font-extrabold text-base text-slate-950 border-b border-slate-200 pb-3 flex items-center gap-2">
                  <MessageSquare size={18} className="text-indigo-700" /> 6. Communication & Project Notes
                </h3>
                <p className="text-xs text-slate-800 font-semibold leading-relaxed break-words">
                  {p.description || "Project created and awarded from Estimation module. All shop communications, RFIs, and submittals are linked to this job."}
                </p>
              </div>

              <div className="card p-6 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4 text-slate-900">
                <h3 className="font-extrabold text-base text-slate-950 border-b border-slate-200 pb-3 flex items-center gap-2">
                  <FileText size={18} className="text-emerald-700" /> Approved Change Orders ({cos.data?.length ?? 0})
                </h3>
                <div className="tbl-wrap">
                  <table className="w-full text-slate-900">
                    <thead><tr className="border-b border-slate-200"><th className="text-slate-900 font-extrabold text-xs">CO #</th><th className="text-slate-900 font-extrabold text-xs">Description</th><th className="text-slate-900 font-extrabold text-xs">Amount</th><th className="text-slate-900 font-extrabold text-xs">Status</th></tr></thead>
                    <tbody>
                      {(cos.data ?? []).map((c) => (
                        <tr key={c.id} className="border-b border-slate-100">
                          <td className="td-mono font-extrabold text-slate-950 text-xs">{c.co_number}</td>
                          <td className="text-slate-800 text-xs font-semibold">{c.description}</td>
                          <td className="td-mono text-emerald-800 font-bold text-xs">${Number(c.amount).toLocaleString()}</td>
                          <td><StatusPill status={c.status} /></td>
                        </tr>
                      ))}
                      {(!cos.data || cos.data.length === 0) && (
                        <tr><td colSpan={4} className="text-center py-6 text-xs text-slate-600 font-bold">No change orders registered.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Project Modal */}
        {showEdit && (
          <EditProjectModal
            project={p}
            onClose={() => setShowEdit(false)}
            onSubmit={async (payload) => {
              await update.mutateAsync({ id: p.id, body: payload });
              project.refetch();
              if (payload.name || payload.number !== undefined) {
                selectProject(p.id, (payload.name as string) ?? p.name, (payload.number as string | null) ?? p.number);
              }
              setShowEdit(false);
            }}
            submitting={update.isPending}
            error={update.error?.message ?? null}
          />
        )}
      </div>
    </PageWrapper>
  );
}

function TabButton({ id, label, icon, active, onClick }: { id: string; label: string; icon: React.ReactNode; active: string; onClick: (id: any) => void }) {
  const isSelected = active === id;
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-lg transition-all shadow-sm ${isSelected ? "bg-indigo-700 text-white" : "bg-white text-slate-900 border border-slate-300 hover:bg-slate-100"}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="card p-4 flex items-center gap-4 bg-white border border-slate-200 rounded-xl shadow-sm text-slate-900">
      <div className="p-3 rounded-lg bg-slate-100 border border-slate-200">{icon}</div>
      <div className="space-y-0.5">
        <div className="text-[11px] uppercase font-extrabold text-slate-700 tracking-wider">{label}</div>
        <div className="text-base font-extrabold text-slate-950 font-mono">{value}</div>
      </div>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
      <span className="text-slate-700 font-bold">{label}:</span>
      <span className="font-extrabold text-slate-950 font-mono break-words text-right max-w-[60%]">{value}</span>
    </div>
  );
}

function BudgetRow({ label, amount, bold, highlighted }: { label: string; amount: number; bold?: boolean; highlighted?: boolean }) {
  return (
    <div className={`flex items-center justify-between text-xs py-2 border-b border-slate-100 ${highlighted ? "text-emerald-800 font-extrabold bg-emerald-50 px-2 rounded" : bold ? "text-slate-950 font-extrabold" : "text-slate-800 font-semibold"}`}>
      <span>{label}</span>
      <span className="font-mono font-extrabold">{formatCurrency(amount)}</span>
    </div>
  );
}

function EditProjectModal({
  project, onClose, onSubmit, submitting, error,
}: {
  project: Project;
  onClose: () => void;
  onSubmit: (payload: Record<string, unknown>) => void;
  submitting: boolean;
  error: string | null;
}) {
  const [form, setForm] = useState({
    name: project.name,
    number: project.number ?? "",
    gc_name: project.gc_name ?? "",
    contract_value: project.contract_value != null ? String(project.contract_value) : "",
    est_tonnage: project.est_tonnage != null ? String(project.est_tonnage) : "",
    status: project.status,
    start_date: project.start_date ?? "",
    deadline: project.deadline ?? "",
    description: project.description ?? "",
    color: project.color ?? "#4F46E5",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm" onClick={onClose}>
      <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-2xl text-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="card-header border-b border-slate-200 p-4">
          <h3 className="card-title font-extrabold text-sm text-slate-950">Edit Project Details</h3>
        </div>
        <form
          className="p-5 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({
              name: form.name,
              number: form.number || undefined,
              gc_name: form.gc_name || undefined,
              contract_value: form.contract_value ? Number(form.contract_value) : undefined,
              est_tonnage: form.est_tonnage ? Number(form.est_tonnage) : undefined,
              status: form.status,
              start_date: form.start_date || undefined,
              deadline: form.deadline || undefined,
              description: form.description || undefined,
              color: form.color || undefined,
            });
          }}
        >
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase font-bold text-slate-700">Project Name *</span>
            <input className="input text-xs font-bold text-slate-950 bg-white border-slate-300" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase font-bold text-slate-700">Project Number</span>
              <input className="input text-xs font-bold text-slate-950 bg-white border-slate-300" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} placeholder="PRJ-2026-NNN" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase font-bold text-slate-700">Status</span>
              <select className="input text-xs font-bold text-slate-950 bg-white border-slate-300" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="active">Active</option>
                <option value="awarded_setup">Awarded Setup</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
                <option value="archived">Archived</option>
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase font-bold text-slate-700">General Contractor</span>
            <input className="input text-xs font-bold text-slate-950 bg-white border-slate-300" value={form.gc_name} onChange={(e) => setForm({ ...form, gc_name: e.target.value })} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase font-bold text-slate-700">Contract Value ($)</span>
              <input className="input text-xs font-bold text-slate-950 bg-white border-slate-300" type="number" step="0.01" value={form.contract_value} onChange={(e) => setForm({ ...form, contract_value: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase font-bold text-slate-700">Est. Tonnage</span>
              <input className="input text-xs font-bold text-slate-950 bg-white border-slate-300" type="number" step="0.01" value={form.est_tonnage} onChange={(e) => setForm({ ...form, est_tonnage: e.target.value })} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase font-bold text-slate-700">Start Date</span>
              <input className="input text-xs font-bold text-slate-950 bg-white border-slate-300" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] uppercase font-bold text-slate-700">Deadline</span>
              <input className="input text-xs font-bold text-slate-950 bg-white border-slate-300" type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase font-bold text-slate-700">Description / Scope Notes</span>
            <textarea className="input text-xs font-bold text-slate-950 bg-white border-slate-300" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>

          {error && <div className="pill pill-red text-xs">{error}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn text-xs font-bold text-slate-700">Cancel</button>
            <button type="submit" disabled={submitting || !form.name.trim()} className="btn btn-primary text-xs font-bold bg-indigo-700 border-indigo-700 text-white">
              {submitting ? <Loader2 size={13} className="animate-spin" /> : null}
              {submitting ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
