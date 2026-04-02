"use client";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { ASSEMBLIES } from "@/lib/mock-data";

export default function AssembliesPage() {
  return (
    <PageWrapper title="Assemblies">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <div className="stat-card green"><div className="stat-label">Complete</div><div className="stat-value">2</div><div className="stat-sub">assemblies</div></div>
        <div className="stat-card blue"><div className="stat-label">In Progress</div><div className="stat-value">3</div><div className="stat-sub">assemblies</div></div>
        <div className="stat-card primary"><div className="stat-label">Total Parts</div><div className="stat-value">48</div><div className="stat-sub">across all</div></div>
        <div className="stat-card amber"><div className="stat-label">Parts Complete</div><div className="stat-value">34</div><div className="stat-sub">71%</div></div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">Assembly Tracker</div></div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Assembly ID</th>
                <th>Drawing No.</th>
                <th>Description</th>
                <th>Total Parts</th>
                <th>Complete</th>
                <th>In Prog.</th>
                <th>Progress</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {ASSEMBLIES.map((a) => (
                <tr key={a.id}>
                  <td className="td-link">{a.assembly_id}</td>
                  <td className="td-mono">{a.drawing_no}</td>
                  <td style={{ fontSize: 12, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.description}</td>
                  <td className="td-mono">{a.total_parts}</td>
                  <td className="td-mono" style={{ color: "var(--green)" }}>{a.parts_complete}</td>
                  <td className="td-mono" style={{ color: "var(--blue)" }}>{a.parts_in_prog}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="pbar" style={{ width: 80 }}>
                        <div className="pbar-fill" style={{ width: `${a.progress}%`, background: a.progress === 100 ? "var(--green)" : "var(--primary)" }} />
                      </div>
                      <span className="text-[11px] font-mono font-bold" style={{ color: a.progress === 100 ? "var(--green)" : "var(--primary)" }}>{a.progress}%</span>
                    </div>
                  </td>
                  <td><StatusPill status={a.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageWrapper>
  );
}
