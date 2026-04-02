"use client";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { Modal } from "@/components/ui/Modal";
import { PURCHASE_ORDERS } from "@/lib/mock-data";
import { formatCurrency } from "@/lib/utils";
import { useState } from "react";
import { Plus, AlertTriangle } from "lucide-react";

export default function PurchaseOrdersPage() {
  const [showModal, setShowModal] = useState(false);
  const overdue = PURCHASE_ORDERS.filter((po) => po.receiving_status === "Not Received" && po.status === "Open");

  return (
    <PageWrapper title="Purchase Orders">
      {overdue.length > 0 && (
        <div className="alert alert-warn mb-4">
          <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
          <div><strong>{overdue.length} PO(s)</strong> not yet received — {overdue.map((p) => p.po_number).join(", ")}. Check delivery schedule.</div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <div className="stat-card primary"><div className="stat-label">Total POs</div><div className="stat-value">{PURCHASE_ORDERS.length}</div></div>
        <div className="stat-card green"><div className="stat-label">Fully Received</div><div className="stat-value">{PURCHASE_ORDERS.filter(p => p.receiving_status === "Fully Received").length}</div></div>
        <div className="stat-card amber"><div className="stat-label">Partial / Open</div><div className="stat-value">{PURCHASE_ORDERS.filter(p => p.receiving_status !== "Fully Received").length}</div></div>
        <div className="stat-card blue"><div className="stat-label">Total Committed</div><div className="stat-value" style={{ fontSize: 18 }}>{formatCurrency(PURCHASE_ORDERS.reduce((s, p) => s + p.total_amount, 0))}</div></div>
      </div>

      <div className="flex justify-end mb-3">
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={14} /> New PO</button>
      </div>

      <div className="card">
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr><th>PO Number</th><th>Order Date</th><th>Supplier</th><th>Material</th><th>Qty Ordered</th><th>Qty Received</th><th>Expected Date</th><th>Total</th><th>Receiving</th><th>Status</th></tr>
            </thead>
            <tbody>
              {PURCHASE_ORDERS.map((po) => (
                <tr key={po.id} className={po.receiving_status === "Not Received" ? "tr-warn" : po.receiving_status === "Fully Received" ? "tr-ok" : ""}>
                  <td className="td-mono">{po.po_number}</td>
                  <td style={{ fontSize: 12 }}>{po.order_date}</td>
                  <td style={{ fontSize: 12 }}>{po.supplier}</td>
                  <td className="td-mono" style={{ fontSize: 11 }}>{po.material}</td>
                  <td className="td-mono">{po.qty_ordered}</td>
                  <td className="td-mono">{po.qty_received}</td>
                  <td style={{ fontSize: 12 }}>{po.expected_date}</td>
                  <td className="td-mono font-bold">{formatCurrency(po.total_amount)}</td>
                  <td><StatusPill status={po.receiving_status} /></td>
                  <td><StatusPill status={po.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="New Purchase Order" size="md">
        <div className="grid grid-cols-2 gap-3">
          <div className="fld col-span-2"><label>Supplier *</label><input placeholder="Nucor Steel TX" /></div>
          <div className="fld col-span-2"><label>Material *</label><input placeholder="W14×82, ASTM A992" /></div>
          <div className="fld"><label>Qty Ordered</label><input type="number" /></div>
          <div className="fld"><label>Unit Price ($)</label><input type="number" /></div>
          <div className="fld"><label>Expected Delivery</label><input type="date" /></div>
          <div className="fld"><label>Project</label><select><option>Dallas Skyline Tower</option><option>Houston Refinery</option></select></div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary">Create PO</button>
        </div>
      </Modal>
    </PageWrapper>
  );
}
