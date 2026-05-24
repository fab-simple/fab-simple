"use client";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { useResourceList, useUpdate } from "@/hooks/useResource";
import { CheckCircle2, AlertCircle, MinusCircle } from "lucide-react";

interface OshaItem {
  id: string; section_ref: string; item_text: string; category: string | null;
  status: string; notes: string | null; sort_order: number;
}
const STATUSES = ["open", "done", "hold", "na"];
const ICONS: Record<string, React.ReactNode> = {
  open: <AlertCircle size={14} style={{ color: "#D97706" }} />,
  done: <CheckCircle2 size={14} style={{ color: "#16A34A" }} />,
  hold: <AlertCircle size={14} style={{ color: "#DC2626" }} />,
  na:   <MinusCircle size={14} style={{ color: "#94A3B8" }} />,
};

export default function OshaPage() {
  const items = useResourceList<OshaItem>("osha_checklists", { order_by: "sort_order", dir: "asc", limit: "200" });
  const update = useUpdate<OshaItem>("osha_checklists");

  const grouped = (items.data ?? []).reduce<Record<string, OshaItem[]>>((acc, item) => {
    const cat = item.category ?? "Other";
    (acc[cat] ??= []).push(item);
    return acc;
  }, {});

  const counts = (items.data ?? []).reduce((a, i) => { a[i.status] = (a[i.status] ?? 0) + 1; return a; }, {} as Record<string, number>);

  return (
    <PageWrapper title="OSHA Checklist">
      <div className="mb-6">
        <div className="text-[20px] font-bold" style={{ color: "var(--text)" }}>OSHA 29 CFR Compliance</div>
        <div className="text-[12px]" style={{ color: "var(--muted)" }}>
          {items.data?.length ?? 0} items · {counts.done ?? 0} cleared · {counts.open ?? 0} open · {counts.hold ?? 0} on hold
        </div>
      </div>

      {Object.entries(grouped).map(([cat, list]) => (
        <div className="card" key={cat} style={{ marginBottom: 20 }}>
          <div className="card-header">
            <div className="card-title">{cat}</div>
            <span className="pill" style={{ fontSize: 10 }}>{list.length} items</span>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {list.map((item) => (
              <div key={item.id} className="flex items-center gap-3 p-3" style={{ borderBottom: "1px solid var(--bg-muted)" }}>
                {ICONS[item.status]}
                <div style={{ flex: 1 }}>
                  <div className="text-[13px]" style={{ color: "var(--text)" }}>{item.item_text}</div>
                  <div className="text-[11px] font-mono" style={{ color: "var(--muted)" }}>{item.section_ref}</div>
                </div>
                <select
                  className="input"
                  value={item.status}
                  disabled={update.isPending}
                  onChange={(e) => update.mutate({ id: item.id, body: { status: e.target.value } })}
                  style={{ height: 28, width: 120, fontSize: 11 }}
                >
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <StatusPill status={item.status === "done" ? "done" : item.status === "hold" ? "warn" : item.status === "na" ? "ns" : "open"} size="sm" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </PageWrapper>
  );
}
