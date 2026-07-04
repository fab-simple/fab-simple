"use client";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { useDashboard } from "@/hooks/useResource";
import { formatCurrency } from "@/lib/utils";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { Loader2, AlertCircle } from "lucide-react";

const STATUS_COLORS: Record<string, { name: string; color: string }> = {
  not_started: { name: "Not Started", color: "#94A3B8" },
  ordered:     { name: "Ordered",     color: "#3B82F6" },
  in_progress: { name: "In Progress", color: "#2563EB" },
  complete:    { name: "Completed",   color: "#16A34A" },
  shipped:     { name: "Shipped",     color: "#0D9488" },
  on_hold:     { name: "On Hold",     color: "#DC2626" },
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function DashboardPage() {
  const { data, isLoading, error } = useDashboard();

  if (isLoading) {
    return (
      <PageWrapper title="Dashboard">
        <div className="flex items-center justify-center" style={{ minHeight: 400, color: "var(--muted)" }}>
          <Loader2 size={20} className="animate-spin" />
          <span className="ml-3 text-[13px]">Loading dashboard…</span>
        </div>
      </PageWrapper>
    );
  }

  if (error) {
    return (
      <PageWrapper title="Dashboard">
        <div className="card" style={{ padding: 24 }}>
          <div className="flex items-center gap-3" style={{ color: "#DC2626" }}>
            <AlertCircle size={18} />
            <div>
              <div className="font-semibold">Failed to load dashboard</div>
              <div className="text-[12px]" style={{ color: "var(--muted)" }}>{error.message}</div>
            </div>
          </div>
        </div>
      </PageWrapper>
    );
  }

  if (!data) {
    return (
      <PageWrapper title="Dashboard">
        <div className="card text-center" style={{ padding: 40, color: "var(--muted)" }}>
          No dashboard data available.
        </div>
      </PageWrapper>
    );
  }

  const statusCounts = Object.entries(data.parts_by_status)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({
      name: STATUS_COLORS[k]?.name ?? k,
      color: STATUS_COLORS[k]?.color ?? "#94A3B8",
      value: v,
    }));

  const totalParts = data.total_parts;
  const totalWeight = data.total_weight;
  const projects = data.projects;
  const activity = data.activity;
  const recentParts = data.recent_parts;

  const completedCount = (data.parts_by_status.complete ?? 0) + (data.parts_by_status.shipped ?? 0);
  const inProgressCount = (data.parts_by_status.in_progress ?? 0) + (data.parts_by_status.not_started ?? 0);
  const shippedCount = data.parts_by_status.shipped ?? 0;

  // Build a normalized day-of-week series for the chart from production_by_day.
  const weekData = data.production_by_day.map((d) => ({
    day: DAY_LABELS[new Date(d.date + "T00:00:00").getDay()] ?? d.date,
    parts: d.parts_completed,
  }));

  const STATS = [
    { label: "Total Parts",     value: totalParts.toLocaleString(),    sub: `across ${projects.length} active projects`, cls: "primary" },
    { label: "Completed Parts", value: completedCount.toLocaleString(), sub: totalWeight ? `${(totalWeight / 2000).toFixed(1)} tons total` : "ready for QC sign-off", cls: "green" },
    { label: "In Production",   value: inProgressCount.toLocaleString(), sub: `${data.parts_by_status.in_progress ?? 0} active · ${data.parts_by_status.not_started ?? 0} queued`, cls: "blue" },
    { label: "Shipped",         value: shippedCount.toLocaleString(),   sub: `${data.open_change_orders.length} open change orders`, cls: "violet" },
  ];

  return (
    <PageWrapper title="Dashboard">
      <div className="grid-4" style={{ gap: 20, marginBottom: 32 }}>
        {STATS.map((s) => (
          <div key={s.label} className={`stat-card ${s.cls}`}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid-3" style={{ gap: 24, marginBottom: 32 }}>
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Parts by Status</div>
              <div className="card-sub">{totalParts.toLocaleString()} total parts</div>
            </div>
          </div>
          <div className="card-body">
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusCounts} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2} dataKey="value">
                    {statusCounts.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => [v, "Parts"]} contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid-2" style={{ gap: 6, marginTop: 8 }}>
              {statusCounts.map((s) => (
                <div key={s.name} className="flex items-center gap-2 text-[11px]" style={{ color: "var(--text-2)" }}>
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                  {s.name}
                  <span className="ml-auto font-mono font-bold" style={{ color: "var(--text)" }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Project Progress</div>
          </div>
          <div className="card-body">
            {projects.slice(0, 5).map((p) => (
              <div key={p.id} className="mb-4">
                <div className="flex items-start justify-between mb-1.5">
                  <div>
                    <div className="text-[12px] font-semibold" style={{ color: "var(--text)" }}>{p.name}</div>
                    <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                      {p.gc_name ?? "—"} · {p.total_parts} parts
                    </div>
                  </div>
                  <span className="text-[13px] font-bold font-mono" style={{ color: p.color ?? "var(--primary)" }}>{p.progress}%</span>
                </div>
                <div className="pbar">
                  <div className="pbar-fill" style={{ width: `${p.progress}%`, background: p.color ?? "var(--primary)" }} />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px]" style={{ color: "var(--muted)" }}>{p.completed} complete</span>
                  <StatusPill status={p.status} size="sm" />
                </div>
              </div>
            ))}
            {projects.length === 0 && (
              <div className="text-center text-[12px] py-4" style={{ color: "var(--muted)" }}>No active projects</div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">This Week — Parts/Day</div>
            <div className="card-sub">Shop output</div>
          </div>
          <div className="card-body">
            <div style={{ height: 180 }}>
              {weekData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weekData} barSize={28}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: "var(--bg-muted)" }} contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                    <Bar dataKey="parts" fill="#4F46E5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-[12px]" style={{ color: "var(--muted)" }}>
                  No production data this week
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2 gap-md">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Live Activity</div>
            <span className="pill pill-done" style={{ fontSize: 10 }}>● Live</span>
          </div>
          <div className="card-body">
            {activity.slice(0, 6).map((a) => (
              <div key={a.id} className="flex items-center gap-3 py-2.5" style={{ borderBottom: "1px solid var(--bg-muted)" }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0" style={{ background: "#2563EB" }}>
                  {(a.user_name ?? "?").slice(0, 1)}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-[12px]" style={{ color: "var(--text)" }}>{a.user_name}</span>
                  <span className="text-[12px]" style={{ color: "var(--muted)" }}> {a.action} </span>
                  {a.entity_label && (
                    <span className="font-mono text-[11px] font-bold" style={{ color: "var(--primary)" }}>{a.entity_label}</span>
                  )}
                </div>
                <span className="text-[10px] font-mono flex-shrink-0" style={{ color: "var(--faint)" }}>
                  {a.created_at ? new Date(a.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                </span>
              </div>
            ))}
            {activity.length === 0 && (
              <div className="text-center text-[12px] py-4" style={{ color: "var(--muted)" }}>No recent activity</div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Recent Parts</div>
          </div>
          <div className="tbl-wrap">
            <table>
              <thead>
                <tr>
                  <th>Part ID</th>
                  <th>Profile</th>
                  <th>Project</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentParts.slice(0, 6).map((p) => (
                  <tr key={p.id}>
                    <td className="td-mono">{p.part_mark}</td>
                    <td style={{ color: "var(--muted)", fontSize: 12 }}>{p.profile}</td>
                    <td style={{ fontSize: 12, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.project_name ?? "—"}</td>
                    <td><StatusPill status={p.status} /></td>
                  </tr>
                ))}
                {recentParts.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-3" style={{ color: "var(--muted)", fontSize: 12 }}>No parts yet</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid-4" style={{ gap: 20, marginTop: 32 }}>
        <div className="card-body card" style={{ borderTop: "3px solid #D97706" }}>
          <div className="stat-label">Open Change Orders</div>
          <div className="stat-value" style={{ fontSize: 22 }}>{data.open_change_orders.length}</div>
          <div className="stat-sub">
            ${data.open_change_orders.reduce((s, c) => s + Number(c.amount ?? 0), 0).toLocaleString()} pending
          </div>
        </div>
        <div className="card-body card" style={{ borderTop: "3px solid var(--red)" }}>
          <div className="stat-label">Open NCRs</div>
          <div className="stat-value" style={{ fontSize: 22 }}>{data.open_ncrs.length}</div>
          <div className="stat-sub">QC sign-off required</div>
        </div>
        <div className="card-body card" style={{ borderTop: "3px solid var(--amber)" }}>
          <div className="stat-label">Open RFIs</div>
          <div className="stat-value" style={{ fontSize: 22 }}>{data.open_rfis.length}</div>
          <div className="stat-sub">Awaiting EOR response</div>
        </div>
        <div className="card-body card" style={{ borderTop: "3px solid var(--teal)" }}>
          <div className="stat-label">Total Contract Value</div>
          <div className="stat-value" style={{ fontSize: 18 }}>
            {formatCurrency(data.financial?.backlog ?? projects.reduce((s, p) => s + Number(p.contract_value ?? 0), 0))}
          </div>
          <div className="stat-sub">{projects.length} active projects</div>
        </div>
      </div>
    </PageWrapper>
  );
}
