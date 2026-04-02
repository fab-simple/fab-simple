"use client";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { Modal } from "@/components/ui/Modal";
import { PROJECTS } from "@/lib/mock-data";
import { formatCurrency } from "@/lib/utils";
import { useState } from "react";
import { Plus, Search } from "lucide-react";
import Link from "next/link";

export default function ProjectsPage() {
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);

  const filtered = PROJECTS.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.client.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <PageWrapper title="Projects">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between mb-5">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }} />
          <input
            className="filter-input pl-8 w-64"
            placeholder="Search projects…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={14} /> New Project
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <div className="stat-card blue">
          <div className="stat-label">Total Projects</div>
          <div className="stat-value">4</div>
          <div className="stat-sub">3 active · 1 planning</div>
        </div>
        <div className="stat-card green">
          <div className="stat-label">Total Parts</div>
          <div className="stat-value">3,041</div>
          <div className="stat-sub">all projects combined</div>
        </div>
        <div className="stat-card primary">
          <div className="stat-label">Contract Value</div>
          <div className="stat-value" style={{ fontSize: 18 }}>
            {formatCurrency(PROJECTS.reduce((s, p) => s + p.contract_value, 0))}
          </div>
          <div className="stat-sub">4 contracts</div>
        </div>
        <div className="stat-card amber">
          <div className="stat-label">Avg Progress</div>
          <div className="stat-value">
            {Math.round(PROJECTS.reduce((s, p) => s + p.progress, 0) / PROJECTS.length)}%
          </div>
          <div className="stat-sub">across active projects</div>
        </div>
      </div>

      {/* Project Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {filtered.map((p) => (
          <div key={p.id} className="card" style={{ borderTop: `3px solid ${p.color}` }}>
            <div className="card-body">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-bold text-[15px] mb-0.5" style={{ color: "var(--text)" }}>{p.name}</div>
                  <div className="text-[12px]" style={{ color: "var(--muted)" }}>
                    {p.client} · {p.contract_type} · Due {new Date(p.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                </div>
                <StatusPill status={p.status} />
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="info-cell text-center">
                  <div className="info-cell-label">Parts</div>
                  <div className="info-cell-value font-mono">{p.total_parts}</div>
                </div>
                <div className="info-cell text-center">
                  <div className="info-cell-label">Complete</div>
                  <div className="info-cell-value font-mono">{p.completed}</div>
                </div>
                <div className="info-cell text-center">
                  <div className="info-cell-label">Value</div>
                  <div className="info-cell-value" style={{ fontSize: 12 }}>{formatCurrency(p.contract_value)}</div>
                </div>
              </div>

              <div className="mb-3">
                <div className="flex justify-between mb-1">
                  <span className="text-[11px]" style={{ color: "var(--muted)" }}>Progress</span>
                  <span className="text-[12px] font-bold font-mono" style={{ color: p.color }}>{p.progress}%</span>
                </div>
                <div className="pbar">
                  <div className="pbar-fill" style={{ width: `${p.progress}%`, background: p.color }} />
                </div>
              </div>

              <Link
                href={`/dashboard/parts?project=${encodeURIComponent(p.name)}`}
                className="btn btn-sm w-full justify-center mt-1"
              >
                View Parts
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Table View */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">All Projects</div>
        </div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Project Name</th>
                <th>Client</th>
                <th>Contract Type</th>
                <th>Parts</th>
                <th>Progress</th>
                <th>Contract Value</th>
                <th>Deadline</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td className="font-semibold" style={{ color: "var(--text)" }}>{p.name}</td>
                  <td style={{ color: "var(--muted)" }}>{p.client}</td>
                  <td><span className="pill pill-info">{p.contract_type}</span></td>
                  <td className="td-mono">{p.total_parts}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="pbar" style={{ width: 60 }}>
                        <div className="pbar-fill" style={{ width: `${p.progress}%`, background: p.color }} />
                      </div>
                      <span className="text-[11px] font-mono font-bold" style={{ color: p.color }}>{p.progress}%</span>
                    </div>
                  </td>
                  <td className="font-mono text-[12px]">{formatCurrency(p.contract_value)}</td>
                  <td className="text-[12px]">{p.deadline}</td>
                  <td><StatusPill status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Project Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="New Project" size="md">
        <div className="grid grid-cols-2 gap-3">
          <div className="fld col-span-2">
            <label>Project Name *</label>
            <input placeholder="e.g. Houston Data Center Steel" />
          </div>
          <div className="fld">
            <label>Client / GC *</label>
            <input placeholder="Turner Construction" />
          </div>
          <div className="fld">
            <label>Contract Type</label>
            <select>
              <option>Lump Sum</option>
              <option>GMP</option>
              <option>T&amp;M</option>
              <option>Unit Price</option>
            </select>
          </div>
          <div className="fld">
            <label>Contract Value ($)</label>
            <input type="number" placeholder="0.00" />
          </div>
          <div className="fld">
            <label>Deadline</label>
            <input type="date" />
          </div>
          <div className="fld col-span-2">
            <label>Description</label>
            <textarea rows={3} placeholder="Brief project description…" />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary">Create Project</button>
        </div>
      </Modal>
    </PageWrapper>
  );
}
