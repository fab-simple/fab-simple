"use client";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { PARTS, PROJECTS } from "@/lib/mock-data";
import { useState } from "react";
import { Search, SlidersHorizontal, Download } from "lucide-react";
import Link from "next/link";

const STATUSES = ["All", "Not Started", "Cutting", "Welding", "Painting", "Completed", "Shipped"];

export default function PartsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [project, setProject] = useState("All");

  const filtered = PARTS.filter((p) => {
    const matchSearch =
      p.part_id.toLowerCase().includes(search.toLowerCase()) ||
      p.assembly_id.toLowerCase().includes(search.toLowerCase()) ||
      p.profile.toLowerCase().includes(search.toLowerCase());
    const matchStatus = status === "All" || p.status === status;
    const matchProject = project === "All" || p.project === project;
    return matchSearch && matchStatus && matchProject;
  });

  const counts = STATUSES.slice(1).reduce<Record<string, number>>((acc, s) => {
    acc[s] = PARTS.filter((p) => p.status === s).length;
    return acc;
  }, {});

  return (
    <PageWrapper title="Parts List">
      {/* Status filter chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {STATUSES.map((s) => (
          <button
            key={s}
            className={`btn btn-sm ${status === s ? "btn-primary" : ""}`}
            onClick={() => setStatus(s)}
          >
            {s} {s !== "All" && <span className="font-mono ml-1">({counts[s] || 0})</span>}
          </button>
        ))}
      </div>

      {/* Filters row */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }} />
          <input
            className="filter-input w-full pl-8"
            placeholder="Search Part ID, Assembly, Profile…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="filter-input"
          value={project}
          onChange={(e) => setProject(e.target.value)}
        >
          <option value="All">All Projects</option>
          {PROJECTS.map((p) => (
            <option key={p.id} value={p.name}>{p.name}</option>
          ))}
        </select>
        <button className="btn btn-sm">
          <SlidersHorizontal size={13} /> Filter
        </button>
        <button className="btn btn-sm">
          <Download size={13} /> CSV
        </button>
      </div>

      {/* Count */}
      <div className="text-[12px] mb-3" style={{ color: "var(--muted)" }}>
        Showing <span className="font-bold" style={{ color: "var(--text)" }}>{filtered.length}</span> of {PARTS.length} parts
      </div>

      {/* Table */}
      <div className="card">
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Part ID</th>
                <th>Assembly</th>
                <th>Drawing No.</th>
                <th>Profile</th>
                <th>Material</th>
                <th>Length</th>
                <th>Weight (lbs)</th>
                <th>Phase</th>
                <th>Heat #</th>
                <th>Project</th>
                <th>Status</th>
                <th>CO Ref</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className={p.status === "Shipped" ? "tr-ok" : ""}>
                  <td>
                    <Link href={`/dashboard/parts/${p.id}`} className="td-link">
                      {p.part_id}
                    </Link>
                  </td>
                  <td className="font-mono text-[11px]" style={{ color: "var(--primary)" }}>{p.assembly_id}</td>
                  <td className="text-[12px]">{p.drawing_no}</td>
                  <td className="td-mono">{p.profile}</td>
                  <td style={{ fontSize: 12 }}>{p.material}</td>
                  <td className="font-mono text-[12px]">{p.length}</td>
                  <td className="td-mono">{p.weight.toLocaleString()}</td>
                  <td style={{ fontSize: 12 }}>{p.phase}</td>
                  <td className="td-mono" style={{ fontSize: 11 }}>{p.heat_number}</td>
                  <td style={{ fontSize: 12, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.project}</td>
                  <td><StatusPill status={p.status} /></td>
                  <td>
                    {p.co_ref ? (
                      <span className="pill pill-warn">{p.co_ref}</span>
                    ) : (
                      <span style={{ color: "var(--faint)", fontSize: 11 }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageWrapper>
  );
}
