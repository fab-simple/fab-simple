"use client";

// Mobile-first worker view. 375px target viewport. 3-tap status updates.
// QR-first navigation. No sidebar, no nav — worker can only act on assigned parts.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useResourceList, useUpdate, FAB_MODE } from "@/hooks/useResource";
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
}

const NEXT_STATUS: Record<string, string> = {
  not_started: "in_progress",
  in_progress: "complete",
};

const STATUS_LABEL: Record<string, string> = {
  not_started: "Start work",
  in_progress: "Mark complete",
  complete: "Completed",
  shipped: "Shipped",
};

export default function WorkerPage() {
  const auth = useAppSelector((s) => s.auth);
  const router = useRouter();
  const list = useResourceList<Part>("parts", { assigned_user_id: auth.userId ?? "", order_by: "updated_at", dir: "desc" }, {
    enabled: FAB_MODE === "live" && !!auth.userId,
  });
  const update = useUpdate<Part>("parts");
  const [selected, setSelected] = useState<Part | null>(null);

  async function signOut() {
    const sb = createClient();
    await sb.auth.signOut();
    window.location.href = "/auth/signin";
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0F172A",
      color: "white",
      maxWidth: 420,
      margin: "0 auto",
      padding: "16px 16px 100px",
    }}>
      <header className="flex items-center justify-between" style={{ marginBottom: 24 }}>
        <div>
          <div className="text-[18px] font-bold">My Queue</div>
          <div className="text-[12px]" style={{ color: "#94A3B8" }}>{auth.name} · {auth.role}</div>
        </div>
        <button onClick={signOut} className="p-2 rounded-md" style={{ background: "transparent", border: "1px solid #1E293B", color: "#94A3B8" }}>
          <LogOut size={16} />
        </button>
      </header>

      <button
        className="w-full p-4 rounded-xl flex items-center justify-center gap-3 mb-6"
        style={{ background: "#4F46E5", color: "white", border: "none", fontSize: 15, fontWeight: 700 }}
        onClick={() => router.push("/worker/scan")}
      >
        <QrCode size={20} /> Scan part QR code
      </button>

      {selected ? (
        <PartDetail
          part={selected}
          onBack={() => setSelected(null)}
          onAdvance={(nextStatus) => {
            update.mutate({ id: selected.id, body: { status: nextStatus } }, {
              onSuccess: () => setSelected(null),
            });
          }}
          pending={update.isPending}
          error={update.error?.message ?? null}
        />
      ) : (
        <PartQueue parts={list.data ?? []} loading={list.isLoading} onPick={setSelected} />
      )}
    </div>
  );
}

function PartQueue({ parts, loading, onPick }: { parts: Part[]; loading: boolean; onPick: (p: Part) => void }) {
  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 40, color: "#94A3B8" }}>
        <Loader2 size={18} className="animate-spin" /> <span style={{ marginLeft: 10 }}>Loading…</span>
      </div>
    );
  }
  if (!parts.length) {
    return (
      <div style={{ textAlign: "center", padding: 32, color: "#94A3B8", borderRadius: 12, background: "#1E293B" }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
        <div className="text-[15px] font-semibold">All caught up</div>
        <div className="text-[12px]" style={{ color: "#64748B" }}>No parts assigned to you right now.</div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {parts.map((p) => (
        <button
          key={p.id}
          onClick={() => onPick(p)}
          className="w-full p-4 rounded-xl flex items-center justify-between"
          style={{ background: "#1E293B", border: "1px solid #334155", color: "white", cursor: "pointer" }}
        >
          <div style={{ textAlign: "left" }}>
            <div className="text-[15px] font-bold font-mono">{p.part_mark}</div>
            <div className="text-[12px]" style={{ color: "#94A3B8" }}>{p.profile} · {p.heat_number ?? "no heat"}</div>
            <div style={{ marginTop: 6 }}><StatusPill status={p.status} size="sm" /></div>
          </div>
          <ChevronRight size={20} style={{ color: "#64748B" }} />
        </button>
      ))}
    </div>
  );
}

function PartDetail({
  part, onBack, onAdvance, pending, error,
}: {
  part: Part;
  onBack: () => void;
  onAdvance: (nextStatus: string) => void;
  pending: boolean;
  error: string | null;
}) {
  const next = NEXT_STATUS[part.status];
  return (
    <div>
      <button onClick={onBack} className="text-[13px] mb-4" style={{ background: "transparent", border: "none", color: "#94A3B8", cursor: "pointer" }}>
        ← Back to queue
      </button>

      <div className="rounded-xl p-5" style={{ background: "#1E293B", border: "1px solid #334155", marginBottom: 16 }}>
        <div className="text-[24px] font-bold font-mono">{part.part_mark}</div>
        <div className="text-[14px]" style={{ color: "#94A3B8", marginTop: 4 }}>{part.profile}</div>
        <div style={{ marginTop: 10 }}><StatusPill status={part.status} /></div>

        <div className="grid-2" style={{ gap: 12, marginTop: 20 }}>
          <div>
            <div className="text-[10px] uppercase font-semibold tracking-wider" style={{ color: "#64748B" }}>Assembly</div>
            <div className="text-[14px] font-mono">{part.assembly_mark ?? "—"}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-semibold tracking-wider" style={{ color: "#64748B" }}>Heat #</div>
            <div className="text-[14px] font-mono">{part.heat_number ?? "—"}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase font-semibold tracking-wider" style={{ color: "#64748B" }}>Weight</div>
            <div className="text-[14px] font-mono">{part.weight ? `${part.weight} lb` : "—"}</div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-md p-3" style={{ background: "#7F1D1D", color: "#FEE2E2", marginBottom: 12, fontSize: 13 }}>
          {error}
        </div>
      )}

      {next ? (
        <button
          onClick={() => onAdvance(next)}
          disabled={pending}
          className="w-full p-5 rounded-xl flex items-center justify-center gap-3"
          style={{ background: "#16A34A", color: "white", border: "none", fontSize: 16, fontWeight: 700 }}
        >
          {pending ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
          {STATUS_LABEL[part.status]}
        </button>
      ) : (
        <div className="text-center" style={{ color: "#94A3B8", fontSize: 13 }}>This part is already completed.</div>
      )}
    </div>
  );
}
