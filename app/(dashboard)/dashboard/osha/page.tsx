"use client";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { useState } from "react";

type ItemStatus = "Open" | "Done" | "N/A" | "Hold";

interface CheckItem {
  id: string;
  category: string;
  title: string;
  ref: string;
  status: ItemStatus;
}

const OSHA_ITEMS: CheckItem[] = [
  { id: "o1", category: "1926.502 — Fall Protection", title: "All workers at heights ≥6 ft using approved HLL or guardrail system", ref: "§502.1", status: "Done" },
  { id: "o2", category: "1926.502 — Fall Protection", title: "100% tie-off enforced on connectors working at heights", ref: "§502.35", status: "Done" },
  { id: "o3", category: "1926.502 — Fall Protection", title: "Floor / roof openings covered or guarded (no uncovered holes)", ref: "§502.4", status: "Done" },
  { id: "o4", category: "1926.502 — Fall Protection", title: "Harness, lanyard, and anchorage inspected daily by competent person", ref: "§502.16", status: "Open" },
  { id: "o5", category: "1926.454 — Scaffolding", title: "All scaffold erected/moved only by qualified scaffold erector", ref: "§454.1", status: "N/A" },
  { id: "o6", category: "1926.454 — Scaffolding", title: "Platform planks fully decked, secured, no gaps >1 inch", ref: "§452.5", status: "N/A" },
  { id: "o7", category: "1926.350 — Welding", title: "All cylinders chained; flashback arrestors on both sides of regulator", ref: "§350.7", status: "Done" },
  { id: "o8", category: "1926.350 — Welding", title: "Fire watch posted during and 30 min post-hot work", ref: "§352.a", status: "Done" },
  { id: "o9", category: "1926.350 — Welding", title: "Lens shade ≥10 for arc welding; helmet with auto-darkening or fixed shade", ref: "§352.c", status: "Done" },
  { id: "o10", category: "1926.34 — Exits & Egress", title: "Clear egress path maintained in all shop areas (36\" min)", ref: "§34.a", status: "Done" },
  { id: "o11", category: "1926.34 — Exits & Egress", title: "Exit signs illuminated and legible from 100 ft", ref: "§34.b", status: "Done" },
  { id: "o12", category: "1926.403 — Electrical", title: "All extension cords OSHA-grade; no daisy-chaining", ref: "§403.4", status: "Hold" },
  { id: "o13", category: "1926.403 — Electrical", title: "GFCIs on all 120V outlets in wet/damp locations", ref: "§403.9", status: "Done" },
  { id: "o14", category: "1926.62 — Lead Exposure", title: "Baseline blood lead levels documented for grinders/torchers", ref: "§62.d", status: "Open" },
  { id: "o15", category: "1910.178 — Forklifts", title: "All forklift operators OSHA-certified; daily pre-op checklist completed", ref: "§178.l", status: "Done" },
];

export default function OSHAPage() {
  const [items, setItems] = useState<CheckItem[]>(OSHA_ITEMS);

  const toggle = (id: string) => {
    const order: ItemStatus[] = ["Open", "Done", "N/A", "Hold"];
    setItems((prev) => prev.map((item) => {
      if (item.id !== id) return item;
      const idx = order.indexOf(item.status);
      return { ...item, status: order[(idx + 1) % order.length] };
    }));
  };

  const categories = [...new Set(items.map((i) => i.category))];
  const done = items.filter((i) => i.status === "Done").length;
  const holds = items.filter((i) => i.status === "Hold").length;
  const open = items.filter((i) => i.status === "Open").length;

  return (
    <PageWrapper title="OSHA Safety Checklist">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <div className="stat-card primary"><div className="stat-label">Total Items</div><div className="stat-value">{items.length}</div></div>
        <div className="stat-card green"><div className="stat-label">Done</div><div className="stat-value">{done}</div></div>
        <div className="stat-card red"><div className="stat-label">Holds</div><div className="stat-value">{holds}</div></div>
        <div className="stat-card amber"><div className="stat-label">Open</div><div className="stat-value">{open}</div></div>
      </div>
      <div className="text-[11px] mb-3" style={{ color: "var(--muted)" }}>Click any item to cycle: Open → Done → N/A → Hold</div>
      {categories.map((cat) => (
        <div key={cat} className="card mb-4">
          <div className="card-header"><div className="card-title">{cat}</div></div>
          <div className="card-body">
            {items.filter((i) => i.category === cat).map((item) => (
              <div key={item.id} className={`cc ${item.status.toLowerCase().replace(" ", "-")}`} onClick={() => toggle(item.id)}>
                <div className="cc-check">{item.status === "Done" ? "✓" : item.status === "Hold" ? "!" : item.status === "N/A" ? "—" : ""}</div>
                <div className="flex-1 text-[12px]" style={{ color: "var(--text)" }}>{item.title}</div>
                <span className="font-mono text-[10px]" style={{ color: "var(--faint)" }}>{item.ref}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </PageWrapper>
  );
}
