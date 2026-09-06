"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { useResourceList } from "@/hooks/useResource";
import { Plus } from "lucide-react";
import { NewRfqModal } from "@/components/rfqs/NewRfqModal";

interface Rfq {
  id: string;
  rfq_number: string;
  status: string;
  delivery_requirement: string | null;
  created_at: string;
}

interface RfqVendorRow {
  id: string;
  rfq_id: string;
  vendor_id: string;
}

// RFQ is the one page in Procurement that's deliberately NOT gated by the
// Global Project Context (spec §15.1 D14) — its entire purpose is letting a
// PM shop requirements from several projects to the same vendor in one ask.
export default function RfqsPage() {
  const router = useRouter();
  const list = useResourceList<Rfq>("rfqs", { order_by: "created_at", dir: "desc" });
  const rfqVendors = useResourceList<RfqVendorRow>("rfq_vendors", { limit: "500" });
  const [showNew, setShowNew] = useState(false);

  const vendorCountByRfq = new Map<string, number>();
  for (const rv of rfqVendors.data ?? []) {
    vendorCountByRfq.set(rv.rfq_id, (vendorCountByRfq.get(rv.rfq_id) ?? 0) + 1);
  }

  const cols: Column<Rfq>[] = [
    { key: "num", label: "RFQ #", mono: true, render: (r) => <strong>{r.rfq_number}</strong> },
    { key: "delivery", label: "Delivery requirement", render: (r) => r.delivery_requirement ?? "—" },
    { key: "vendors", label: "Vendors invited", align: "right", mono: true, render: (r) => vendorCountByRfq.get(r.id) ?? 0 },
    { key: "created", label: "Created", render: (r) => new Date(r.created_at).toLocaleDateString() },
    { key: "status", label: "Status", render: (r) => <StatusPill status={r.status} /> },
  ];

  return (
    <PageWrapper title="RFQs">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[20px] font-bold" style={{ color: "var(--text)" }}>RFQs</div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>
            {list.data?.length ?? 0} RFQs, company-wide · shop Material Requirements from any project to one or more vendors
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowNew(true)}>
          <Plus size={14} /> New RFQ
        </button>
      </div>

      <DataTable
        data={list.data}
        columns={cols}
        loading={list.isLoading}
        error={list.error}
        empty={{
          title: "No RFQs yet",
          subtitle: "Raise Material Requirements on a project, then bundle them here to shop to vendors.",
        }}
        rowKey={(r) => r.id}
        onRowClick={(r) => router.push(`/dashboard/rfqs/${r.id}`)}
      />

      {showNew && (
        <NewRfqModal
          onClose={() => setShowNew(false)}
          onSuccess={(rfqId) => {
            setShowNew(false);
            router.push(`/dashboard/rfqs/${rfqId}`);
          }}
        />
      )}
    </PageWrapper>
  );
}
