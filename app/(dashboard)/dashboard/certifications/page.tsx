"use client";

import { useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ResourceModal, Field } from "@/components/ui/ResourceModal";
import { useResourceList, useCreate } from "@/hooks/useResource";
import { Plus, AlertTriangle, CheckCircle2 } from "lucide-react";

interface Cert {
  id: string; cert_type: string; holder_name: string; cert_number: string | null;
  issue_date: string | null; expiry_date: string; alert_days: number; status: string;
}

function daysUntil(date: string) {
  return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export default function CertificationsPage() {
  const list = useResourceList<Cert>("certifications", { order_by: "expiry_date", dir: "asc" });
  const create = useCreate<Cert>("certifications");
  const [showNew, setShowNew] = useState(false);

  const cols: Column<Cert>[] = [
    { key: "type", label: "Cert Type", render: (r) => <strong>{r.cert_type}</strong> },
    { key: "holder", label: "Holder", render: (r) => r.holder_name },
    { key: "num", label: "Cert #", mono: true, render: (r) => r.cert_number ?? "—" },
    { key: "issue", label: "Issued", render: (r) => r.issue_date ? new Date(r.issue_date).toLocaleDateString() : "—" },
    { key: "expiry", label: "Expires", render: (r) => new Date(r.expiry_date).toLocaleDateString() },
    {
      key: "days", label: "Until expiry", align: "right", mono: true, render: (r) => {
        const d = daysUntil(r.expiry_date);
        const cls = d < 0 ? "#DC2626" : d < r.alert_days ? "#D97706" : "#16A34A";
        return <span style={{ color: cls, fontWeight: 700 }}>{d < 0 ? `EXPIRED ${Math.abs(d)}d ago` : `${d} d`}</span>;
      }
    },
    {
      key: "status", label: "Status", render: (r) => {
        const d = daysUntil(r.expiry_date);
        if (d < 0) return <span className="pill pill-red" style={{ padding: "2px 8px" }}>Expired</span>;
        if (d < r.alert_days) return <span className="pill pill-warn" style={{ padding: "2px 8px" }}><AlertTriangle size={10} /> Expiring</span>;
        return <span className="pill pill-done" style={{ padding: "2px 8px" }}><CheckCircle2 size={10} /> Active</span>;
      }
    },
  ];

  return (
    <PageWrapper title="Certifications">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[20px] font-bold" style={{ color: "var(--text)" }}>Certifications & Credentials</div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>Tracks CWI, welder, crane operator, AISC fab shop certs</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}><Plus size={14} /> New cert</button>
      </div>

      <DataTable
        data={list.data} columns={cols} loading={list.isLoading} error={list.error}
        empty={{ title: "No certifications tracked yet" }}
        rowKey={(r) => r.id}
      />

      {showNew && (
        <NewModal
          onClose={() => setShowNew(false)}
          onSubmit={(p) => create.mutate(p, { onSuccess: () => setShowNew(false) })}
          submitting={create.isPending} error={create.error?.message ?? null}
        />
      )}
    </PageWrapper>
  );
}

function NewModal({ onClose, onSubmit, submitting, error }: {
  onClose: () => void; onSubmit: (p: Record<string, unknown>) => void; submitting: boolean; error: string | null;
}) {
  const [f, setF] = useState({
    cert_type: "", holder_name: "", cert_number: "",
    issue_date: "", expiry_date: "", alert_days: "30",
  });
  return (
    <ResourceModal title="New certification" onClose={onClose} submitting={submitting} error={error}
      onSubmit={(e) => { e.preventDefault();
        onSubmit({
          cert_type: f.cert_type,
          holder_name: f.holder_name,
          cert_number: f.cert_number || undefined,
          issue_date: f.issue_date || undefined,
          expiry_date: f.expiry_date,
          alert_days: Number(f.alert_days || 30),
        });
      }}
    >
      <Field label="Cert type" required>
        <input className="input" required value={f.cert_type} onChange={(e) => setF({ ...f, cert_type: e.target.value })} placeholder="CWI / AWS D1.1 Welder / Crane Operator" />
      </Field>
      <Field label="Holder name" required>
        <input className="input" required value={f.holder_name} onChange={(e) => setF({ ...f, holder_name: e.target.value })} />
      </Field>
      <Field label="Cert #">
        <input className="input" value={f.cert_number} onChange={(e) => setF({ ...f, cert_number: e.target.value })} />
      </Field>
      <div className="grid-3" style={{ gap: 12 }}>
        <Field label="Issue date">
          <input className="input" type="date" value={f.issue_date} onChange={(e) => setF({ ...f, issue_date: e.target.value })} />
        </Field>
        <Field label="Expiry" required>
          <input className="input" type="date" required value={f.expiry_date} onChange={(e) => setF({ ...f, expiry_date: e.target.value })} />
        </Field>
        <Field label="Alert (days)">
          <input className="input" type="number" min="1" value={f.alert_days} onChange={(e) => setF({ ...f, alert_days: e.target.value })} />
        </Field>
      </div>
    </ResourceModal>
  );
}
