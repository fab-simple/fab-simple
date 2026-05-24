"use client";

import { useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ResourceModal, Field } from "@/components/ui/ResourceModal";
import { useResourceList, useCreate, useOrganization } from "@/hooks/useResource";
import { Plus, FileDown } from "lucide-react";
import { generateAiaG702, type BillingApp } from "@/lib/pdf";

interface Bill {
  id: string; application_number: number; period_to: string;
  original_contract: number; change_orders_total: number; completed_to_date: number;
  materials_stored: number; retainage_percent: number; retainage_withheld: number;
  previous_billed: number; amount_due: number; pct_complete: number;
  status: string; project_id: string;
}
interface Project { id: string; name: string; number?: string; gc_name?: string | null; }

const STATUSES = ["draft", "submitted", "certified", "paid"];

export default function BillingPage() {
  const projects = useResourceList<Project>("projects", { limit: "100" });
  const org = useOrganization();
  const [projectId, setProjectId] = useState<string>("");
  const project = projectId || projects.data?.[0]?.id;
  const projectRow = projects.data?.find((p) => p.id === project);
  const list = useResourceList<Bill>("billing_applications", project ? { project_id: project, order_by: "application_number", dir: "asc" } : undefined);
  const create = useCreate<Bill>("billing_applications");
  const [showNew, setShowNew] = useState(false);

  const projectName = projectRow?.name ?? "";
  const projectNumber = projectRow?.number ?? project ?? "";
  const gcName = projectRow?.gc_name ?? "—";
  // Legal entity name lives on the org profile; fall back to the display
  // name only if the owner hasn't set a legal_name yet.
  const contractorName = org.data?.legal_name ?? org.data?.name ?? "—";

  function downloadPdf(bill: Bill) {
    const data: BillingApp = {
      application_number: bill.application_number,
      application_date: new Date().toISOString(),
      period_from: bill.period_to,
      period_to: bill.period_to,
      contract_sum: Number(bill.original_contract),
      net_change_by_co: Number(bill.change_orders_total),
      contract_sum_to_date: Number(bill.original_contract) + Number(bill.change_orders_total),
      total_completed_stored: Number(bill.completed_to_date) + Number(bill.materials_stored),
      retainage_pct: Number(bill.retainage_percent),
      retainage: Number(bill.retainage_withheld),
      total_earned_less_retainage: Number(bill.completed_to_date) - Number(bill.retainage_withheld),
      less_previous: Number(bill.previous_billed),
      current_payment_due: Number(bill.amount_due),
      project_name: projectName,
      project_number: projectNumber,
      gc_name: gcName,
      contractor_name: contractorName,
      lines: [],
    };
    const doc = generateAiaG702(data);
    doc.save(`AIA-G702-${projectName.replace(/\s+/g, "-")}-App${bill.application_number}.pdf`);
  }

  const cols: Column<Bill>[] = [
    { key: "app", label: "App #", mono: true, render: (r) => <strong>App {r.application_number}</strong> },
    { key: "period", label: "Period ending", render: (r) => new Date(r.period_to).toLocaleDateString() },
    { key: "orig", label: "Original contract", align: "right", mono: true, render: (r) => `$${Number(r.original_contract).toLocaleString()}` },
    { key: "co", label: "Change orders", align: "right", mono: true, render: (r) => `$${Number(r.change_orders_total).toLocaleString()}` },
    { key: "comp", label: "Completed to date", align: "right", mono: true, render: (r) => `$${Number(r.completed_to_date).toLocaleString()}` },
    { key: "ret", label: "Retainage", align: "right", mono: true, render: (r) => `$${Number(r.retainage_withheld).toLocaleString()} (${r.retainage_percent}%)` },
    { key: "pct", label: "% complete", align: "right", mono: true, render: (r) => `${r.pct_complete}%` },
    { key: "due", label: "Amount due", align: "right", mono: true, render: (r) => <strong>${Number(r.amount_due).toLocaleString()}</strong> },
    { key: "status", label: "Status", render: (r) => <StatusPill status={r.status} /> },
    { key: "pdf", label: "", render: (r) => (
      <button className="btn btn-sm" onClick={() => downloadPdf(r)} title="Download AIA G702/G703 PDF">
        <FileDown size={12} /> PDF
      </button>
    ) },
  ];

  return (
    <PageWrapper title="AIA G702 Billing">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[20px] font-bold" style={{ color: "var(--text)" }}>AIA G702/G703 Billing</div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>Pay applications by period with retainage and stored materials</div>
        </div>
        <div className="flex items-center gap-2">
          <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)} style={{ height: 32, width: 240 }}>
            <option value="">{projects.data?.[0]?.name ?? "Select project"}</option>
            {projects.data?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className="btn btn-primary" onClick={() => setShowNew(true)} disabled={!project}><Plus size={14} /> New application</button>
        </div>
      </div>

      <DataTable data={list.data} columns={cols} loading={list.isLoading} error={list.error}
        empty={{ title: "No applications yet" }} rowKey={(r) => r.id} />

      {showNew && project && (
        <NewModal projectId={project} onClose={() => setShowNew(false)}
          onSubmit={(p) => create.mutate(p, { onSuccess: () => setShowNew(false) })}
          submitting={create.isPending} error={create.error?.message ?? null}
        />
      )}
    </PageWrapper>
  );
}

function NewModal({ projectId, onClose, onSubmit, submitting, error }: {
  projectId: string; onClose: () => void;
  onSubmit: (p: Record<string, unknown>) => void; submitting: boolean; error: string | null;
}) {
  const [f, setF] = useState({
    application_number: "1", period_to: new Date().toISOString().slice(0, 10),
    original_contract: "", change_orders_total: "0",
    completed_to_date: "0", materials_stored: "0",
    retainage_percent: "10", pct_complete: "0",
  });
  return (
    <ResourceModal title="New pay application" onClose={onClose} submitting={submitting} error={error}
      onSubmit={(e) => { e.preventDefault();
        const orig = Number(f.original_contract || 0);
        const co = Number(f.change_orders_total || 0);
        const comp = Number(f.completed_to_date || 0);
        const ret = (comp * Number(f.retainage_percent || 0)) / 100;
        const due = comp - ret;
        onSubmit({
          project_id: projectId,
          application_number: Number(f.application_number),
          period_to: f.period_to,
          original_contract: orig,
          change_orders_total: co,
          completed_to_date: comp,
          materials_stored: Number(f.materials_stored || 0),
          retainage_percent: Number(f.retainage_percent || 10),
          retainage_withheld: ret,
          previous_billed: 0,
          amount_due: due,
          pct_complete: Number(f.pct_complete || 0),
          status: "draft",
        });
      }}
    >
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Application #" required><input className="input" type="number" min="1" required value={f.application_number} onChange={(e) => setF({ ...f, application_number: e.target.value })} /></Field>
        <Field label="Period ending" required><input className="input" type="date" required value={f.period_to} onChange={(e) => setF({ ...f, period_to: e.target.value })} /></Field>
      </div>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Original contract ($)" required><input className="input" type="number" step="0.01" required value={f.original_contract} onChange={(e) => setF({ ...f, original_contract: e.target.value })} /></Field>
        <Field label="Change orders total ($)"><input className="input" type="number" step="0.01" value={f.change_orders_total} onChange={(e) => setF({ ...f, change_orders_total: e.target.value })} /></Field>
      </div>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Completed to date ($)"><input className="input" type="number" step="0.01" value={f.completed_to_date} onChange={(e) => setF({ ...f, completed_to_date: e.target.value })} /></Field>
        <Field label="Materials stored ($)"><input className="input" type="number" step="0.01" value={f.materials_stored} onChange={(e) => setF({ ...f, materials_stored: e.target.value })} /></Field>
      </div>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Retainage %"><input className="input" type="number" step="0.01" min="0" max="100" value={f.retainage_percent} onChange={(e) => setF({ ...f, retainage_percent: e.target.value })} /></Field>
        <Field label="% complete" required><input className="input" type="number" step="0.01" min="0" max="100" required value={f.pct_complete} onChange={(e) => setF({ ...f, pct_complete: e.target.value })} /></Field>
      </div>
    </ResourceModal>
  );
}
