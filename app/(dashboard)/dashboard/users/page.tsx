"use client";

import { useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ResourceModal, Field } from "@/components/ui/ResourceModal";
import { useResourceList } from "@/hooks/useResource";
import { FabAPI, FabApiError } from "@/lib/api";
import { Plus, Loader2 } from "lucide-react";

interface User {
  id: string; full_name: string; email: string; role: string;
  phone: string | null; is_active: boolean; last_login: string | null;
  created_at: string;
}

const ROLES = ["owner", "pm", "estimator", "foreman", "qc", "accounting", "worker"];

export default function UsersPage() {
  const list = useResourceList<User>("users", { order_by: "full_name", dir: "asc" });
  const [showInvite, setShowInvite] = useState(false);

  const cols: Column<User>[] = [
    { key: "name", label: "Name", render: (r) => <strong>{r.full_name}</strong> },
    { key: "email", label: "Email", render: (r) => r.email },
    { key: "role", label: "Role", render: (r) => <span className="pill" style={{ padding: "2px 8px", textTransform: "capitalize" }}>{r.role}</span> },
    { key: "phone", label: "Phone", mono: true, render: (r) => r.phone ?? "—" },
    { key: "last", label: "Last login", render: (r) => r.last_login ? new Date(r.last_login).toLocaleDateString() : "Never" },
    { key: "active", label: "Active", render: (r) => r.is_active ? <span className="pill pill-done" style={{ padding: "2px 8px" }}>Active</span> : <span className="pill pill-warn" style={{ padding: "2px 8px" }}>Disabled</span> },
  ];

  return (
    <PageWrapper title="Users & Roles">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[20px] font-bold" style={{ color: "var(--text)" }}>Users & Roles</div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>{list.data?.length ?? 0} team members</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowInvite(true)}><Plus size={14} /> Invite user</button>
      </div>

      <DataTable data={list.data} columns={cols} loading={list.isLoading} error={list.error}
        empty={{ title: "No users yet" }} rowKey={(r) => r.id} />

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} onInvited={() => { setShowInvite(false); list.refetch(); }} />}
    </PageWrapper>
  );
}

function InviteModal({ onClose, onInvited }: { onClose: () => void; onInvited: () => void }) {
  const [f, setF] = useState({ email: "", full_name: "", role: "worker" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <ResourceModal title="Invite user" submitLabel="Send invite" onClose={onClose} submitting={busy} error={error}
      onSubmit={async (e) => {
        e.preventDefault(); setBusy(true); setError(null);
        try {
          await FabAPI.inviteUser({ email: f.email, role: f.role, full_name: f.full_name || undefined });
          onInvited();
        } catch (err) {
          if (err instanceof FabApiError) setError(err.message);
          else setError("Invite failed");
        } finally { setBusy(false); }
      }}
    >
      <Field label="Email" required><input className="input" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
      <Field label="Full name"><input className="input" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></Field>
      <Field label="Role" required>
        <select className="input" required value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </Field>
    </ResourceModal>
  );
}
