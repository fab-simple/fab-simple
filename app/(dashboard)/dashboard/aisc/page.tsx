"use client";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";

type ItemStatus = "Open" | "Done" | "Hold" | "Overdue";

interface CheckItem {
  id: string;
  section: string;
  title: string;
  reference: string;
  status: ItemStatus;
  notes: string;
}

const INITIAL_ITEMS: CheckItem[] = [
  { id: "a1", section: "4. Work Authorization", title: "WPS/PQR reviewed and approved for all weld procedures", reference: "§4.2", status: "Done", notes: "CWI-2841 sign-off 03/15" },
  { id: "a2", section: "4. Work Authorization", title: "Welder qualification records current and on file", reference: "§4.3", status: "Done", notes: "" },
  { id: "a3", section: "4. Work Authorization", title: "CWI qualification current (recertification not overdue)", reference: "§4.4", status: "Done", notes: "" },
  { id: "a4", section: "5. Fabrication", title: "All material ASTM certified and traceable to heat number", reference: "§5.1", status: "Hold", notes: "HN-7734B MTR awaiting — parts in quarantine" },
  { id: "a5", section: "5. Fabrication", title: "Camber and sweep within tolerance per AISC Code of Standard Practice", reference: "§5.3", status: "Done", notes: "" },
  { id: "a6", section: "5. Fabrication", title: "Field bolt holes sized per specified fastener diameter", reference: "§5.4", status: "Open", notes: "" },
  { id: "a7", section: "5. Fabrication", title: "Steel surfaces free of mill scale, excessive rust, and contaminants", reference: "§5.7", status: "Done", notes: "" },
  { id: "a8", section: "6. Quality Control", title: "Shop inspection plan approved by responsible CWI", reference: "§6.1", status: "Done", notes: "" },
  { id: "a9", section: "6. Quality Control", title: "All CJP welds UT/RT inspected per contract requirements", reference: "§6.4", status: "Hold", notes: "W14×82-1044 UT pending Seq. 5" },
  { id: "a10", section: "6. Quality Control", title: "Fillet welds VT inspected per AWS D1.1 §6.9", reference: "§6.5", status: "Done", notes: "" },
  { id: "a11", section: "6. Quality Control", title: "Paint system verified — mil thickness readings recorded", reference: "§6.7", status: "Done", notes: "PI-0441 thru PI-0443" },
  { id: "a12", section: "7. Erection", title: "Erection sequence reviewed with GC superintendent", reference: "§7.2", status: "Open", notes: "" },
  { id: "a13", section: "7. Erection", title: "Anchor bolt survey completed and within tolerance", reference: "§7.4", status: "Open", notes: "" },
  { id: "a14", section: "7. Erection", title: "Temporary bracing plan approved by EOR prior to erection", reference: "§7.6", status: "Done", notes: "" },
];

const SECTION_COLORS: Record<string, string> = {
  "4. Work Authorization": "var(--primary)",
  "5. Fabrication": "var(--blue)",
  "6. Quality Control": "var(--violet)",
  "7. Erection": "var(--teal)",
};

export default function AISCPage() {
  const [items, setItems] = useState<CheckItem[]>(INITIAL_ITEMS);

  const toggle = (id: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const next: ItemStatus =
          item.status === "Open" ? "Done" : item.status === "Done" ? "Hold" : "Open";
        return { ...item, status: next };
      })
    );
  };

  const sections = [...new Set(items.map((i) => i.section))];
  const done = items.filter((i) => i.status === "Done").length;
  const holds = items.filter((i) => i.status === "Hold").length;

  return (
    <PageWrapper title="AISC 303 QC Compliance">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <div className="stat-card primary"><div className="stat-label">Total Items</div><div className="stat-value">{items.length}</div></div>
        <div className="stat-card green"><div className="stat-label">Done</div><div className="stat-value">{done}</div></div>
        <div className="stat-card red"><div className="stat-label">Holds</div><div className="stat-value">{holds}</div><div className="stat-sub">erection blocked</div></div>
        <div className="stat-card amber"><div className="stat-label">Completion</div><div className="stat-value">{Math.round((done / items.length) * 100)}%</div></div>
      </div>

      {holds > 0 && (
        <div className="alert alert-danger mb-4">
          <ShieldCheck size={15} className="flex-shrink-0 mt-0.5" />
          <div>
            <strong>{holds} AISC HOLD{holds > 1 ? "S" : ""}</strong> — Fabrication/erection on affected items must be paused until holds are resolved. Click items to update status.
          </div>
        </div>
      )}

      <div className="text-[11px] mb-3" style={{ color: "var(--muted)" }}>Click any item to cycle status: Open → Done → Hold</div>

      {sections.map((section) => (
        <div key={section} className="card mb-4">
          <div className="card-header">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: SECTION_COLORS[section] || "var(--primary)" }} />
              <div className="card-title">{section}</div>
              <span className="font-mono text-[10px]" style={{ color: "var(--muted)" }}>AISC 303-10</span>
            </div>
          </div>
          <div className="card-body">
            {items.filter((i) => i.section === section).map((item) => (
              <div
                key={item.id}
                className={`cc ${item.status.toLowerCase()}`}
                onClick={() => toggle(item.id)}
              >
                <div className="cc-check">
                  {item.status === "Done" && "✓"}
                  {item.status === "Hold" && "!"}
                </div>
                <div className="flex-1">
                  <div className="text-[12px] font-semibold" style={{ color: "var(--text)" }}>{item.title}</div>
                  {item.notes && <div className="text-[11px] mt-0.5" style={{ color: "var(--muted)" }}>{item.notes}</div>}
                </div>
                <span className="font-mono text-[10px]" style={{ color: "var(--faint)" }}>{item.reference}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </PageWrapper>
  );
}
