"use client";

import { use, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useResource, useUpdate } from "@/hooks/useResource";
import { uploadFile } from "@/lib/api";
import { StatusPill } from "@/components/ui/StatusPill";
import { Loader2, ChevronLeft, Check, Camera, X } from "lucide-react";

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

export default function WorkerPartPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: part, isLoading, error } = useResource<Part>("parts", id);
  const update = useUpdate<Part>("parts");
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoCount, setPhotoCount] = useState(0);
  const [photoErr, setPhotoErr] = useState<string | null>(null);

  async function snap(file: File) {
    setPhotoBusy(true); setPhotoErr(null);
    try {
      await uploadFile({ file, entity_type: "parts", entity_id: id, bucket: "photos" });
      setPhotoCount((n) => n + 1);
    } catch (e) {
      setPhotoErr(e instanceof Error ? e.message : "Upload failed");
    } finally { setPhotoBusy(false); }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0F172A", color: "white", maxWidth: 420, margin: "0 auto", padding: "16px 16px 100px" }}>
      <header className="flex items-center justify-between mb-4">
        <button onClick={() => router.push("/worker")} className="flex items-center gap-1" style={{ background: "transparent", border: "none", color: "#94A3B8", cursor: "pointer", fontSize: 13 }}>
          <ChevronLeft size={16} /> Queue
        </button>
        <button onClick={() => router.push("/worker/scan")} className="p-2 rounded-md" style={{ background: "transparent", border: "1px solid #1E293B", color: "#94A3B8" }}>
          <X size={16} />
        </button>
      </header>

      {isLoading && (
        <div className="text-center" style={{ color: "#94A3B8", padding: 40 }}>
          <Loader2 size={20} className="animate-spin inline" /> Loading…
        </div>
      )}
      {error && (
        <div className="rounded-md p-3" style={{ background: "#7F1D1D", color: "#FEE2E2", fontSize: 13 }}>
          {error.message}
        </div>
      )}

      {part && (
        <>
          <div className="rounded-xl p-5" style={{ background: "#1E293B", border: "1px solid #334155", marginBottom: 16 }}>
            <div className="text-[24px] font-bold font-mono">{part.part_mark}</div>
            <div className="text-[14px]" style={{ color: "#94A3B8", marginTop: 4 }}>{part.profile}</div>
            <div style={{ marginTop: 10 }}><StatusPill status={part.status} /></div>

            <div className="grid-2" style={{ gap: 12, marginTop: 20 }}>
              <Info label="Assembly" value={part.assembly_mark ?? "—"} />
              <Info label="Heat #" value={part.heat_number ?? "—"} />
              <Info label="Weight" value={part.weight ? `${part.weight} lb` : "—"} />
            </div>
          </div>

          {/* Photo capture */}
          <div className="rounded-xl p-4 mb-4" style={{ background: "#1E293B", border: "1px solid #334155" }}>
            <div className="text-[13px] font-semibold mb-2" style={{ color: "#E2E8F0" }}>Photos / evidence</div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: "none" }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) snap(f); e.target.value = ""; }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={photoBusy}
              className="w-full p-3 rounded-lg flex items-center justify-center gap-2"
              style={{ background: "#334155", color: "white", border: "none", fontSize: 14, fontWeight: 600 }}
            >
              {photoBusy ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
              {photoBusy ? "Uploading…" : photoCount > 0 ? `Add another photo (${photoCount} attached)` : "Take photo"}
            </button>
            {photoErr && <div className="text-[12px] mt-2" style={{ color: "#FCA5A5" }}>{photoErr}</div>}
          </div>

          {NEXT_STATUS[part.status] ? (
            <button
              onClick={() => update.mutate({ id: part.id, body: { status: NEXT_STATUS[part.status] } }, {
                onSuccess: () => router.push("/worker"),
              })}
              disabled={update.isPending}
              className="w-full p-5 rounded-xl flex items-center justify-center gap-3"
              style={{ background: "#16A34A", color: "white", border: "none", fontSize: 16, fontWeight: 700 }}
            >
              {update.isPending ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
              {STATUS_LABEL[part.status]}
            </button>
          ) : (
            <div className="text-center" style={{ color: "#94A3B8", fontSize: 13 }}>This part is already completed.</div>
          )}
        </>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase font-semibold tracking-wider" style={{ color: "#64748B" }}>{label}</div>
      <div className="text-[14px] font-mono">{value}</div>
    </div>
  );
}
