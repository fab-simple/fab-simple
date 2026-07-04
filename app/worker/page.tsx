"use client";

// Mobile-first worker view. 375px target viewport.
// QR-first navigation. No sidebar, no nav — worker can only act on assigned parts.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useResourceList, FAB_MODE } from "@/hooks/useResource";
import { useAppSelector } from "@/hooks/useAppRedux";
import { createClient } from "@/lib/supabase/client";
import { StatusPill } from "@/components/ui/StatusPill";
import { Loader2, LogOut, QrCode, ChevronRight, Check } from "lucide-react";

interface Part {
  id: string;
  part_mark: string;
  profile: string;
  status: string;
  assembly_mark: string | null;
  heat_number: string | null;
  weight: number | null;
  assigned_user_id: string | null;
  cut_completed_at: string | null;
  fit_completed_at: string | null;
  fit_skipped: boolean | null;
  weld_completed_at: string | null;
  weld_skipped: boolean | null;
  finish_completed_at: string | null;
  insp_completed_at: string | null;
}

const STATIONS = [
  { id: "assigned", label: "My Assigned" },
  { id: "cut", label: "Cutting" },
  { id: "fit", label: "Fit-Up" },
  { id: "weld", label: "Welding" },
  { id: "paint", label: "Painting" },
  { id: "insp", label: "Inspection" },
];

export default function WorkerPage() {
  const auth = useAppSelector((s) => s.auth);
  const router = useRouter();
  const list = useResourceList<Part>("parts", { order_by: "updated_at", dir: "desc" }, {
    enabled: FAB_MODE === "live" && !!auth.userId,
  });
  const [activeStation, setActiveStation] = useState<string>("assigned");

  async function signOut() {
    const sb = createClient();
    await sb.auth.signOut();
    window.location.href = "/auth/signin";
  }

  const filteredParts = (list.data ?? []).filter((p) => {
    if (activeStation === "assigned") {
      return p.assigned_user_id === auth.userId;
    }
    if (activeStation === "cut") {
      return !p.cut_completed_at;
    }
    if (activeStation === "fit") {
      return p.cut_completed_at && !p.fit_completed_at && !p.fit_skipped;
    }
    if (activeStation === "weld") {
      return (p.fit_completed_at || p.fit_skipped) && !p.weld_completed_at && !p.weld_skipped;
    }
    if (activeStation === "paint") {
      return (p.weld_completed_at || p.weld_skipped) && !p.finish_completed_at;
    }
    if (activeStation === "insp") {
      return p.finish_completed_at && !p.insp_completed_at;
    }
    return true;
  });

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0B1120",
      color: "#F8FAFC",
      maxWidth: 420,
      margin: "0 auto",
      padding: "20px 16px 100px",
    }}>
      <header className="flex items-center justify-between" style={{ marginBottom: 20 }}>
        <div>
          <div className="text-[20px] font-extrabold tracking-tight">Shop Floor Queue</div>
          <div className="text-[12px] font-medium" style={{ color: "#94A3B8" }}>{auth.name} · {auth.role}</div>
        </div>
        <button onClick={signOut} className="p-2.5 rounded-xl border border-white/10 hover:bg-white/5 transition-colors cursor-pointer text-[#94A3B8]">
          <LogOut size={18} />
        </button>
      </header>

      {/* Large Glove-Friendly Scan button */}
      <button
        className="w-full rounded-2xl flex items-center justify-center gap-3 mb-6 transition-all hover:scale-[1.01] active:scale-[0.99] border-0 cursor-pointer shadow-lg shadow-indigo-600/10"
        style={{ background: "var(--primary)", color: "white", fontSize: 16, fontWeight: 800, height: 64 }}
        onClick={() => router.push("/worker/scan")}
      >
        <QrCode size={22} /> Scan Part QR Code
      </button>

      {/* Glove-friendly station select horizontal scroll bar */}
      <div className="flex gap-2 overflow-x-auto !pb-3 mb-4 scrollbar-hide snap-x">
        {STATIONS.map((st) => (
          <button
            key={st.id}
            onClick={() => setActiveStation(st.id)}
            className="px-5 py-3 rounded-xl font-extrabold text-[13.5px] transition-all cursor-pointer whitespace-nowrap snap-center border"
            style={{
              background: activeStation === st.id ? "rgba(99, 102, 241, 0.15)" : "rgba(255, 255, 255, 0.02)",
              color: activeStation === st.id ? "#818cf8" : "var(--muted)",
              borderColor: activeStation === st.id ? "rgba(99, 102, 241, 0.4)" : "border-white/5",
              minHeight: 46
            }}
          >
            {st.label}
          </button>
        ))}
      </div>

      <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
        Parts ({filteredParts.length})
      </div>

      <PartQueue
        parts={filteredParts}
        loading={list.isLoading}
        onPick={(p) => router.push(`/worker/parts/${p.id}`)}
      />
    </div>
  );
}

function PartQueue({ parts, loading, onPick }: { parts: Part[]; loading: boolean; onPick: (p: Part) => void }) {
  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60, color: "#94A3B8" }}>
        <Loader2 size={20} className="animate-spin text-indigo-400" /> <span style={{ marginLeft: 12, fontWeight: 600 }}>Loading Queue…</span>
      </div>
    );
  }
  if (!parts.length) {
    return (
      <div style={{ textAlign: "center", padding: 48, color: "#94A3B8", borderRadius: 16, background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.1)" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
        <div className="text-[16px] font-extrabold text-white">All caught up</div>
        <div className="text-[12.5px] mt-1" style={{ color: "#64748B" }}>No parts pending at this station.</div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {parts.map((p) => (
        <button
          key={p.id}
          onClick={() => onPick(p)}
          className="w-full p-4 rounded-xl flex items-center justify-between border border-white/5 hover:border-white/10 transition-all cursor-pointer bg-white/[0.02] text-left active:bg-white/[0.04]"
          style={{ minHeight: 76 }}
        >
          <div>
            <div className="text-[16px] font-extrabold font-mono text-white leading-tight">{p.part_mark}</div>
            <div className="text-[12.5px] mt-1" style={{ color: "#94A3B8" }}>{p.profile} · {p.heat_number ?? "no heat"}</div>
            <div style={{ marginTop: 8 }}><StatusPill status={p.status} size="sm" /></div>
          </div>
          <ChevronRight size={20} style={{ color: "#64748B" }} />
        </button>
      ))}
    </div>
  );
}
