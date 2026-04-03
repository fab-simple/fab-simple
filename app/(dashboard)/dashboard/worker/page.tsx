"use client";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { PARTS, PROJECTS } from "@/lib/mock-data";
import { useState } from "react";
import { Search, Smartphone } from "lucide-react";

const STATUSES = ["Not Started", "Cutting", "Welding", "Painting", "Completed", "Shipped"];
const STATUS_COLORS: Record<string, string> = {
  "Not Started": "#94A3B8",
  "Cutting": "#C2410C",
  "Welding": "#2563EB",
  "Painting": "#7C3AED",
  "Completed": "#16A34A",
  "Shipped": "#0D9488",
};

export default function WorkerPage() {
  const [search, setSearch] = useState("");
  const [project, setProject] = useState("All");

  const filtered = PARTS.filter(
    (p) =>
      (p.part_id.includes(search) || p.assembly_id.includes(search)) &&
      (project === "All" || p.project === project)
  );

  return (
    <PageWrapper title="Worker View">
      <div style={{ marginBottom: 24 }}>
        <div className="flex items-center gap-2 mb-2" style={{ marginBottom: 8 }}>
          <Smartphone size={16} style={{ color: "var(--primary)" }} />
          <span className="font-bold text-[15px]" style={{ color: "var(--text)" }}>Shop Floor — Tap to Update Status</span>
        </div>
        <p className="text-[12px]" style={{ color: "var(--muted)" }}>
          Simplified view optimized for tablet / mobile use on the shop floor. Tap any row to cycle its status.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2" style={{ gap: 12, marginBottom: 24 }}>
        <div className="relative flex-1" style={{ flex: 1 }}>
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)", position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
          <input 
            className="filter-input w-full" 
            style={{ width: "100%", paddingLeft: 36, height: 38 }}
            placeholder="Scan or search Part ID…" 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
          />
        </div>
        <select 
          className="filter-input" 
          style={{ height: 38, minWidth: 140 }}
          value={project} 
          onChange={(e) => setProject(e.target.value)}
        >
          <option value="All">All Projects</option>
          {PROJECTS.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
        </select>
      </div>

      <div className="flex flex-wrap" style={{ gap: 8, marginBottom: 24 }}>
        {STATUSES.map((s) => (
          <div 
            key={s} 
            className="flex items-center text-white" 
            style={{ 
              background: STATUS_COLORS[s], 
              padding: "6px 14px", 
              borderRadius: 999, 
              fontSize: 11, 
              fontWeight: 700,
              gap: 6 
            }}
          >
            <span>{PARTS.filter((p) => p.status === s).length}</span>
            <span>{s}</span>
          </div>
        ))}
      </div>

      {/* Mobile-friendly big-tap tiles */}
      <div className="grid-3" style={{ gap: 16 }}>
        {filtered.slice(0, 24).map((p) => (
          <div
            key={p.id}
            className="card cursor-pointer active:scale-95 transition-transform"
            style={{ borderLeft: `4px solid ${STATUS_COLORS[p.status] || "#94A3B8"}` }}
          >
            <div className="card-body" style={{ padding: 16 }}>
              <div className="flex justify-between items-start mb-2" style={{ marginBottom: 12 }}>
                <span className="font-mono font-bold text-[16px]" style={{ color: "var(--primary)" }}>{p.part_id}</span>
                <span
                  className="font-bold text-white leading-none"
                  style={{ 
                    background: STATUS_COLORS[p.status],
                    padding: "6px 12px",
                    borderRadius: 999,
                    fontSize: 11
                  }}
                >
                  {p.status}
                </span>
              </div>
              <div className="font-mono text-[12px]" style={{ color: "var(--muted)", marginBottom: 4 }}>{p.assembly_id}</div>
              <div className="text-[12px]" style={{ color: "var(--text-2)" }}>{p.profile} · {p.length}</div>
            </div>
          </div>
        ))}
      </div>
    </PageWrapper>
  );
}
