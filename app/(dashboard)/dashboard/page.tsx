"use client";

import { useState } from "react";
import Link from "next/link";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { useDashboard } from "@/hooks/useResource";
import { formatCurrency } from "@/lib/utils";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area,
} from "recharts";
import {
  Building2,
  Layers,
  ShieldAlert,
  CheckCircle2,
  Truck,
  QrCode,
  Compass,
  FileText,
  DollarSign,
  AlertCircle,
  Calendar,
  ArrowRight,
  ChevronRight,
  Filter,
  Factory,
  Wrench,
  User,
  Play,
  Check,
  PackageCheck,
  Flame,
  Activity,
  FileCheck,
  AlertTriangle,
  MapPin,
  TrendingUp,
  Clock,
  ExternalLink,
  Target,
  BarChart2,
  ChevronDown,
} from "lucide-react";

export default function DashboardPage() {
  const { data } = useDashboard();

  // Role State: owner | pm | purchasing | foreman | qc
  const [selectedRole, setSelectedRole] = useState<"owner" | "pm" | "purchasing" | "foreman" | "qc">("owner");
  const [selectedPlant, setSelectedPlant] = useState("Houston Fabrication Plant 1");
  const [selectedDateRange, setSelectedDateRange] = useState("This Month");

  // Foreman mobile MES interactive action simulation
  const [foremanAction, setForemanAction] = useState<string | null>(null);

  // Recharts Data Sets for Modern Charts & Round Donuts
  const INVENTORY_DONUT_DATA = [
    { name: "Available Yard", value: 1100, color: "#10B981" },
    { name: "On Purchase Order", value: 300, color: "#4F46E5" },
    { name: "Shortage", value: 100, color: "#F59E0B" },
  ];

  const QC_PASS_DONUT_DATA = [
    { name: "Passed Inspection", value: 96, color: "#10B981" },
    { name: "Requires Re-test", value: 4, color: "#EF4444" },
  ];

  const WEEKLY_PRODUCTION_AREA_DATA = [
    { day: "Mon", tons: 42, target: 40 },
    { day: "Tue", tons: 58, target: 45 },
    { day: "Wed", tons: 65, target: 50 },
    { day: "Thu", tons: 52, target: 50 },
    { day: "Fri", tons: 74, target: 55 },
    { day: "Sat", tons: 38, target: 30 },
  ];

  const REVENUE_MARGIN_DATA = [
    { month: "May", revenue: 2.1, margin: 0.46 },
    { month: "Jun", revenue: 2.8, margin: 0.62 },
    { month: "Jul", revenue: 3.4, margin: 0.78 },
    { month: "Aug", revenue: 4.2, margin: 0.94 },
  ];

  // Gantt Chart Schedule Items
  const GANTT_ITEMS = [
    { project: "Dallas Warehouse", task: "Detailing & Approval", start: "Aug 01", end: "Aug 10", progress: 100, status: "complete", color: "bg-emerald-600" },
    { project: "Dallas Warehouse", task: "Steel Procurement", start: "Aug 08", end: "Aug 18", progress: 90, status: "complete", color: "bg-emerald-600" },
    { project: "Dallas Warehouse", task: "Shop Fabrication", start: "Aug 15", end: "Sep 05", progress: 65, status: "in_progress", color: "bg-indigo-600" },
    { project: "Austin Tech Campus", task: "Detailing & Approval", start: "Aug 05", end: "Aug 20", progress: 80, status: "in_progress", color: "bg-indigo-600" },
    { project: "Austin Tech Campus", task: "Shop Fabrication", start: "Aug 22", end: "Sep 20", progress: 25, status: "in_progress", color: "bg-amber-500" },
    { project: "Houston Energy Hub", task: "Surface Coating & Paint", start: "Aug 12", end: "Aug 22", progress: 95, status: "in_progress", color: "bg-sky-600" },
    { project: "Houston Energy Hub", task: "Site Delivery & Erection", start: "Aug 24", end: "Sep 15", progress: 10, status: "pending", color: "bg-slate-400" },
  ];

  return (
    <PageWrapper title="Steel Command Center">
      <div className="w-full max-w-full space-y-6 text-slate-900 font-sans">

        {/* TOP ROLE SELECTOR HEADER (Separate Dashboard Views Per Role) */}
        <div className="card p-5 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-900 flex items-center justify-center text-white font-bold shadow-md">
                <Factory size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-extrabold text-slate-950 tracking-tight">FabSimple MES Operating System</h1>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                    Texas Market Edition
                  </span>
                </div>
                <p className="text-xs text-slate-600 font-medium">Select a role below to launch its dedicated, role-specific dashboard view.</p>
              </div>
            </div>

            {/* Plant & Date Controls */}
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 font-bold text-slate-800">
                <MapPin size={14} className="text-indigo-700" />
                <select className="bg-transparent border-none outline-none font-bold text-slate-900 cursor-pointer" value={selectedPlant} onChange={(e) => setSelectedPlant(e.target.value)}>
                  <option value="Houston Fabrication Plant 1">Houston Fabrication Plant 1</option>
                  <option value="Dallas Heavy Structural Plant 2">Dallas Heavy Structural Plant 2</option>
                  <option value="San Antonio Material Yard">San Antonio Material Yard</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 font-bold text-slate-800">
                <Calendar size={14} className="text-emerald-700" />
                <select className="bg-transparent border-none outline-none font-bold text-slate-900 cursor-pointer" value={selectedDateRange} onChange={(e) => setSelectedDateRange(e.target.value)}>
                  <option value="This Month">This Month (August 2026)</option>
                  <option value="Q3 2026">Q3 2026</option>
                  <option value="YTD 2026">YTD 2026</option>
                </select>
              </div>
            </div>
          </div>

          {/* DEDICATED ROLE SWITCHER TABS */}
          <div className="pt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-extrabold uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
              <User size={14} className="text-indigo-700" /> DEDICATED DASHBOARD VIEWS:
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <RoleTab id="owner" label="1. Owner / CEO Dashboard" icon={<TrendingUp size={14} />} active={selectedRole} onClick={setSelectedRole} />
              <RoleTab id="pm" label="2. Project Manager Dashboard" icon={<Calendar size={14} />} active={selectedRole} onClick={setSelectedRole} />
              <RoleTab id="purchasing" label="3. Purchasing Dashboard" icon={<Layers size={14} />} active={selectedRole} onClick={setSelectedRole} />
              <RoleTab id="foreman" label="4. Shop Foreman (Mobile MES)" icon={<QrCode size={14} />} active={selectedRole} onClick={setSelectedRole} />
              <RoleTab id="qc" label="5. QC Inspector Dashboard" icon={<FileCheck size={14} />} active={selectedRole} onClick={setSelectedRole} />
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------------ */}
        {/* VIEW 1: OWNER / CEO EXECUTIVE DASHBOARD */}
        {/* ------------------------------------------------------------------ */}
        {selectedRole === "owner" && (
          <div className="space-y-6">
            <div className="card p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white rounded-2xl border border-slate-800 shadow-xl flex items-center justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                  <TrendingUp className="text-emerald-400" size={22} /> Owner & CEO Executive Control Center
                </h2>
                <p className="text-xs text-slate-300 mt-1">High-level financial performance, gross margin, material risk exposure, and Texas backlog.</p>
              </div>
              <div className="flex items-center gap-8 text-right font-mono">
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Total Active Backlog</div>
                  <div className="text-2xl font-bold text-emerald-400">$14,850,000</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Average Gross Margin</div>
                  <div className="text-2xl font-bold text-indigo-300">22.4%</div>
                </div>
              </div>
            </div>

            {/* Top Owner Executive Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <ExecutiveCard label="Active Backlog Revenue" value="$14.85M" sub="+18% vs Last Quarter" color="emerald" icon={<DollarSign size={18} />} />
              <ExecutiveCard label="Material Risk Exposure" value="$420,000" sub="5 Mill Shortages" color="amber" icon={<AlertTriangle size={18} />} />
              <ExecutiveCard label="Overall Production Health" value="92 / 100" sub="Excellent Output" color="indigo" icon={<Activity size={18} />} />
              <ExecutiveCard label="Texas Yard Steel Stock" value="1,100 Tons" sub="88% Mill Readiness" color="sky" icon={<Layers size={18} />} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Financial Revenue & Gross Margin Trend Area Chart */}
              <div className="card p-6 bg-white border border-slate-200 rounded-2xl shadow-sm lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <h3 className="font-extrabold text-base text-slate-950 flex items-center gap-2">
                    <BarChart2 size={18} className="text-indigo-700" /> Revenue Billed vs Gross Fab Profit Margin ($M)
                  </h3>
                  <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded">2026 Monthly Trend</span>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={REVENUE_MARGIN_DATA}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#334155", fontWeight: "bold" }} axisLine={false} />
                      <YAxis tick={{ fontSize: 12, fill: "#334155", fontWeight: "bold" }} axisLine={false} />
                      <Tooltip contentStyle={{ background: "#0F172A", border: "none", borderRadius: 8, color: "#FFF", fontSize: 12 }} />
                      <Area type="monotone" dataKey="revenue" stroke="#4F46E5" fill="#EEF2FF" strokeWidth={3} name="Revenue Billed ($M)" />
                      <Area type="monotone" dataKey="margin" stroke="#10B981" fill="#D1FAE5" strokeWidth={3} name="Gross Profit ($M)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Round Health Score Ring */}
              <div className="card p-6 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4 text-center flex flex-col justify-between">
                <h3 className="font-extrabold text-base text-slate-950 pb-3 border-b border-slate-200 flex items-center justify-center gap-2">
                  <Target size={18} className="text-indigo-700" /> Fabrication Health Ring
                </h3>
                <div className="relative h-48 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={[{ value: 92, fill: "#4F46E5" }, { value: 8, fill: "#E2E8F0" }]} cx="50%" cy="50%" innerRadius={60} outerRadius={85} startAngle={90} endAngle={-270} dataKey="value">
                        <Cell fill="#4F46E5" />
                        <Cell fill="#E2E8F0" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-3xl font-extrabold font-mono text-slate-950">92</span>
                    <span className="text-[11px] font-bold uppercase text-indigo-700">Health Score</span>
                  </div>
                </div>
                <div className="text-xs text-slate-700 font-semibold bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  92% On-Time Production Output across all 3 Texas Plants.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* VIEW 2: PROJECT MANAGER DASHBOARD & GANTT CHART */}
        {/* ------------------------------------------------------------------ */}
        {selectedRole === "pm" && (
          <div className="space-y-6">
            <div className="card p-5 bg-indigo-950 text-white rounded-2xl border border-indigo-800 shadow-xl flex items-center justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                  <Calendar className="text-indigo-400" size={22} /> Project Manager Control Center & Interactive Schedule Gantt Chart
                </h2>
                <p className="text-xs text-slate-300 mt-1">Track drawing approvals, material readiness, shop fabrication progress, and milestone deadlines.</p>
              </div>
              <span className="text-xs font-mono font-bold px-3 py-1 bg-indigo-900 border border-indigo-700 text-indigo-200 rounded-lg">
                24 Active Projects
              </span>
            </div>

            {/* INTERACTIVE GANTT CHART SCHEDULE WIDGET */}
            <div className="card p-6 bg-white border border-slate-200 rounded-2xl shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                <h3 className="font-extrabold text-base text-slate-950 flex items-center gap-2">
                  <Clock size={18} className="text-indigo-700" /> Interactive Master Project Schedule (Gantt Timeline)
                </h3>
                <span className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded">August - September 2026</span>
              </div>

              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-12 text-[11px] font-extrabold uppercase text-slate-700 border-b border-slate-200 pb-2">
                  <div className="col-span-3">Project & Phase Task</div>
                  <div className="col-span-2 text-center">Dates</div>
                  <div className="col-span-5">Schedule Timeline Progress</div>
                  <div className="col-span-2 text-right">Status</div>
                </div>

                {GANTT_ITEMS.map((g, idx) => (
                  <div key={idx} className="grid grid-cols-12 items-center text-xs py-2 border-b border-slate-100 hover:bg-slate-50 px-1 rounded-lg transition-all">
                    <div className="col-span-3 font-bold text-slate-950">
                      <span className="text-[10px] text-slate-600 block">{g.project}</span>
                      {g.task}
                    </div>
                    <div className="col-span-2 text-center font-mono font-bold text-slate-700">{g.start} - {g.end}</div>
                    <div className="col-span-5 px-2">
                      <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200 relative">
                        <div className={`h-full ${g.color} transition-all duration-300`} style={{ width: `${g.progress}%` }} />
                        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white font-mono drop-shadow">
                          {g.progress}%
                        </span>
                      </div>
                    </div>
                    <div className="col-span-2 text-right">
                      <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase ${g.status === "complete" ? "bg-emerald-100 text-emerald-900 border border-emerald-300" : g.status === "in_progress" ? "bg-indigo-100 text-indigo-900 border border-indigo-300" : "bg-slate-100 text-slate-800"}`}>
                        {g.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* PM Project Command Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <ProjectPmCard name="Dallas Warehouse Expansion" tons="500 Tons" drawings="Drawing Approval Complete" fabProgress={65} status="On Schedule" />
              <ProjectPmCard name="Austin Tech Campus Phase 2" tons="600 Tons" drawings="Rev 4 Approved" fabProgress={35} status="Material Delayed" isAlert />
              <ProjectPmCard name="Houston Energy Hub Platform" tons="800 Tons" drawings="Final Approval Complete" fabProgress={92} status="Ahead of Schedule" />
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* VIEW 3: PURCHASING MANAGER DASHBOARD */}
        {/* ------------------------------------------------------------------ */}
        {selectedRole === "purchasing" && (
          <div className="space-y-6">
            <div className="card p-5 bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-xl flex items-center justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                  <Layers className="text-emerald-400" size={22} /> Purchasing Manager & Texas Steel Mill Control Panel
                </h2>
                <p className="text-xs text-slate-300 mt-1">Manage open RFQs, vendor quotes, active purchase orders, and Texas mill stock availability.</p>
              </div>
              <span className="text-xs font-mono font-bold px-3 py-1 bg-emerald-900 border border-emerald-700 text-emerald-200 rounded-lg">
                32 Active Purchase Orders
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Round Inventory Allocation Donut Ring */}
              <div className="card p-6 bg-white border border-slate-200 rounded-2xl shadow-sm text-center flex flex-col justify-between">
                <h3 className="font-extrabold text-base text-slate-950 pb-3 border-b border-slate-200 flex items-center justify-center gap-2">
                  <Layers size={18} className="text-indigo-700" /> Inventory Allocation Donut Ring
                </h3>
                <div className="relative h-48 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={INVENTORY_DONUT_DATA} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                        {INVENTORY_DONUT_DATA.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: "#0F172A", borderRadius: 8, color: "#FFF", fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-extrabold font-mono text-slate-950">1,500</span>
                    <span className="text-[10px] font-bold uppercase text-slate-600">Total Steel Tons</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-1 text-[11px] font-bold border-t border-slate-200 pt-3">
                  <div className="text-emerald-700">1,100 Tons Yard</div>
                  <div className="text-indigo-700">300 Tons PO</div>
                  <div className="text-amber-700">100 Tons Short</div>
                </div>
              </div>

              {/* Texas Mill Delivery Status */}
              <div className="card p-6 bg-white border border-slate-200 rounded-2xl shadow-sm lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <h3 className="font-extrabold text-base text-slate-950 flex items-center gap-2">
                    <Truck size={18} className="text-emerald-700" /> Active POs & Texas Steel Mill Delivery Schedule
                  </h3>
                  <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded">32 Active Orders</span>
                </div>
                <div className="space-y-3 text-xs">
                  <PurchasingPoRow vendor="Nucor Steel Texas" po="PO-55678" material="W14x30 Beams" tons="180 Tons" status="On Schedule" date="Aug 04" />
                  <PurchasingPoRow vendor="Gerdau Texas Structural" po="PO-55692" material="HSS 8x8x1/2 Tubing" tons="95 Tons" status="Late (2 Days)" date="Aug 02" isLate />
                  <PurchasingPoRow vendor="Steel Dynamics (SDI)" po="PO-55701" material="PL 1/2 Plate Gussets" tons="220 Tons" status="In Transit" date="Aug 03" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* VIEW 4: SHOP FOREMAN MOBILE MES TERMINAL */}
        {/* ------------------------------------------------------------------ */}
        {selectedRole === "foreman" && (
          <div className="space-y-6">
            <div className="card p-6 bg-slate-900 border-2 border-indigo-600 rounded-2xl text-white shadow-2xl space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-lg">
                    <QrCode size={26} />
                  </div>
                  <div>
                    <h2 className="text-xl font-extrabold text-white">Shop Foreman Mobile MES Terminal</h2>
                    <p className="text-xs text-slate-300">Touch-first shop floor interface for saw operators, fitters, welders, and material handlers.</p>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold px-6 py-3.5 rounded-xl flex items-center gap-2 text-base shadow-xl animate-bounce"
                  onClick={() => setForemanAction("QR Code Scan Simulation: Bundle B-1025 scanned for Column C101")}
                >
                  <QrCode size={20} /> SCAN MEMBER QR CODE
                </button>
              </div>

              {/* Large Touch Actions */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button
                  type="button"
                  onClick={() => setForemanAction("Started Cutting operation on Saw #2 for Member Column C101")}
                  className="p-5 rounded-2xl bg-slate-800 hover:bg-indigo-900 border border-slate-700 flex flex-col items-center justify-center gap-3 text-white font-extrabold text-base transition-all shadow-lg active:scale-95"
                >
                  <Play size={24} className="text-emerald-400" />
                  START CUTTING
                </button>
                <button
                  type="button"
                  onClick={() => setForemanAction("Marked Saw Cutting Complete for Member Column C101")}
                  className="p-5 rounded-2xl bg-slate-800 hover:bg-indigo-900 border border-slate-700 flex flex-col items-center justify-center gap-3 text-white font-extrabold text-base transition-all shadow-lg active:scale-95"
                >
                  <Check size={24} className="text-sky-400" />
                  CUT COMPLETE
                </button>
                <button
                  type="button"
                  onClick={() => setForemanAction("Marked Fit-Up & Welding Fabrication Complete for Assembly A100")}
                  className="p-5 rounded-2xl bg-slate-800 hover:bg-indigo-900 border border-slate-700 flex flex-col items-center justify-center gap-3 text-white font-extrabold text-base transition-all shadow-lg active:scale-95"
                >
                  <Wrench size={24} className="text-amber-400" />
                  FAB COMPLETE
                </button>
                <button
                  type="button"
                  onClick={() => setForemanAction("Queued Assembly A100 into CWI VT/UT Inspection Station")}
                  className="p-5 rounded-2xl bg-slate-800 hover:bg-indigo-900 border border-slate-700 flex flex-col items-center justify-center gap-3 text-white font-extrabold text-base transition-all shadow-lg active:scale-95"
                >
                  <FileCheck size={24} className="text-purple-400" />
                  READY FOR QC
                </button>
              </div>

              {foremanAction && (
                <div className="p-4 rounded-xl bg-indigo-950 border border-indigo-500 text-xs font-mono font-bold text-indigo-200 flex items-center justify-between">
                  <span>{foremanAction}</span>
                  <button className="text-indigo-400 hover:text-white" onClick={() => setForemanAction(null)}>Dismiss</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------------ */}
        {/* VIEW 5: QC INSPECTOR DASHBOARD */}
        {/* ------------------------------------------------------------------ */}
        {selectedRole === "qc" && (
          <div className="space-y-6">
            <div className="card p-5 bg-purple-950 text-white rounded-2xl border border-purple-800 shadow-xl flex items-center justify-between">
              <div>
                <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                  <FileCheck className="text-purple-400" size={22} /> QC Inspector & AWS Certified Welding Inspection (CWI) Station
                </h2>
                <p className="text-xs text-slate-300 mt-1">Inspection queue, Mill Test Certificate (MTC) verification, Heat Number tracking, and VT/UT sign-off.</p>
              </div>
              <span className="text-xs font-mono font-bold px-3 py-1 bg-purple-900 border border-purple-700 text-purple-200 rounded-lg">
                15 Assemblies Queued
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Round CWI Pass Rate Ring */}
              <div className="card p-6 bg-white border border-slate-200 rounded-2xl shadow-sm text-center flex flex-col justify-between">
                <h3 className="font-extrabold text-base text-slate-950 pb-3 border-b border-slate-200 flex items-center justify-center gap-2">
                  <CheckCircle2 size={18} className="text-emerald-700" /> QC Inspection Pass Rate Ring
                </h3>
                <div className="relative h-48 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={QC_PASS_DONUT_DATA} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                        {QC_PASS_DONUT_DATA.map((entry, index) => (
                          <Cell key={index} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-3xl font-extrabold font-mono text-slate-950">96%</span>
                    <span className="text-[10px] font-bold uppercase text-emerald-800">Pass Rate</span>
                  </div>
                </div>
                <div className="text-xs font-bold text-emerald-800 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                  96% AWS D1.1 Inspection Passed on First Sign-off.
                </div>
              </div>

              {/* Inspection Queue Table */}
              <div className="card p-6 bg-white border border-slate-200 rounded-2xl shadow-sm lg:col-span-2 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                  <h3 className="font-extrabold text-base text-slate-950 flex items-center gap-2">
                    <FileCheck size={18} className="text-purple-700" /> Active CWI Inspection Queue (15 Items)
                  </h3>
                  <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded">AISC 303 Compliant</span>
                </div>
                <div className="space-y-3 text-xs">
                  <QcRow assembly="Assembly A100" project="Dallas Warehouse" heat="HN778822" type="CJP Weld VT/UT" status="Ready for CWI" />
                  <QcRow assembly="Column C101" project="Austin Tech Campus" heat="HN554411" type="Dimension & Plumb" status="Passed VT" isPassed />
                  <QcRow assembly="Beam B205" project="Houston Energy Hub" heat="HN992288" type="Fillet Weld VT" status="Passed VT" isPassed />
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </PageWrapper>
  );
}

// ---------------------------------------------------------------------------
// Helper Components
// ---------------------------------------------------------------------------

function RoleTab({ id, label, icon, active, onClick }: { id: any; label: string; icon: React.ReactNode; active: string; onClick: (id: any) => void }) {
  const isSelected = active === id;
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={`flex items-center gap-2 px-3.5 py-2 text-xs font-extrabold rounded-xl transition-all shadow-sm ${
        isSelected ? "bg-indigo-700 text-white" : "bg-slate-100 text-slate-800 border border-slate-200 hover:bg-slate-200"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function ExecutiveCard({ label, value, sub, color, icon }: { label: string; value: string; sub: string; color: string; icon: React.ReactNode }) {
  return (
    <div className="card p-5 bg-white border border-slate-200 rounded-2xl shadow-sm text-slate-900 space-y-2">
      <div className="flex items-center justify-between text-slate-700 font-bold text-xs">
        <span>{label}</span>
        <div className="p-2 rounded-xl bg-slate-100 border border-slate-200">{icon}</div>
      </div>
      <div className="text-2xl font-extrabold font-mono text-slate-950">{value}</div>
      <div className="text-[11px] font-bold text-indigo-700">{sub}</div>
    </div>
  );
}

function ProjectPmCard({ name, tons, drawings, fabProgress, status, isAlert }: { name: string; tons: string; drawings: string; fabProgress: number; status: string; isAlert?: boolean }) {
  return (
    <div className={`card p-5 bg-white border ${isAlert ? "border-amber-400 bg-amber-50/40" : "border-slate-200"} rounded-2xl shadow-sm text-slate-900 space-y-3`}>
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <h4 className="font-extrabold text-sm text-slate-950">{name}</h4>
        <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${isAlert ? "bg-amber-200 text-amber-950" : "bg-emerald-100 text-emerald-900"}`}>
          {status}
        </span>
      </div>
      <div className="space-y-1 text-xs">
        <div className="flex justify-between font-semibold"><span className="text-slate-600">Tonnage:</span> <strong className="text-slate-950 font-mono">{tons}</strong></div>
        <div className="flex justify-between font-semibold"><span className="text-slate-600">Drawings:</span> <strong className="text-indigo-900 font-mono">{drawings}</strong></div>
        <div className="pt-2">
          <div className="flex justify-between text-[11px] font-bold mb-1"><span>Fab Progress:</span> <span>{fabProgress}%</span></div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
            <div className="h-full bg-indigo-600" style={{ width: `${fabProgress}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function PurchasingPoRow({ vendor, po, material, tons, status, date, isLate }: { vendor: string; po: string; material: string; tons: string; status: string; date: string; isLate?: boolean }) {
  return (
    <div className={`flex items-center justify-between p-3 rounded-xl border ${isLate ? "border-red-300 bg-red-50/50" : "border-slate-100 bg-slate-50/50"}`}>
      <div>
        <div className="font-extrabold text-slate-950">{vendor} ({po})</div>
        <div className="text-[11px] text-slate-600 font-mono">{material} · {tons}</div>
      </div>
      <div className="text-right">
        <div className={`font-bold text-[11px] ${isLate ? "text-red-700" : "text-emerald-700"}`}>{status}</div>
        <div className="text-[10px] text-slate-600 font-mono">{date}</div>
      </div>
    </div>
  );
}

function QcRow({ assembly, project, heat, type, status, isPassed }: { assembly: string; project: string; heat: string; type: string; status: string; isPassed?: boolean }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/50">
      <div>
        <div className="font-extrabold text-slate-950">{assembly} ({project})</div>
        <div className="text-[11px] text-slate-600 font-mono">Heat: {heat} · Test: {type}</div>
      </div>
      <div>
        <span className={`text-[11px] font-extrabold px-2.5 py-1 rounded-full ${isPassed ? "bg-emerald-100 text-emerald-900 border border-emerald-300" : "bg-purple-100 text-purple-900 border border-purple-300"}`}>
          {status}
        </span>
      </div>
    </div>
  );
}
