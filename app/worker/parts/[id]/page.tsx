"use client";

import { use, useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useResource, useUpdate, useResourceList, useCreate } from "@/hooks/useResource";
import { useAppSelector } from "@/hooks/useAppRedux";
import { uploadFile, FabAPI } from "@/lib/api";
import { StatusPill } from "@/components/ui/StatusPill";
import Link from "next/link";
import {
  Loader2,
  ChevronLeft,
  Check,
  Camera,
  X,
  FileText,
  RefreshCw,
  Scissors,
  Hammer,
  Zap,
  Paintbrush,
  ShieldAlert,
  User,
  Calendar,
  Clock,
  Printer,
  Wifi,
  WifiOff,
  Edit2
} from "lucide-react";

interface Part {
  id: string;
  part_mark: string;
  profile: string;
  status: string;
  grade?: string | null;
  assembly_mark: string | null;
  heat_number: string | null;
  finish?: string | null;
  weight: number | null;
  project_name?: string | null;
  project_number?: string | null;
  cut_completed_by: string | null;
  cut_completed_at: string | null;
  cut_hours: number | null;
  cut_drop_length: string | null;
  fit_completed_by: string | null;
  fit_completed_at: string | null;
  fit_hours: number | null;
  fit_skipped: boolean | null;
  weld_completed_by: string | null;
  weld_completed_at: string | null;
  weld_qc_by: string | null;
  weld_qc_at: string | null;
  weld_hours: number | null;
  weld_skipped: boolean | null;
  finish_completed_by: string | null;
  finish_completed_at: string | null;
  finish_hours: number | null;
  insp_completed_by: string | null;
  insp_completed_at: string | null;
}

interface PublicDrawing {
  id: string;
  filename: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  url: string | null;
}

interface UserRow {
  id: string;
  full_name: string;
  role: string;
}

interface OfflineAction {
  id: string;
  partId: string;
  payload: Partial<Part>;
  timestamp: string;
}

export default function WorkerPartPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const auth = useAppSelector((s) => s.auth);

  // Authenticated hooks
  const { data: authPart, isLoading: authLoading, error: authError, refetch } = useResource<Part>("parts", id);
  const update = useUpdate<Part>("parts");
  const createInventory = useCreate<any>("inventory");
  const usersList = useResourceList<UserRow>("users");

  // Public/offline data state
  const [publicData, setPublicData] = useState<{ part: Part; drawings: PublicDrawing[] } | null>(null);
  const [publicLoading, setPublicLoading] = useState(true);
  const [publicError, setPublicError] = useState<string | null>(null);

  // Drawing PDF state
  const [drawings, setDrawings] = useState<PublicDrawing[]>([]);
  const [activeDrawingId, setActiveDrawingId] = useState<string | null>(null);
  const [isFullscreenPdf] = useState(false);

  // Photo state
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoCount, setPhotoCount] = useState(0);
  const [photoErr, setPhotoErr] = useState<string | null>(null);

  // Reassignment Modal state
  const [reassignField, setReassignField] = useState<keyof Part | null>(null);

  // Offline actions queue state
  const [isOnline, setIsOnline] = useState(typeof window !== "undefined" ? navigator.onLine : true);
  const [offlineQueue, setOfflineQueue] = useState<OfflineAction[]>([]);
  const [localPart, setLocalPart] = useState<Part | null>(null);

  // Fetch public data
  const loadPublicData = useCallback(() => {
    let cancelled = false;
    setPublicLoading(true);
    setPublicError(null);

    const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "https://mteocbcpbdgfdysulmiv.supabase.co/functions/v1/api";
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    const url = `${apiBase}/public/parts/${id}`;

    fetch(url, { headers: { apikey: anonKey } })
      .then((res) => res.json())
      .then((res) => {
        if (cancelled) return;
        if (res.ok && res.data) {
          setPublicData(res.data);
          const drawList: PublicDrawing[] = res.data.drawings || [];
          setDrawings(drawList);
          if (drawList.length > 0 && drawList[0].url) {
            setActiveDrawingId(drawList[0].id);
          }
        } else {
          setPublicError(res.error?.message || "Could not load part details");
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setPublicError(err instanceof Error ? err.message : "Network error");
        }
      })
      .finally(() => {
        if (!cancelled) setPublicLoading(false);
      });

    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    loadPublicData();
  }, [loadPublicData]);

  // Combine authenticated + public part details
  const apiPart: Part | null = authPart
    ? {
        ...authPart,
        project_name: publicData?.part.project_name ?? authPart.project_name,
        project_number: publicData?.part.project_number ?? authPart.project_number,
      }
    : publicData?.part ?? null;

  // Sync state to optimistically updated localPart
  useEffect(() => {
    if (apiPart) {
      setLocalPart(apiPart);
    }
  }, [authPart, publicData]);

  // Listen for online status & local offline queue
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      setIsOnline(true);
      flushQueue();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial queue load
    const stored = localStorage.getItem(`fab_offline_queue_${id}`);
    if (stored) {
      setOfflineQueue(JSON.parse(stored));
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [id]);

  // Flush offline queue to database
  const flushQueue = async () => {
    const stored = localStorage.getItem(`fab_offline_queue_${id}`);
    if (!stored) return;
    const queue: OfflineAction[] = JSON.parse(stored);
    if (queue.length === 0) return;

    for (const item of queue) {
      try {
        await FabAPI.update("parts", item.partId, item.payload);
      } catch (err) {
        console.warn("Failed to sync offline item", err);
      }
    }

    localStorage.removeItem(`fab_offline_queue_${id}`);
    setOfflineQueue([]);
    refetch();
    loadPublicData();
  };

  // Perform optimistic update and trigger queue
  const triggerAction = async (payload: Partial<Part>) => {
    if (!localPart) return;

    // Trigger haptic feedback
    if (typeof window !== "undefined" && navigator.vibrate) {
      navigator.vibrate([80, 50, 80]);
    }

    // Update locally immediately
    const updated = { ...localPart, ...payload };
    setLocalPart(updated);

    if (navigator.onLine) {
      update.mutate(
        { id, body: payload },
        {
          onSuccess: () => {
            refetch();
            loadPublicData();
          },
        }
      );
    } else {
      // Save offline action
      const actionItem: OfflineAction = {
        id: Math.random().toString(),
        partId: id,
        payload,
        timestamp: new Date().toISOString(),
      };
      const nextQueue = [...offlineQueue, actionItem];
      setOfflineQueue(nextQueue);
      localStorage.setItem(`fab_offline_queue_${id}`, JSON.stringify(nextQueue));
    }
  };

  const isQC = auth.role === "qc" || auth.role === "owner" || auth.role === "pm" || auth.role === "foreman";

  // Reassign "By" complete fields
  const applyReassignment = (userId: string) => {
    if (!reassignField) return;
    triggerAction({ [reassignField]: userId });
    setReassignField(null);
  };

  // Parse text drop length to numeric value
  const parseLength = (raw: string): number => {
    const match = raw.match(/[\d\.]+/);
    return match ? parseFloat(match[0]) : 0;
  };

  // Register and print drop label
  const printDropLabel = async (dropLength: string) => {
    if (!localPart) return;
    const lengthNum = parseLength(dropLength);
    if (!lengthNum) return;

    await createInventory.mutateAsync({
      profile: localPart.profile,
      grade: localPart.grade || "A36",
      length: lengthNum,
      quantity: 1,
      location: "Offcuts Bay",
    });

    // Output printed sheet tag
    const html = `
      <html><head><title>Remnant Drop Tag</title>
      <style>
        body { font-family: system-ui, sans-serif; padding: 20px; text-align: center; }
        .card { border: 2px solid #000; border-radius: 8px; padding: 24px; max-width: 320px; margin: auto; }
        .hdr { font-weight: 800; font-size: 20px; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; }
        .meta { font-family: monospace; font-size: 15px; text-align: left; line-height: 1.6; }
        .badge { display: inline-block; background: #000; color: #fff; padding: 4px 8px; font-size: 13px; font-weight: bold; border-radius: 4px; margin-top: 10px; }
      </style></head>
      <body>
        <div class="card">
          <div class="hdr">REMNANT OFF-CUT</div>
          <div class="meta">
            <strong>PROFILE:</strong> ${localPart.profile}<br/>
            <strong>GRADE:</strong> ${localPart.grade || "A36"}<br/>
            <strong>DROP LENGTH:</strong> ${dropLength}<br/>
            <strong>ORIGINAL HEAT #:</strong> ${localPart.heat_number || "Unassigned"}<br/>
            <strong>PART SOURCE:</strong> ${localPart.part_mark}
          </div>
          <div class="badge">INVENTORY REMNANT</div>
        </div>
        <script>window.onload = function() { window.print(); }</script>
      </body></html>
    `;
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  };

  const printPaperTraveller = () => {
    if (!localPart) return;

    const users = usersList.data ?? [];
    const userName = (uid: string | null) => {
      if (!uid) return "";
      const u = users.find((u) => u.id === uid);
      return u ? u.full_name : uid.slice(0, 8);
    };
    const fmtDate = (iso: string | null) => {
      if (!iso) return "";
      return new Date(iso).toLocaleString();
    };
    const fmtHours = (h: number | null) => (h != null && h > 0 ? String(h) : "");

    // Pre-compute row data for each stage
    const cutBy = userName(localPart.cut_completed_by);
    const cutDate = fmtDate(localPart.cut_completed_at);
    const cutHrs = fmtHours(localPart.cut_hours);
    const cutNotes = localPart.cut_drop_length ? `Drop: ${localPart.cut_drop_length}` : "";

    const fitBy = localPart.fit_skipped ? "SKIPPED" : userName(localPart.fit_completed_by);
    const fitDate = localPart.fit_skipped ? "N/A" : fmtDate(localPart.fit_completed_at);
    const fitHrs = localPart.fit_skipped ? "—" : fmtHours(localPart.fit_hours);
    const fitNotes = localPart.fit_skipped ? "[✓] Skipped" : "";

    const weldBy = localPart.weld_skipped ? "SKIPPED" : userName(localPart.weld_completed_by);
    const weldDate = localPart.weld_skipped ? "N/A" : fmtDate(localPart.weld_completed_at);
    const weldHrs = localPart.weld_skipped ? "—" : fmtHours(localPart.weld_hours);
    const weldNotes = localPart.weld_skipped ? "[✓] Skipped" : "";

    const weldQcBy = userName(localPart.weld_qc_by);
    const weldQcDate = fmtDate(localPart.weld_qc_at);
    const weldQcNotes = localPart.weld_qc_at ? "[✓] Pass" : "";

    const finishBy = userName(localPart.finish_completed_by);
    const finishDate = fmtDate(localPart.finish_completed_at);
    const finishHrs = fmtHours(localPart.finish_hours);

    const inspBy = userName(localPart.insp_completed_by);
    const inspDate = fmtDate(localPart.insp_completed_at);
    const inspNotes = localPart.insp_completed_at ? "[✓] Pass" : "";

    // Status summary
    const completedCount = [
      localPart.cut_completed_at,
      localPart.fit_completed_at || localPart.fit_skipped,
      localPart.weld_completed_at || localPart.weld_skipped,
      localPart.finish_completed_at,
      localPart.insp_completed_at,
    ].filter(Boolean).length;

    // Cell style helper — highlight completed rows with a light green bg
    const doneBg = (val: string | null | boolean) => val ? "background: #f0fdf4;" : "";

    const html = `
      <html><head><title>Traveller Sheet — ${localPart.part_mark}</title>
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; padding: 30px; color: #000; }
        .hdr { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px double #000; padding-bottom: 12px; margin-bottom: 20px; }
        .title { font-size: 22px; font-weight: 900; letter-spacing: 0.5px; }
        .job { font-family: monospace; font-size: 13px; font-weight: bold; }
        .summary { display: inline-block; font-size: 12px; font-weight: bold; padding: 4px 10px; border-radius: 4px; margin-left: 12px; }
        .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 24px; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; }
        .meta-item { font-size: 11px; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; }
        .meta-val { font-family: monospace; font-size: 14px; font-weight: bold; color: #0f172a; margin-top: 4px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; }
        th, td { border: 1px solid #94a3b8; padding: 10px 12px; text-align: left; font-size: 12px; }
        th { background: #e2e8f0; font-weight: 700; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; }
        .done { background: #f0fdf4; }
        .skipped { background: #fefce8; color: #92400e; font-style: italic; }
        .empty { color: #cbd5e1; }
        .stage-name { font-weight: 700; }
        .footer { margin-top: 40px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 12px; }
        @media print {
          body { padding: 15px; }
          .no-print { display: none; }
        }
      </style></head>
      <body>
        <div class="hdr">
          <div>
            <span class="title">FABSIMPLE TRAVELLER SHEET</span>
            <span class="summary" style="background: ${completedCount >= 5 ? "#dcfce7; color: #166534" : "#fef3c7; color: #92400e"}">${completedCount}/5 Stages Done</span>
          </div>
          <div class="job">JOB: ${localPart.project_number ?? "—"} &bull; ${localPart.project_name ?? "—"}</div>
        </div>

        <div class="meta-grid">
          <div class="meta-item">Piece Mark<div class="meta-val">${localPart.part_mark}</div></div>
          <div class="meta-item">Profile<div class="meta-val">${localPart.profile}</div></div>
          <div class="meta-item">Heat Number<div class="meta-val">${localPart.heat_number ?? "—"}</div></div>
          <div class="meta-item">Finish Spec<div class="meta-val">${localPart.finish ?? "SHOP PRIMER"}</div></div>
        </div>

        <h3 style="margin-bottom: 4px;">Shop Floor Sign-Off Timeline</h3>
        <p style="font-size: 11px; color: #64748b; margin-top: 0;">Tracked statuses are auto-populated. Blank cells can be filled by hand as a fallback.</p>

        <table>
          <thead>
            <tr>
              <th style="width: 22%;">Stage</th>
              <th style="width: 22%;">Completed By</th>
              <th style="width: 22%;">Date / Time</th>
              <th style="width: 12%;">Hours</th>
              <th style="width: 22%;">Notes</th>
            </tr>
          </thead>
          <tbody>
            <tr class="${localPart.cut_completed_at ? "done" : ""}">
              <td class="stage-name">1. Cutting <span style="font-weight:400;color:#64748b;">(Self-Check)</span></td>
              <td>${cutBy || '<span class="empty">_______________</span>'}</td>
              <td>${cutDate || '<span class="empty">_______________</span>'}</td>
              <td>${cutHrs || '<span class="empty">____</span>'}</td>
              <td>${cutNotes || "Drop Length: ________"}</td>
            </tr>
            <tr class="${localPart.fit_completed_at ? "done" : localPart.fit_skipped ? "skipped" : ""}">
              <td class="stage-name">2. Fit-Up <span style="font-weight:400;color:#64748b;">(Self-Check)</span></td>
              <td>${fitBy || '<span class="empty">_______________</span>'}</td>
              <td>${fitDate || '<span class="empty">_______________</span>'}</td>
              <td>${fitHrs || '<span class="empty">____</span>'}</td>
              <td>${fitNotes || "[ ] Skip Fit-Up"}</td>
            </tr>
            <tr class="${localPart.weld_completed_at ? "done" : localPart.weld_skipped ? "skipped" : ""}">
              <td class="stage-name">3. Welding <span style="font-weight:400;color:#64748b;">(AWS D1.1)</span></td>
              <td>${weldBy || '<span class="empty">_______________</span>'}</td>
              <td>${weldDate || '<span class="empty">_______________</span>'}</td>
              <td>${weldHrs || '<span class="empty">____</span>'}</td>
              <td>${weldNotes || "[ ] Skip Weld"}</td>
            </tr>
            <tr class="${localPart.weld_qc_at ? "done" : ""}">
              <td class="stage-name">Weld QC Sign-off <span style="font-weight:400;color:#64748b;">(CWI)</span></td>
              <td>${weldQcBy || '<span class="empty">_______________</span>'}</td>
              <td>${weldQcDate || '<span class="empty">_______________</span>'}</td>
              <td style="background: #e2e8f0; text-align:center;">N/A</td>
              <td>${weldQcNotes || "Result: [ ] Pass [ ] Fail"}</td>
            </tr>
            <tr class="${localPart.finish_completed_at ? "done" : ""}">
              <td class="stage-name">4. Paint / Coating</td>
              <td>${finishBy || '<span class="empty">_______________</span>'}</td>
              <td>${finishDate || '<span class="empty">_______________</span>'}</td>
              <td>${finishHrs || '<span class="empty">____</span>'}</td>
              <td>DFT Mils: ________</td>
            </tr>
            <tr class="${localPart.insp_completed_at ? "done" : ""}">
              <td class="stage-name">5. Final Inspection <span style="font-weight:400;color:#64748b;">(CWI Gate)</span></td>
              <td>${inspBy || '<span class="empty">_______________</span>'}</td>
              <td>${inspDate || '<span class="empty">_______________</span>'}</td>
              <td style="background: #e2e8f0; text-align:center;">N/A</td>
              <td>${inspNotes || "Result: [ ] Pass [ ] Fail"}</td>
            </tr>
          </tbody>
        </table>

        <div class="footer">
          Generated ${new Date().toLocaleString()} via FabSimple Shop Traveller Engine &bull; Print Date: ${new Date().toLocaleDateString()}
        </div>

        <script>window.onload = function() { window.print(); }</script>
      </body></html>
    `;
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  };

  // Stage status helper
  const getStageStatus = (
    completedAt: string | null,
    skipped: boolean | null = false,
    qcAt: string | null = null
  ) => {
    if (skipped) return "skipped";
    if (completedAt) {
      if (qcAt !== null) return "qc_signed";
      return "completed";
    }
    return "pending";
  };

  const isLoading = authLoading && publicLoading;
  const activeDrawing = drawings.find((d) => d.id === activeDrawingId) || drawings[0] || null;

  async function snap(file: File) {
    setPhotoBusy(true);
    setPhotoErr(null);
    try {
      await uploadFile({ file, entity_type: "parts", entity_id: id, bucket: "photos" });
      setPhotoCount((n) => n + 1);
    } catch (e) {
      setPhotoErr("Photo upload failed");
    } finally {
      setPhotoBusy(false);
    }
  }

  // Large glove-friendly plus-minus input
  const HoursInput = ({ value, onChange }: { value: number; onChange: (n: number) => void }) => (
    <div className="flex items-center gap-2 mt-2">
      <button
        onClick={() => onChange(Math.max(0, value - 0.5))}
        className="w-14 h-14 rounded-xl flex items-center justify-center bg-slate-800 text-white border border-slate-700 font-extrabold text-xl hover:bg-slate-700 cursor-pointer animate-none"
      >
        -
      </button>
      <input
        type="number"
        step="0.5"
        value={value || ""}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-20 text-center h-14 rounded-xl bg-slate-900 border border-slate-700 font-bold text-white text-base"
        placeholder="Hours"
      />
      <button
        onClick={() => onChange(value + 0.5)}
        className="w-14 h-14 rounded-xl flex items-center justify-center bg-slate-800 text-white border border-slate-700 font-extrabold text-xl hover:bg-slate-700 cursor-pointer animate-none"
      >
        +
      </button>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#0B1120", color: "#F8FAFC", maxWidth: 760, margin: "0 auto", padding: "20px 20px 100px" }}>
      {/* Top Header Navigation */}
      <header className="flex items-center justify-between mb-5 pb-3 border-b border-slate-800/80">
        <div className="flex gap-2">
          <button
            onClick={() => router.push("/worker")}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <ChevronLeft size={16} /> Queue
          </button>
          {localPart && (
            <button
              onClick={printPaperTraveller}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <Printer size={15} /> Fallback Traveller
            </button>
          )}
        </div>

        {/* Sync Status Badge */}
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold font-mono transition-all ${
            isOnline && offlineQueue.length === 0
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : offlineQueue.length > 0
              ? "bg-amber-500/15 border-amber-500/30 text-amber-400 animate-pulse"
              : "bg-slate-800 border-slate-700 text-slate-400"
          }`}
        >
          {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
          <span>
            {offlineQueue.length > 0 ? `${offlineQueue.length} Pending Sync` : isOnline ? "Online" : "Offline Mode"}
          </span>
        </div>
      </header>

      {isLoading && (
        <div className="text-center text-slate-400 py-16">
          <Loader2 size={28} className="animate-spin inline mb-3 text-indigo-400" />
          <div className="text-sm font-medium">Loading part details…</div>
        </div>
      )}

      {localPart && (
        <>
          {/* Main Part Card */}
          <div className="rounded-2xl p-6 bg-slate-800/90 border border-slate-700/80 mb-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-3xl font-black font-mono text-white tracking-wider">{localPart.part_mark}</div>
                <div className="text-sm font-semibold text-slate-400 mt-1">{localPart.profile}</div>
              </div>
              <div className="flex-shrink-0 pt-1">
                <StatusPill status={localPart.status} />
              </div>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 !mt-5 pt-4">
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/50">
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Assembly</div>
                <div className="text-xs font-mono font-bold text-white mt-1">{localPart.assembly_mark ?? "—"}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/50">
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Heat #</div>
                <div className="text-xs font-mono font-bold text-white mt-1">{localPart.heat_number ?? "—"}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/50">
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Finish</div>
                <div className="text-xs font-mono font-bold text-white mt-1">{localPart.finish ?? "SHOP PRIMER"}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/50">
                <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Weight</div>
                <div className="text-xs font-mono font-bold text-white mt-1">{localPart.weight ? `${localPart.weight} lb` : "—"}</div>
              </div>
            </div>
          </div>

          {/* Traveller Stages List */}
          <div className="mb-6">
            <h3 className="text-lg font-bold text-white mb-4">Traveller Stages</h3>

            <div className="flex flex-col gap-4">
              {/* STAGE 1: Cutting */}
              <StageCard
                title="Cutting"
                icon={<Scissors size={20} />}
                status={getStageStatus(localPart.cut_completed_at)}
                completedAt={localPart.cut_completed_at}
                completedBy={localPart.cut_completed_by}
                users={usersList.data ?? []}
                isQC={isQC}
                onReassign={() => setReassignField("cut_completed_by")}
              >
                {!localPart.cut_completed_at && (
                  <div className="mt-4 flex flex-col gap-4">
                    <div>
                      <span className="text-xs text-slate-400 font-bold block mb-1">Hours Spent</span>
                      <HoursInput
                        value={localPart.cut_hours || 0}
                        onChange={(val) => setLocalPart({ ...localPart, cut_hours: val })}
                      />
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 font-bold block mb-1">Drop / Remnant Length</span>
                      <input
                        type="text"
                        value={localPart.cut_drop_length || ""}
                        onChange={(e) => setLocalPart({ ...localPart, cut_drop_length: e.target.value })}
                        placeholder="e.g. 36 inches or 3ft"
                        className="input h-14 font-semibold text-base w-full max-w-[280px]"
                      />
                      {localPart.cut_drop_length && (
                        <button
                          onClick={() => printDropLabel(localPart.cut_drop_length || "")}
                          className="mt-2.5 px-4 py-2.5 rounded-xl border border-indigo-500/30 text-indigo-400 font-bold text-xs flex items-center gap-1.5 hover:bg-indigo-500/10 cursor-pointer"
                        >
                          <Printer size={14} /> Print Remnant Drop Label
                        </button>
                      )}
                    </div>

                    {!auth.userId ? (
                      <Link
                        href={`/auth/signin?next=/worker/parts/${id}`}
                        className="w-full h-18 rounded-2xl flex items-center justify-center bg-slate-800 text-slate-400 font-extrabold text-base border border-slate-700/80 cursor-pointer"
                      >
                        🔒 Sign in to Complete
                      </Link>
                    ) : (
                      <button
                        onClick={() =>
                          triggerAction({
                            cut_completed_at: new Date().toISOString(),
                            cut_completed_by: auth.userId,
                            cut_hours: localPart.cut_hours,
                            cut_drop_length: localPart.cut_drop_length,
                          })
                        }
                        className="w-full h-18 rounded-2xl flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-base border border-emerald-500/20 cursor-pointer shadow-lg active:scale-[0.98]"
                      >
                        Mark Cut Done (Self-Check)
                      </button>
                    )}
                  </div>
                )}
              </StageCard>

              {/* STAGE 2: Fit-Up */}
              <StageCard
                title="Fit-Up"
                icon={<Hammer size={20} />}
                status={getStageStatus(localPart.fit_completed_at, localPart.fit_skipped)}
                completedAt={localPart.fit_completed_at}
                completedBy={localPart.fit_completed_by}
                users={usersList.data ?? []}
                isQC={isQC}
                onReassign={() => setReassignField("fit_completed_by")}
              >
                {!localPart.fit_completed_at && !localPart.fit_skipped && (
                  <div className="mt-4 flex flex-col gap-4">
                    <div>
                      <span className="text-xs text-slate-400 font-bold block mb-1">Hours Spent</span>
                      <HoursInput
                        value={localPart.fit_hours || 0}
                        onChange={(val) => setLocalPart({ ...localPart, fit_hours: val })}
                      />
                    </div>

                    <div className="flex gap-3">
                      {!auth.userId ? (
                        <Link
                          href={`/auth/signin?next=/worker/parts/${id}`}
                          className="flex-1 h-18 rounded-2xl flex items-center justify-center bg-slate-800 text-slate-400 font-extrabold text-base border border-slate-700/80 cursor-pointer"
                        >
                          🔒 Sign in
                        </Link>
                      ) : (
                        <>
                          <button
                            onClick={() => triggerAction({ fit_skipped: true })}
                            className="px-6 h-18 rounded-2xl border border-slate-700 hover:bg-slate-800 text-slate-300 font-extrabold text-sm cursor-pointer active:scale-[0.98]"
                          >
                            Skip Stage
                          </button>
                          <button
                            onClick={() =>
                              triggerAction({
                                fit_completed_at: new Date().toISOString(),
                                fit_completed_by: auth.userId,
                                fit_hours: localPart.fit_hours,
                              })
                            }
                            className="flex-1 h-18 rounded-2xl flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-base border border-emerald-500/20 cursor-pointer shadow-lg active:scale-[0.98]"
                          >
                            Mark Fit-Up Done
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
                {localPart.fit_skipped && (
                  <button
                    onClick={() => triggerAction({ fit_skipped: false })}
                    className="mt-3 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-400 border border-slate-700 cursor-pointer"
                  >
                    Reset Skip
                  </button>
                )}
              </StageCard>

              {/* STAGE 3: Weld */}
              <StageCard
                title="Welding"
                icon={<Zap size={20} />}
                status={getStageStatus(localPart.weld_completed_at, localPart.weld_skipped, localPart.weld_qc_at)}
                completedAt={localPart.weld_completed_at}
                completedBy={localPart.weld_completed_by}
                users={usersList.data ?? []}
                isQC={isQC}
                onReassign={() => setReassignField("weld_completed_by")}
                qcAt={localPart.weld_qc_at}
                qcBy={localPart.weld_qc_by}
                onReassignQc={() => setReassignField("weld_qc_by")}
              >
                {!localPart.weld_completed_at && !localPart.weld_skipped && (
                  <div className="mt-4 flex flex-col gap-4">
                    <div>
                      <span className="text-xs text-slate-400 font-bold block mb-1">Hours Spent</span>
                      <HoursInput
                        value={localPart.weld_hours || 0}
                        onChange={(val) => setLocalPart({ ...localPart, weld_hours: val })}
                      />
                    </div>

                    <div className="flex gap-3">
                      {!auth.userId ? (
                        <Link
                          href={`/auth/signin?next=/worker/parts/${id}`}
                          className="flex-1 h-18 rounded-2xl flex items-center justify-center bg-slate-800 text-slate-400 font-extrabold text-base border border-slate-700/80 cursor-pointer"
                        >
                          🔒 Sign in
                        </Link>
                      ) : (
                        <>
                          <button
                            onClick={() => triggerAction({ weld_skipped: true })}
                            className="px-6 h-18 rounded-2xl border border-slate-700 hover:bg-slate-800 text-slate-300 font-extrabold text-sm cursor-pointer active:scale-[0.98]"
                          >
                            Skip Stage
                          </button>
                          <button
                            onClick={() =>
                              triggerAction({
                                weld_completed_at: new Date().toISOString(),
                                weld_completed_by: auth.userId,
                                weld_hours: localPart.weld_hours,
                              })
                            }
                            className="flex-1 h-18 rounded-2xl flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-base border border-emerald-500/20 cursor-pointer shadow-lg active:scale-[0.98]"
                          >
                            Mark Weld Done
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {localPart.weld_completed_at && !localPart.weld_qc_at && (
                  <div className="mt-4 p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
                    <div className="text-sm font-bold text-white flex items-center gap-1.5">
                      <ShieldAlert size={16} className="text-indigo-400" /> Weld QC Sign-Off Required (AWS D1.1 hold point)
                    </div>
                    {isQC ? (
                      <button
                        onClick={() =>
                          triggerAction({
                            weld_qc_at: new Date().toISOString(),
                            weld_qc_by: auth.userId,
                          })
                        }
                        className="mt-3 w-full h-14 rounded-xl flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-sm cursor-pointer active:scale-[0.98]"
                      >
                        Sign-off Weld Quality Control
                      </button>
                    ) : (
                      <div className="mt-2 text-xs text-slate-500 font-bold">
                        A QC Inspector or Supervisor must sign off this stage.
                      </div>
                    )}
                  </div>
                )}

                {localPart.weld_skipped && (
                  <button
                    onClick={() => triggerAction({ weld_skipped: false })}
                    className="mt-3 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-400 border border-slate-700 cursor-pointer"
                  >
                    Reset Skip
                  </button>
                )}
              </StageCard>

              {/* STAGE 4: Finish (Coating/Paint) */}
              <StageCard
                title={`Paint / Coating`}
                icon={<Paintbrush size={20} />}
                status={getStageStatus(localPart.finish_completed_at)}
                completedAt={localPart.finish_completed_at}
                completedBy={localPart.finish_completed_by}
                users={usersList.data ?? []}
                isQC={isQC}
                onReassign={() => setReassignField("finish_completed_by")}
              >
                {!localPart.finish_completed_at && (
                  <div className="mt-4 flex flex-col gap-4">
                    <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800 text-xs text-slate-400">
                      Required Finish spec: <strong>{localPart.finish || "SHOP PRIMER"}</strong> (Design setting)
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 font-bold block mb-1">Hours Spent</span>
                      <HoursInput
                        value={localPart.finish_hours || 0}
                        onChange={(val) => setLocalPart({ ...localPart, finish_hours: val })}
                      />
                    </div>

                    {!auth.userId ? (
                      <Link
                        href={`/auth/signin?next=/worker/parts/${id}`}
                        className="w-full h-18 rounded-2xl flex items-center justify-center bg-slate-800 text-slate-400 font-extrabold text-base border border-slate-700/80 cursor-pointer"
                      >
                        🔒 Sign in to Complete
                      </Link>
                    ) : (
                      <button
                        onClick={() =>
                          triggerAction({
                            finish_completed_at: new Date().toISOString(),
                            finish_completed_by: auth.userId,
                            finish_hours: localPart.finish_hours,
                          })
                        }
                        className="w-full h-18 rounded-2xl flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-base border border-emerald-500/20 cursor-pointer shadow-lg active:scale-[0.98]"
                      >
                        Mark Coating Completed
                      </button>
                    )}
                  </div>
                )}
              </StageCard>

              {/* STAGE 5: Final Inspection (Gate) */}
              <StageCard
                title="Final CWI Inspection"
                icon={<ShieldAlert size={20} />}
                status={getStageStatus(localPart.insp_completed_at)}
                completedAt={localPart.insp_completed_at}
                completedBy={localPart.insp_completed_by}
                users={usersList.data ?? []}
                isQC={isQC}
                onReassign={() => setReassignField("insp_completed_by")}
              >
                {!localPart.insp_completed_at && (
                  <div className="mt-4">
                    {!localPart.finish_completed_at ? (
                      <div className="p-4 rounded-xl bg-red-950/20 border border-red-900/30 text-xs text-red-400 font-medium">
                        ⚠ Coated Finish stage must be completed before CWI Final Inspection.
                      </div>
                    ) : (
                      <>
                        {isQC ? (
                          <button
                            onClick={() =>
                              triggerAction({
                                insp_completed_at: new Date().toISOString(),
                                insp_completed_by: auth.userId,
                              })
                            }
                            className="w-full h-18 rounded-2xl flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-base border border-emerald-500/20 cursor-pointer shadow-lg active:scale-[0.98]"
                          >
                            CWI Inspector Sign-off (Approved)
                          </button>
                        ) : (
                          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs text-slate-500 font-bold">
                            Only CWI Inspectors / Supervisors can approve final sign-off.
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </StageCard>
            </div>
          </div>

          {/* Photo capture attachments */}
          <div className="rounded-2xl p-6 bg-slate-800/90 border border-slate-700/80 mb-5 shadow-xl">
            <h4 className="font-bold text-white text-base mb-3">Shop Floor Photo Log</h4>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) snap(f);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={photoBusy}
              className="w-full h-14 rounded-2xl flex items-center justify-center gap-2 bg-slate-700/80 hover:bg-slate-700 text-white font-bold text-sm border border-slate-600 shadow transition-colors cursor-pointer"
            >
              {photoBusy ? <Loader2 size={18} className="animate-spin text-indigo-400" /> : <Camera size={18} />}
              {photoBusy ? "Uploading to Cloud…" : photoCount > 0 ? `Attach another photo (${photoCount} logged)` : "Snapshot (DFT Gauge / Weld)"}
            </button>
            {photoErr && <div className="text-xs mt-2 text-red-400 font-medium">{photoErr}</div>}
          </div>

          {/* Structural Drawing PDF Section */}
          <div className="rounded-2xl p-6 mb-5 bg-slate-800/90 border border-slate-700/80 shadow-xl">
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <FileText size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-white">Structural Drawing PDF</h4>
                  <p className="text-[11px] text-slate-400">Worker drawing & revision history</p>
                </div>
              </div>
            </div>

            {drawings.length > 0 ? (
              <div>
                {/* Horizontal scrollable tab buttons for revision list */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide border-b border-white/5 mb-4">
                  {drawings.map((d, index) => {
                    const isLatest = index === 0;
                    const isActive = d.id === activeDrawingId;
                    return (
                      <button
                        key={d.id}
                        onClick={() => setActiveDrawingId(d.id)}
                        className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border flex-shrink-0 ${
                          isActive
                            ? "bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/10"
                            : "bg-slate-900 border-white/5 text-slate-400 hover:text-white"
                        }`}
                      >
                        <span>v{drawings.length - index}</span>
                        {isLatest && <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-white/10 text-indigo-200">Latest</span>}
                      </button>
                    );
                  })}
                </div>

                {activeDrawing?.url ? (
                  <div className="flex flex-col gap-3">
                    <div className="rounded-xl overflow-hidden border border-slate-700/60 bg-slate-900 shadow-inner relative group" style={{ height: "360px" }}>
                      <iframe
                        src={activeDrawing.url}
                        className="w-full h-full border-0"
                        title={activeDrawing.filename}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-slate-400 py-8 bg-slate-900/60 rounded-xl border border-slate-800 text-xs font-medium">
                    Could not generate view link for drawing.
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-slate-400 py-8 bg-slate-900/60 rounded-xl border border-slate-800 text-xs font-semibold">
                No drawing PDF attached to this part.
              </div>
            )}
          </div>
        </>
      )}

      {/* Supervisor/Admin Reassignment Dialog */}
      {reassignField && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-extrabold text-white text-base">Reassign Stage Owner</h4>
              <button onClick={() => setReassignField(null)} className="text-slate-400 hover:text-white cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-slate-400 mb-4 leading-normal">
              Select the worker to assign this stage's work record. Overwrites will generate an audit log correction entry.
            </p>
            <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
              {(usersList.data ?? []).map((u) => (
                <button
                  key={u.id}
                  onClick={() => applyReassignment(u.id)}
                  className="w-full p-3 rounded-xl border border-white/5 hover:border-white/10 transition-colors text-left bg-white/[0.02] flex items-center justify-between cursor-pointer"
                >
                  <div>
                    <div className="text-[13px] font-bold text-white leading-tight">{u.full_name}</div>
                    <div className="text-[10px] text-indigo-400 font-bold uppercase mt-0.5">{u.role}</div>
                  </div>
                  <span className="text-[11px] font-extrabold text-indigo-400">Choose</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StageCard({
  title,
  icon,
  status,
  completedAt,
  completedBy,
  users,
  isQC,
  onReassign,
  qcAt,
  qcBy,
  onReassignQc,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  status: "pending" | "completed" | "qc_signed" | "skipped";
  completedAt: string | null;
  completedBy: string | null;
  users: UserRow[];
  isQC: boolean;
  onReassign: () => void;
  qcAt?: string | null;
  qcBy?: string | null;
  onReassignQc?: () => void;
  children: React.ReactNode;
}) {
  const completedUser = users.find((u) => u.id === completedBy);
  const qcUser = users.find((u) => u.id === qcBy);

  const statusStyles = {
    pending: {
      bg: "bg-slate-800/40 border-slate-800",
      accent: "text-slate-500",
      label: "Pending",
    },
    completed: {
      bg: "bg-emerald-500/[0.03] border-emerald-500/25",
      accent: "text-emerald-400",
      label: "Completed",
    },
    qc_signed: {
      bg: "bg-indigo-500/[0.03] border-indigo-500/25",
      accent: "text-indigo-400",
      label: "QC Approved",
    },
    skipped: {
      bg: "bg-slate-800/20 border-slate-800/60 opacity-60",
      accent: "text-slate-400",
      label: "N/A Skipped",
    },
  }[status];

  return (
    <div className={`rounded-2xl p-5 border transition-all ${statusStyles.bg}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-white/5 border border-white/10 ${statusStyles.accent}`}>
            {icon}
          </div>
          <div>
            <h4 className="font-extrabold text-sm text-white">{title}</h4>
            <span className={`text-[10px] font-bold uppercase tracking-wider ${statusStyles.accent}`}>
              {statusStyles.label}
            </span>
          </div>
        </div>
      </div>

      {completedAt && (
        <div className="mt-3.5 pt-3.5 border-t border-white/5 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-1">
              <User size={13} className="text-slate-500" />
              <span>By: <strong>{completedUser?.full_name ?? "Auto"}</strong></span>
            </div>
            {isQC && (
              <button
                onClick={onReassign}
                className="text-[10.5px] font-bold text-indigo-400 flex items-center gap-0.5 hover:underline cursor-pointer"
              >
                <Edit2 size={10} /> Reassign
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-slate-500">
            <Clock size={12} />
            <span>{new Date(completedAt).toLocaleString()}</span>
          </div>
        </div>
      )}

      {qcAt && (
        <div className="mt-2.5 pt-2.5 border-t border-white/5 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-1">
              <ShieldAlert size={13} className="text-indigo-400" />
              <span>QC: <strong>{qcUser?.full_name ?? "CWI Inspector"}</strong></span>
            </div>
            {isQC && onReassignQc && (
              <button
                onClick={onReassignQc}
                className="text-[10.5px] font-bold text-indigo-400 flex items-center gap-0.5 hover:underline cursor-pointer"
              >
                <Edit2 size={10} /> Reassign
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-slate-500">
            <Clock size={12} />
            <span>{new Date(qcAt).toLocaleString()}</span>
          </div>
        </div>
      )}

      {children}
    </div>
  );
}
