"use client";

import { useState, useMemo } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { AttachmentsDrawer } from "@/components/ui/AttachmentsDrawer";
import { useResourceList, useUpdate } from "@/hooks/useResource";
import { useCsvExport } from "@/hooks/useCsvExport";
import { formatCurrency } from "@/lib/utils";
import { PackageCheck, Loader2, Paperclip, X } from "lucide-react";

interface PO {
  id: string;
  po_number: string;
  vendor: string;
  status: string;
  qty_ordered: number | null;
  qty_received: number;
  total_amount: number;
  expected_date: string | null;
  issued_date: string | null;
  received_date: string | null;
}

export default function ReceivingPage() {
  const list = useResourceList<PO>("purchase_orders", {
    status__in: "issued,partial",
    order_by: "expected_date",
    dir: "asc",
    limit: "100",
  });
  const update = useUpdate<PO>("purchase_orders");
  const [attachTarget, setAttachTarget] = useState<PO | null>(null);
  const [receiveTarget, setReceiveTarget] = useState<PO | null>(null);

  useCsvExport({
    filename: "open-purchase-orders",
    data: list.data,
    transform: (p) => ({
      po_number: p.po_number,
      vendor: p.vendor,
      issued_date: p.issued_date,
      expected_date: p.expected_date,
      qty_ordered: p.qty_ordered,
      qty_received: p.qty_received,
      remaining: (Number(p.qty_ordered ?? 0) - Number(p.qty_received ?? 0)),
      status: p.status,
      total_amount: p.total_amount,
    }),
  });

  const totals = useMemo(() => {
    const rows = list.data ?? [];
    const overdue = rows.filter((r) => r.expected_date && new Date(r.expected_date) < new Date()).length;
    const value = rows.reduce((s, r) => s + Number(r.total_amount ?? 0), 0);
    return { count: rows.length, overdue, value };
  }, [list.data]);

  const cols: Column<PO>[] = [
    {
      key: "num",
      label: "PO #",
      mono: true,
      sortAccessor: (r) => r.po_number,
      render: (r) => <strong>{r.po_number}</strong>,
    },
    {
      key: "vendor",
      label: "Vendor",
      sortAccessor: (r) => r.vendor,
      render: (r) => r.vendor,
    },
    {
      key: "expected",
      label: "Expected",
      sortAccessor: (r) => r.expected_date ?? "",
      render: (r) => {
        if (!r.expected_date) return "—";
        const overdue = new Date(r.expected_date) < new Date();
        return (
          <span style={{ color: overdue ? "#DC2626" : "inherit", fontWeight: overdue ? 600 : 400 }}>
            {new Date(r.expected_date).toLocaleDateString()}
          </span>
        );
      },
    },
    {
      key: "progress",
      label: "Progress",
      render: (r) => {
        const ord = Number(r.qty_ordered ?? 0);
        const rcv = Number(r.qty_received ?? 0);
        const pct = ord > 0 ? Math.min(100, Math.round((rcv / ord) * 100)) : 0;
        const fill = pct >= 100 ? "var(--green)" : "var(--primary)";
        return (
          <div style={{ minWidth: 130 }}>
            <div className="flex items-center justify-between text-[11px]" style={{ color: "var(--muted)" }}>
              <span className="font-mono">{rcv} / {ord || "?"}</span>
              <span className="font-mono">{pct}%</span>
            </div>
            <div className="pbar" style={{ marginTop: 2 }}>
              <div className="pbar-fill" style={{ width: `${pct}%`, background: fill }} />
            </div>
          </div>
        );
      },
    },
    {
      key: "amount",
      label: "Value",
      align: "right",
      mono: true,
      sortAccessor: (r) => r.total_amount,
      render: (r) => formatCurrency(r.total_amount),
    },
    {
      key: "status",
      label: "Status",
      sortAccessor: (r) => r.status,
      render: (r) => <StatusPill status={r.status} />,
    },
    {
      key: "action",
      label: "Receive",
      render: (r) => (
        <div className="flex items-center gap-1">
          <button
            className="btn btn-sm btn-primary"
            disabled={update.isPending}
            onClick={() => setReceiveTarget(r)}
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
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <div className="text-[20px] font-bold" style={{ color: "var(--text)" }}>Material Receiving</div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>
            {totals.count} open POs awaiting material
            {totals.overdue > 0 && (
              <span style={{ color: "#DC2626", marginLeft: 8 }}> · {totals.overdue} overdue</span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>Open value</div>
          <div className="text-[18px] font-bold font-mono" style={{ color: "var(--text)" }}>{formatCurrency(totals.value)}</div>
        </div>
      </div>

      <DataTable
        data={list.data}
        columns={cols}
        loading={list.isLoading}
        error={list.error}
        empty={{ title: "Nothing to receive", subtitle: "All purchase orders are either drafted or fully closed." }}
        rowKey={(r) => r.id}
      />

      {receiveTarget && (
        <ReceiveModal
          po={receiveTarget}
          onClose={() => setReceiveTarget(null)}
          submitting={update.isPending}
          error={update.error?.message ?? null}
          onSubmit={(qtyThisDelivery) => {
            const ord = Number(receiveTarget.qty_ordered ?? 0);
            const prev = Number(receiveTarget.qty_received ?? 0);
            const next = Math.min(prev + qtyThisDelivery, ord || prev + qtyThisDelivery);
            const isComplete = ord > 0 && next >= ord;
            update.mutate(
              {
                id: receiveTarget.id,
                body: {
                  qty_received: next,
                  status: isComplete ? "received" : "partial",
                  received_date: isComplete ? new Date().toISOString().slice(0, 10) : undefined,
                },
              },
              { onSuccess: () => setReceiveTarget(null) },
            );
          }}
        />
      )}

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

function ReceiveModal({
  po, onClose, onSubmit, submitting, error,
}: {
  po: PO;
  onClose: () => void;
  onSubmit: (qtyThisDelivery: number) => void;
  submitting: boolean;
  error: string | null;
}) {
  const ord = Number(po.qty_ordered ?? 0);
  const prev = Number(po.qty_received ?? 0);
  const remaining = Math.max(0, ord - prev);
  const [qty, setQty] = useState<string>(String(remaining || ord || 1));
  const qtyNum = Number(qty);
  const invalid = !Number.isFinite(qtyNum) || qtyNum <= 0 || (ord > 0 && prev + qtyNum > ord);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(15,23,42,0.5)" }}
      onClick={onClose}
    >
      <div className="card" style={{ width: 440 }} onClick={(e) => e.stopPropagation()}>
        <div className="card-header">
          <div>
            <div className="card-title">Receive material</div>
            <div className="card-sub font-mono">{po.po_number} · {po.vendor}</div>
          </div>
          <button className="btn btn-sm btn-ghost" onClick={onClose}><X size={14} /></button>
        </div>
        <form
          className="card-body"
          onSubmit={(e) => {
            e.preventDefault();
            if (invalid) return;
            onSubmit(qtyNum);
          }}
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          <div className="grid-3" style={{ gap: 10 }}>
            <Stat label="Ordered" value={ord || "—"} />
            <Stat label="Received" value={prev} />
            <Stat label="Remaining" value={remaining || "—"} highlight={remaining > 0} />
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase font-semibold tracking-wider" style={{ color: "var(--muted)" }}>
              Quantity received this delivery <span style={{ color: "#DC2626" }}>*</span>
            </span>
            <input
              className="input"
              type="number"
              min={1}
              step="1"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              autoFocus
            />
            {ord > 0 && (
              <span className="text-[11px]" style={{ color: invalid && qtyNum > 0 ? "#DC2626" : "var(--muted)" }}>
                Max {remaining || ord} pcs · clicking Save will mark the PO {prev + qtyNum >= ord ? "fully received" : "partial"}.
              </span>
            )}
          </label>

          {error && (
            <div className="pill pill-red" style={{ padding: "8px 12px", fontSize: 12 }}>{error}</div>
          )}

          <div className="flex justify-end gap-2 mt-1">
            <button type="button" onClick={onClose} className="btn">Cancel</button>
            <button type="submit" disabled={submitting || invalid} className="btn btn-primary">
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <PackageCheck size={14} />}
              {submitting ? "Saving…" : "Record receipt"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number | string; highlight?: boolean }) {
  return (
    <div className="info-cell text-center">
      <div className="info-cell-label">{label}</div>
      <div
        className="info-cell-value font-mono"
        style={{ color: highlight ? "var(--primary)" : "var(--text)", fontSize: 16 }}
      >
        {value}
      </div>
    </div>
  );
}
