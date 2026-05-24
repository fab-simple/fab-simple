"use client";

import { useState } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { AttachmentsDrawer } from "@/components/ui/AttachmentsDrawer";
import { useResourceList, useUpdate } from "@/hooks/useResource";
import { PackageCheck, Loader2, Paperclip } from "lucide-react";

interface PO {
  id: string; po_number: string; vendor: string; status: string;
  qty_ordered: number | null; qty_received: number; total_amount: number;
  expected_date: string | null;
}

export default function ReceivingPage() {
  const list = useResourceList<PO>("purchase_orders", { status__in: "issued,partial", order_by: "expected_date", dir: "asc", limit: "100" });
  const update = useUpdate<PO>("purchase_orders");
  const [attachTarget, setAttachTarget] = useState<PO | null>(null);

  const cols: Column<PO>[] = [
    { key: "num", label: "PO #", mono: true, render: (r) => <strong>{r.po_number}</strong> },
    { key: "vendor", label: "Vendor", render: (r) => r.vendor },
    { key: "expected", label: "Expected", render: (r) => r.expected_date ? new Date(r.expected_date).toLocaleDateString() : "—" },
    { key: "ord", label: "Ordered", align: "right", mono: true, render: (r) => r.qty_ordered ?? "—" },
    { key: "rcv", label: "Received", align: "right", mono: true, render: (r) => r.qty_received },
    { key: "status", label: "Status", render: (r) => <StatusPill status={r.status} /> },
    {
      key: "action", label: "Receive", render: (r) => (
        <div className="flex items-center gap-1">
          <button
            className="btn btn-sm btn-primary"
            disabled={update.isPending}
            onClick={() => {
              const next = Number(r.qty_received ?? 0) + Number(r.qty_ordered ?? 1);
              const isComplete = r.qty_ordered ? next >= Number(r.qty_ordered) : false;
              update.mutate({ id: r.id, body: { qty_received: next, status: isComplete ? "received" : "partial" } });
            }}
          >
            {update.isPending && update.variables?.id === r.id ? <Loader2 size={12} className="animate-spin" /> : <PackageCheck size={12} />}
            Receive
          </button>
          <button className="btn btn-sm" title="Attach BOL / MTR" onClick={() => setAttachTarget(r)}>
            <Paperclip size={12} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <PageWrapper title="Material Receiving">
      <div className="mb-6">
        <div className="text-[20px] font-bold" style={{ color: "var(--text)" }}>Material Receiving</div>
        <div className="text-[12px]" style={{ color: "var(--muted)" }}>
          {list.data?.length ?? 0} open POs awaiting material
        </div>
      </div>

      <DataTable
        data={list.data} columns={cols} loading={list.isLoading} error={list.error}
        empty={{ title: "Nothing to receive", subtitle: "All purchase orders are either drafted or fully closed." }}
        rowKey={(r) => r.id}
      />

      <AttachmentsDrawer
        open={!!attachTarget}
        onClose={() => setAttachTarget(null)}
        entityType="purchase_orders"
        entityId={attachTarget?.id ?? ""}
        bucket="mtrs"
        title={`BOL / MTR — ${attachTarget?.po_number ?? ""}`}
        subtitle={attachTarget?.vendor}
        accept=".pdf,application/pdf,image/*"
      />
    </PageWrapper>
  );
}
