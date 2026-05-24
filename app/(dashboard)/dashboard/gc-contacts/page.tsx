"use client";

import { useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ResourceModal, Field } from "@/components/ui/ResourceModal";
import { useResourceList, useCreate } from "@/hooks/useResource";
import { Plus, Phone, Mail } from "lucide-react";

interface Contact {
  id: string; gc_company: string; contact_name: string; role: string | null;
  email: string | null; phone: string | null; last_contact: string | null;
  project_id: string | null;
}
interface Project { id: string; name: string; }

export default function GcContactsPage() {
  const list = useResourceList<Contact>("gc_contacts", { order_by: "gc_company", dir: "asc" });
  const projects = useResourceList<Project>("projects", { limit: "100" });
  const create = useCreate<Contact>("gc_contacts");
  const [showNew, setShowNew] = useState(false);

  const cols: Column<Contact>[] = [
    { key: "co", label: "Company", render: (r) => <strong>{r.gc_company}</strong> },
    { key: "name", label: "Contact", render: (r) => r.contact_name },
    { key: "role", label: "Role", render: (r) => r.role ?? "—" },
    { key: "email", label: "Email", render: (r) => r.email ? <a href={`mailto:${r.email}`} style={{ color: "var(--primary)" }}><Mail size={11} style={{ display: "inline" }} /> {r.email}</a> : "—" },
    { key: "phone", label: "Phone", mono: true, render: (r) => r.phone ? <span><Phone size={11} style={{ display: "inline", marginRight: 4 }} />{r.phone}</span> : "—" },
    { key: "last", label: "Last contact", render: (r) => r.last_contact ? new Date(r.last_contact).toLocaleDateString() : "—" },
  ];

  return (
    <PageWrapper title="GC Contacts">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[20px] font-bold" style={{ color: "var(--text)" }}>GC Contacts</div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>{list.data?.length ?? 0} contacts</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}><Plus size={14} /> Add contact</button>
      </div>

      <DataTable data={list.data} columns={cols} loading={list.isLoading} error={list.error}
        empty={{ title: "No GC contacts yet" }} rowKey={(r) => r.id} />

      {showNew && (
        <NewModal projects={projects.data ?? []} onClose={() => setShowNew(false)}
          onSubmit={(p) => create.mutate(p, { onSuccess: () => setShowNew(false) })}
          submitting={create.isPending} error={create.error?.message ?? null}
        />
      )}
    </PageWrapper>
  );
}

function NewModal({ projects, onClose, onSubmit, submitting, error }: {
  projects: Project[]; onClose: () => void;
  onSubmit: (p: Record<string, unknown>) => void; submitting: boolean; error: string | null;
}) {
  const [f, setF] = useState({ project_id: "", gc_company: "", contact_name: "", role: "", email: "", phone: "", notes: "" });
  return (
    <ResourceModal title="New GC contact" onClose={onClose} submitting={submitting} error={error}
      onSubmit={(e) => { e.preventDefault();
        onSubmit({
          project_id: f.project_id || undefined,
          gc_company: f.gc_company, contact_name: f.contact_name,
          role: f.role || undefined, email: f.email || undefined,
          phone: f.phone || undefined, notes: f.notes || undefined,
        });
      }}
    >
      <Field label="Project">
        <select className="input" value={f.project_id} onChange={(e) => setF({ ...f, project_id: e.target.value })}>
          <option value="">—</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </Field>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="GC company" required><input className="input" required value={f.gc_company} onChange={(e) => setF({ ...f, gc_company: e.target.value })} /></Field>
        <Field label="Contact name" required><input className="input" required value={f.contact_name} onChange={(e) => setF({ ...f, contact_name: e.target.value })} /></Field>
      </div>
      <Field label="Role"><input className="input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} placeholder="Project Manager" /></Field>
      <div className="grid-2" style={{ gap: 12 }}>
        <Field label="Email"><input className="input" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        <Field label="Phone"><input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
      </div>
      <Field label="Notes"><textarea className="input" rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} style={{ height: "auto", padding: "8px 12px", resize: "vertical" }} /></Field>
    </ResourceModal>
  );
}
