"use client";

import { useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ResourceModal, Field } from "@/components/ui/ResourceModal";
import { useResourceList, useCreate } from "@/hooks/useResource";
import { Plus, Star, Mail, Phone } from "lucide-react";

interface Vendor {
  id: string; name: string; contact_name: string | null; email: string | null;
  phone: string | null; payment_terms: string | null; status: string; preferred: boolean;
}

const STATUSES = ["active", "inactive", "blacklisted"];

export default function VendorsPage() {
  const list = useResourceList<Vendor>("vendors", { order_by: "name", dir: "asc" });
  const create = useCreate<Vendor>("vendors");
  const [showNew, setShowNew] = useState(false);

  const cols: Column<Vendor>[] = [
    {
      key: "name", label: "Vendor", render: (r) => (
        <span className="flex items-center gap-1.5">
          {r.preferred && <Star size={12} style={{ color: "#EAB308", fill: "#EAB308" }} />}
          <strong>{r.name}</strong>
        </span>
      ),
    },
    { key: "contact", label: "Contact", render: (r) => r.contact_name ?? "—" },
    { key: "email", label: "Email", render: (r) => r.email ? <a href={`mailto:${r.email}`} style={{ color: "var(--primary)" }}><Mail size={11} style={{ display: "inline" }} /> {r.email}</a> : "—" },
    { key: "phone", label: "Phone", mono: true, render: (r) => r.phone ? <span><Phone size={11} style={{ display: "inline", marginRight: 4 }} />{r.phone}</span> : "—" },
    { key: "terms", label: "Payment terms", render: (r) => r.payment_terms ?? "—" },
    { key: "status", label: "Status", render: (r) => <StatusPill status={r.status} /> },
  ];

  const activeCount = (list.data ?? []).filter((v) => v.status === "active").length;

  return (
    <PageWrapper title="Vendors">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[20px] font-bold" style={{ color: "var(--text)" }}>Vendors</div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>{list.data?.length ?? 0} vendors · {activeCount} active</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}><Plus size={14} /> New vendor</button>
      </div>

      <DataTable data={list.data} columns={cols} loading={list.isLoading} error={list.error}
        empty={{ title: "No vendors yet", subtitle: "Add a mill or supplier to start issuing purchase orders against them." }} rowKey={(r) => r.id} />

      {showNew && (
        <NewModal onClose={() => setShowNew(false)}
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
    name: "", contact_name: "", email: "", phone: "", address: "",
    payment_terms: "", status: "active", preferred: false, notes: "",
  });
  return (
    <ResourceModal title="New vendor" onClose={onClose} submitting={submitting} error={error}
      onSubmit={(e) => { e.preventDefault();
        onSubmit({
          name: f.name, contact_name: f.contact_name || undefined,
          email: f.email || undefined, phone: f.phone || undefined,
          address: f.address || undefined, payment_terms: f.payment_terms || undefined,
          status: f.status, preferred: f.preferred, notes: f.notes || undefined,
        });
      }}
    >
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Vendor name" required><input className="input" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Triple S Steel" /></Field>
        <Field label="Contact name"><input className="input" value={f.contact_name} onChange={(e) => setF({ ...f, contact_name: e.target.value })} /></Field>
      </div>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Email"><input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Phone"><input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
      </div>
      <Field label="Address"><input className="input" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></Field>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Payment terms"><input className="input" value={f.payment_terms} onChange={(e) => setF({ ...f, payment_terms: e.target.value })} placeholder="Net 30" /></Field>
        <Field label="Status">
          <select className="input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
      </div>
      <label className="flex items-center gap-2 text-[12px]" style={{ color: "var(--text)" }}>
        <input type="checkbox" checked={f.preferred} onChange={(e) => setF({ ...f, preferred: e.target.checked })} />
        Preferred vendor
      </label>
      <Field label="Notes"><textarea className="input" rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} style={{ height: "auto", padding: "8px 12px", resize: "vertical" }} /></Field>
    </ResourceModal>
  );
}
