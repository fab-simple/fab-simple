"use client";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { INVENTORY } from "@/lib/mock-data";
import { AlertTriangle } from "lucide-react";

export default function InventoryPage() {
  const outOfStock = INVENTORY.filter((i) => i.status === "out");
  const lowStock = INVENTORY.filter((i) => i.status === "low");

  return (
    <PageWrapper title="Inventory">
      {(outOfStock.length > 0 || lowStock.length > 0) && (
        <div className="alert alert-danger mb-4">
          <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
          <div>
            <strong>{outOfStock.length} materials OUT OF STOCK</strong> · {outOfStock.map((i) => i.material).join(", ")}.
            {lowStock.length > 0 && <><br /><strong>{lowStock.length} materials LOW</strong> (below reorder point) · {lowStock.map((i) => i.material).join(", ")}.</>}
            {" "}Create POs immediately to avoid production delays.
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <div className="stat-card green"><div className="stat-label">In Stock (OK)</div><div className="stat-value">{INVENTORY.filter(i => i.status === "ok").length}</div></div>
        <div className="stat-card amber"><div className="stat-label">Low Stock</div><div className="stat-value">{lowStock.length}</div></div>
        <div className="stat-card red"><div className="stat-label">Out of Stock</div><div className="stat-value">{outOfStock.length}</div></div>
        <div className="stat-card primary"><div className="stat-label">Total SKUs</div><div className="stat-value">{INVENTORY.length}</div></div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">Stock Levels</div><div className="card-sub">Sorted by status — Out / Low first</div></div>
        <div className="card-body">
          {[...INVENTORY].sort((a, b) => {
            const order: Record<string, number> = { out: 0, low: 1, ok: 2 };
            return order[a.status] - order[b.status];
          }).map((item) => {
            const pct = Math.round((item.qty_on_hand / item.max_stock) * 100);
            const barColor = item.status === "out" ? "var(--red)" : item.status === "low" ? "#D97706" : "var(--green)";
            return (
              <div key={item.id} className="inv-item">
                <div className="inv-name">{item.material}</div>
                <div style={{ fontSize: 10, color: "var(--muted)", width: 80, flexShrink: 0 }}>{item.astm_spec}</div>
                <div className="inv-bar-wrap">
                  <div className="inv-bar" style={{ width: `${pct}%`, background: barColor }} />
                </div>
                <div className="inv-qty">
                  <span style={{ color: item.status === "out" ? "var(--red)" : item.status === "low" ? "#D97706" : "var(--green)" }}>
                    {item.qty_on_hand}
                  </span>
                  <span style={{ color: "var(--faint)", fontSize: 10 }}>/{item.max_stock}</span>
                </div>
                <div style={{ width: 70, flexShrink: 0 }}>
                  <span className={`pill ${item.status === "out" ? "pill-danger" : item.status === "low" ? "pill-warn" : "pill-done"}`}>
                    {item.status === "out" ? "OUT" : item.status === "low" ? "LOW" : "OK"}
                  </span>
                </div>
                <div style={{ fontSize: 10, color: "var(--muted)", flexShrink: 0 }}>
                  Reorder at {item.reorder_point}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </PageWrapper>
  );
}
