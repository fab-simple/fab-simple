"use client";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { JOB_COSTS } from "@/lib/mock-data";
import { formatCurrency } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

export default function JobCostPage() {
  const totalBudget = JOB_COSTS.reduce((s, j) => s + j.budget, 0);
  const totalActual = JOB_COSTS.reduce((s, j) => s + j.actual, 0);
  const overBudget = JOB_COSTS.filter((j) => j.actual > j.budget);

  return (
    <PageWrapper title="Job Cost Tracker">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <div className="stat-card primary"><div className="stat-label">Total Budget</div><div className="stat-value" style={{ fontSize: 18 }}>{formatCurrency(totalBudget)}</div></div>
        <div className="stat-card blue"><div className="stat-label">Total Actual</div><div className="stat-value" style={{ fontSize: 18 }}>{formatCurrency(totalActual)}</div></div>
        <div className={`stat-card ${totalActual <= totalBudget ? "green" : "red"}`}>
          <div className="stat-label">Variance</div>
          <div className="stat-value" style={{ fontSize: 18 }}>{formatCurrency(Math.abs(totalBudget - totalActual))}</div>
          <div className="stat-sub">{totalActual <= totalBudget ? "under budget" : "OVER BUDGET"}</div>
        </div>
        <div className={`stat-card ${overBudget.length === 0 ? "green" : "red"}`}>
          <div className="stat-label">Over-Budget Items</div>
          <div className="stat-value">{overBudget.length}</div>
        </div>
      </div>

      <div className="card mb-5">
        <div className="card-header"><div className="card-title">Budget vs Actual by Category</div></div>
        <div className="card-body">
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={JOB_COSTS} barSize={20}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="category" tick={{ fontSize: 10, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "var(--muted)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => formatCurrency(v as number)} contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="budget" name="Budget" fill="var(--primary-bd)" radius={[3, 3, 0, 0]} />
                <Bar dataKey="actual" name="Actual" fill="var(--primary)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><div className="card-title">Cost Breakdown</div></div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr><th>Category</th><th>Project</th><th>Budget</th><th>Actual</th><th>Committed</th><th>% Used</th><th>Variance</th></tr>
            </thead>
            <tbody>
              {JOB_COSTS.map((j) => {
                const pct = Math.round((j.actual / j.budget) * 100);
                const variance = j.budget - j.actual;
                return (
                  <tr key={j.id} className={j.actual > j.budget ? "tr-danger" : ""}>
                    <td className="font-semibold" style={{ color: "var(--text)" }}>{j.category}</td>
                    <td style={{ fontSize: 12 }}>{j.project}</td>
                    <td className="td-mono">{formatCurrency(j.budget)}</td>
                    <td className="td-mono">{formatCurrency(j.actual)}</td>
                    <td className="td-mono">{formatCurrency(j.committed)}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="pbar" style={{ width: 60 }}>
                          <div className="pbar-fill" style={{ width: `${Math.min(pct, 100)}%`, background: pct > 100 ? "var(--red)" : pct > 85 ? "#D97706" : "var(--primary)" }} />
                        </div>
                        <span className="font-mono text-[11px]" style={{ color: pct > 100 ? "var(--red)" : "var(--text)" }}>{pct}%</span>
                      </div>
                    </td>
                    <td className="td-mono" style={{ color: variance < 0 ? "var(--red)" : "var(--green)", fontWeight: 600 }}>
                      {variance < 0 ? "-" : "+"}{formatCurrency(Math.abs(variance))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </PageWrapper>
  );
}
