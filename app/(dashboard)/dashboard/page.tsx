"use client";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import {
  PROJECTS,
  PARTS,
  ACTIVITY_FEED,
  DAILY_LOGS,
} from "@/lib/mock-data";
import { formatCurrency } from "@/lib/utils";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

const STATUS_COUNTS = [
  { name: "Not Started", value: 148, color: "#94A3B8" },
  { name: "Cutting",     value: 87,  color: "#C2410C" },
  { name: "Welding",     value: 204, color: "#2563EB" },
  { name: "Painting",    value: 161, color: "#7C3AED" },
  { name: "Completed",   value: 1330, color: "#16A34A" },
  { name: "Shipped",     value: 489, color: "#0D9488" },
];

const WEEK_DATA = [
  { day: "Mon", parts: 88 },
  { day: "Tue", parts: 102 },
  { day: "Wed", parts: 91 },
  { day: "Thu", parts: 118 },
  { day: "Fri", parts: 73 },
];

const STATS = [
  { label: "Total Parts",      value: "2,419", sub: "across 4 active projects", cls: "primary" },
  { label: "Completed Parts",  value: "1,330", sub: "72% of Dallas project", cls: "green" },
  { label: "In Production",    value: "452",   sub: "87 cutting · 204 welding", cls: "blue" },
  { label: "Pending Shipment", value: "161",   sub: "painting / finishing", cls: "violet" },
];

export default function DashboardPage() {
  const totalParts = STATUS_COUNTS.reduce((s, x) => s + x.value, 0);

  return (
    <PageWrapper title="Dashboard">
      {/* Stats Row */}
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
        {/* Doughnut Chart */}
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
                  <Pie
                    data={STATUS_COUNTS}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {STATUS_COUNTS.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [value, "Parts"]}
                    contentStyle={{
                      background: "var(--bg-card)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid-2" style={{ gap: 6, marginTop: 8 }}>
              {STATUS_COUNTS.map((s) => (
                <div key={s.name} className="flex items-center gap-2 text-[11px]" style={{ color: "var(--text-2)" }}>
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                  {s.name}
                  <span className="ml-auto font-mono font-bold" style={{ color: "var(--text)" }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Project Progress */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Project Progress</div>
          </div>
          <div className="card-body">
            {PROJECTS.map((p) => (
              <div key={p.id} className="mb-4">
                <div className="flex items-start justify-between mb-1.5">
                  <div>
                    <div className="text-[12px] font-semibold" style={{ color: "var(--text)" }}>{p.name}</div>
                    <div className="text-[11px]" style={{ color: "var(--muted)" }}>{p.client} · {p.total_parts} parts</div>
                  </div>
                  <span className="text-[13px] font-bold font-mono" style={{ color: p.color }}>{p.progress}%</span>
                </div>
                <div className="pbar">
                  <div className="pbar-fill" style={{ width: `${p.progress}%`, background: p.color }} />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px]" style={{ color: "var(--muted)" }}>{p.completed} complete</span>
                  <StatusPill status={p.status} size="sm" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* This Week */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">This Week — Parts/Day</div>
            <div className="card-sub">Shop output</div>
          </div>
          <div className="card-body">
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={WEEK_DATA} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: "var(--bg-muted)" }}
                    contentStyle={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  />
                  <Bar dataKey="parts" fill="#4F46E5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="grid-3" style={{ gap: 8, marginTop: 12 }} style={{ borderTop: "1px solid var(--border)" }}>
              {DAILY_LOGS.map((d) => (
                <div key={d.id} className="text-center">
                  <div className="text-[10px] font-mono font-bold" style={{ color: "var(--muted)" }}>{d.station.split("/")[0].trim()}</div>
                  <div className="text-[16px] font-bold font-mono" style={{ color: "var(--text)" }}>{d.parts_completed}</div>
                  <div className="text-[9px]" style={{ color: "var(--muted)" }}>parts</div>
                </div>
              )).slice(0, 3)}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid-2 gap-md">
        {/* Activity Feed */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Live Activity</div>
            <span className="pill pill-done" style={{ fontSize: 10 }}>● Live</span>
          </div>
          <div className="card-body">
            {ACTIVITY_FEED.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-3 py-2.5"
                style={{ borderBottom: "1px solid var(--bg-muted)" }}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                  style={{ background: a.color }}
                >
                  {a.user_name.slice(0, 1)}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-[12px]" style={{ color: "var(--text)" }}>{a.user_name}</span>
                  <span className="text-[12px]" style={{ color: "var(--muted)" }}> {a.action} </span>
                  <span className="font-mono text-[11px] font-bold" style={{ color: "var(--primary)" }}>{a.entity_id}</span>
                  {a.detail && (
                    <span className="text-[12px]" style={{ color: "var(--muted)" }}> — {a.detail}</span>
                  )}
                </div>
                <span className="text-[10px] font-mono flex-shrink-0" style={{ color: "var(--faint)" }}>{a.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Parts */}
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
                {PARTS.slice(0, 6).map((p) => (
                  <tr key={p.id}>
                    <td className="td-mono">{p.part_id}</td>
                    <td style={{ color: "var(--muted)", fontSize: 12 }}>{p.profile}</td>
                    <td style={{ fontSize: 12, maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.project}</td>
                    <td><StatusPill status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid-4" style={{ gap: 20, marginTop: 32 }}>
        <div className="card-body card" style={{ borderTop: "3px solid #D97706" }}>
          <div className="stat-label">Open Change Orders</div>
          <div className="stat-value" style={{ fontSize: 22 }}>3</div>
          <div className="stat-sub">$44,800 pending approval</div>
        </div>
        <div className="card-body card" style={{ borderTop: "3px solid var(--red)" }}>
          <div className="stat-label">AISC Holds</div>
          <div className="stat-value" style={{ fontSize: 22 }}>2</div>
          <div className="stat-sub">QC sign-off required</div>
        </div>
        <div className="card-body card" style={{ borderTop: "3px solid var(--amber)" }}>
          <div className="stat-label">Open RFIs</div>
          <div className="stat-value" style={{ fontSize: 22 }}>1</div>
          <div className="stat-sub">Awaiting EOR response</div>
        </div>
        <div className="card-body card" style={{ borderTop: "3px solid var(--teal)" }}>
          <div className="stat-label">Total Contract Value</div>
          <div className="stat-value" style={{ fontSize: 18 }}>
            {formatCurrency(PROJECTS.reduce((s, p) => s + p.contract_value, 0))}
          </div>
          <div className="stat-sub">4 active projects</div>
        </div>
      </div>
    </PageWrapper>
  );
}
