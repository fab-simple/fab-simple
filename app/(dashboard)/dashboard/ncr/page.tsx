"use client";

import { useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { AttachmentsDrawer } from "@/components/ui/AttachmentsDrawer";
import { useResourceList, useUpdate } from "@/hooks/useResource";
import { useGlobalProject } from "@/hooks/useGlobalProject";
import { Paperclip, CheckCircle2 } from "lucide-react";

interface NCR {
  id: string;
  ncr_number: string;
  description: string | null;
  root_cause: string | null;
  status: string;
  severity: string | null;
  closed_at: string | null;
  created_at: string;
  project_id: string | null;
  inspector_id: string | null;
}

export default function NCRPage() {
  const { selectedProjectId } = useGlobalProject();
  const listQuery = selectedProjectId
    ? { order_by: "created_at", dir: "desc", project_id: selectedProjectId }
    : { order_by: "created_at", dir: "desc" };
  const list = useResourceList<NCR>("ncr_reports", listQuery);
  const update = useUpdate<NCR>("ncr_reports");
  const [attachTarget, setAttachTarget] = useState<NCR | null>(null);

  function closeNCR(n: NCR) {
    const reason = prompt("Closure note / corrective action?");
    if (reason === null) return;
    update.mutate({ id: n.id, body: { status: "closed", closed_at: new Date().toISOString(), root_cause: n.root_cause ?? reason } });
  }

  const open = (list.data ?? []).filter((n) => n.status === "open").length;

  const cols: Column<NCR>[] = [
    { key: "num", label: "NCR #", mono: true, render: (r) => <strong>{r.ncr_number}</strong> },
    { key: "desc", label: "Description", render: (r) => <span style={{ maxWidth: 380, display: "inline-block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.description ?? "—"}</span> },
    { key: "severity", label: "Severity", render: (r) => r.severity ?? "—" },
    { key: "opened", label: "Opened", render: (r) => new Date(r.created_at).toLocaleDateString() },
    { key: "status", label: "Status", render: (r) => <StatusPill status={r.status} /> },
    { key: "actions", label: "", render: (r) => (
      <div className="flex items-center gap-1">
        <button title="Attach photo / RCA" className="btn btn-sm" onClick={() => setAttachTarget(r)}>
          <Paperclip size={12} />
        </button>
        {r.status !== "closed" && (
          <button title="Close NCR" className="btn btn-sm" onClick={() => closeNCR(r)} disabled={update.isPending}>
            <CheckCircle2 size={12} /> Close
          </button>
        )}
      </div>
    ) },
  ];

  return (
    <PageWrapper title="NCR Reports">
      <div className="mb-6">
        <div className="text-[20px] font-bold" style={{ color: "var(--text)" }}>Non-Conformance Reports</div>
        <div className="text-[12px]" style={{ color: "var(--muted)" }}>
          {open} open · {list.data?.length ?? 0} total · auto-opened from failed inspections
        </div>
      </div>

      <DataTable data={list.data} columns={cols} loading={list.isLoading} error={list.error}
        empty={{ title: "No NCRs", subtitle: "Inspections that fail automatically open an NCR here." }}
        rowKey={(r) => r.id} />

      <AttachmentsDrawer
        open={!!attachTarget}
        onClose={() => setAttachTarget(null)}
        entityType="ncr_reports"
        entityId={attachTarget?.id ?? ""}
        bucket="photos"
        title={`${attachTarget?.ncr_number ?? ""}`}
        subtitle={attachTarget?.description ?? undefined}
        accept="image/*,.pdf"
      />
    </PageWrapper>
  );
}
