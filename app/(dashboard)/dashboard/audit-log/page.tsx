"use client";

import { useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { useResourceList } from "@/hooks/useResource";

interface AuditRow {
  id: string; action: string; table_name: string; record_id: string | null;
  old_values: Record<string, unknown> | null; new_values: Record<string, unknown> | null;
  user_id: string | null; created_at: string; ip_address: string | null;
}

interface User { id: string; full_name: string; }

const ACTIONS = ["create", "update", "delete", "rpc", "login", "logout"];

export default function AuditLogPage() {
  const [tableFilter, setTableFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  const query: Record<string, string> = { order_by: "created_at", dir: "desc", limit: "200" };
  if (tableFilter) query["table_name"] = tableFilter;
  if (actionFilter) query["action"] = actionFilter;

  const list = useResourceList<AuditRow>("audit_log", query);
  const users = useResourceList<User>("users", { limit: "100" });
  const userMap = new Map((users.data ?? []).map((u) => [u.id, u.full_name]));

  const cols: Column<AuditRow>[] = [
    { key: "when", label: "When", mono: true, render: (r) => new Date(r.created_at).toLocaleString() },
    { key: "user", label: "User", render: (r) => r.user_id ? userMap.get(r.user_id) ?? r.user_id.slice(0, 6) : "system" },
    { key: "action", label: "Action", render: (r) => <span className="pill" style={{ padding: "2px 8px", textTransform: "capitalize" }}>{r.action}</span> },
    { key: "table", label: "Table", mono: true, render: (r) => r.table_name },
    { key: "record", label: "Record", mono: true, render: (r) => r.record_id ? r.record_id.slice(0, 8) : "—" },
    { key: "ip", label: "IP", mono: true, render: (r) => r.ip_address ?? "—" },
    { key: "diff", label: "Diff", render: (r) => <DiffPreview row={r} /> },
  ];

  // Unique table names for the filter dropdown
  const tables = Array.from(new Set((list.data ?? []).map((r) => r.table_name))).sort();

  return (
    <PageWrapper title="Audit Log">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[20px] font-bold" style={{ color: "var(--text)" }}>Audit Log</div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>
            Showing {list.data?.length ?? 0} events (most recent 200)
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select className="input" style={{ width: 140, height: 32 }} value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
            <option value="">All actions</option>
            {ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <select className="input" style={{ width: 180, height: 32 }} value={tableFilter} onChange={(e) => setTableFilter(e.target.value)}>
            <option value="">All tables</option>
            {tables.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <DataTable data={list.data} columns={cols} loading={list.isLoading} error={list.error}
        empty={{ title: "No audit events" }} rowKey={(r) => r.id} />
    </PageWrapper>
  );
}

function DiffPreview({ row }: { row: AuditRow }) {
  const [open, setOpen] = useState(false);
  const hasDiff = row.old_values || row.new_values;
  if (!hasDiff) return <span style={{ color: "var(--muted)" }}>—</span>;
  return (
    <>
      <button
        onClick={() => setOpen((s) => !s)}
        className="text-[11px]"
        style={{ background: "none", border: "none", color: "var(--primary)", cursor: "pointer", padding: 0 }}
      >
        {open ? "Hide" : "Show"}
      </button>
      {open && (
        <pre style={{
          marginTop: 6, padding: 8, background: "var(--bg-muted)", borderRadius: 4,
          fontSize: 10, maxWidth: 320, maxHeight: 220, overflow: "auto",
        }}>
          {JSON.stringify({ old: row.old_values, new: row.new_values }, null, 2)}
        </pre>
      )}
    </>
  );
}
