"use client";

import { use, useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useResource, useUpdate } from "@/hooks/useResource";
import { uploadFile, type FileAttachment } from "@/lib/api";
import { StatusPill } from "@/components/ui/StatusPill";
import {
  Loader2,
  ChevronLeft,
  Check,
  Camera,
  X,
  FileText,
  ExternalLink,
  Download,
  Maximize2,
  Minimize2,
  RefreshCw,
} from "lucide-react";

interface Part {
  id: string;
  part_mark: string;
  profile: string;
  status: string;
  assembly_mark: string | null;
  heat_number: string | null;
  weight: number | null;
  project_name?: string | null;
  project_number?: string | null;
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

  // Authenticated hooks (used if user is signed in)
  const { data: authPart, isLoading: authLoading, error: authError } = useResource<Part>("parts", id);
  const update = useUpdate<Part>("parts");

  // Public scan state (used for unauthenticated QR scans on mobile/tablet)
  const [publicData, setPublicData] = useState<{ part: Part; drawings: PublicDrawing[] } | null>(null);
  const [publicLoading, setPublicLoading] = useState(true);
  const [publicError, setPublicError] = useState<string | null>(null);

  // Drawing PDF state
  const [drawings, setDrawings] = useState<PublicDrawing[]>([]);
  const [activeDrawingId, setActiveDrawingId] = useState<string | null>(null);
  const [isFullscreenPdf, setIsFullscreenPdf] = useState(false);

  // Photo upload state
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoCount, setPhotoCount] = useState(0);
  const [photoErr, setPhotoErr] = useState<string | null>(null);

  // Fetch public part + drawing PDFs (accessible without authentication)
  const loadPublicData = useCallback(() => {
    let cancelled = false;
    setPublicLoading(true);
    setPublicError(null);

    const apiBase =
      process.env.NEXT_PUBLIC_API_BASE ??
      "https://mteocbcpbdgfdysulmiv.supabase.co/functions/v1/api";
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

    const primaryUrl = `${apiBase}/public/parts/${id}`;
    const fallbackUrl = `/api/public/parts/${id}`;

    fetch(primaryUrl, { headers: { apikey: anonKey } })
      .then((res) => {
        if (!res.ok) return fetch(fallbackUrl);
        return res;
      })
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
          setPublicError(err instanceof Error ? err.message : "Network error loading part");
        }
      })
      .finally(() => {
        if (!cancelled) setPublicLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    loadPublicData();
  }, [loadPublicData]);

  // Combine part details from authenticated or public source
  const part: Part | null = authPart
    ? {
      ...authPart,
      project_name: publicData?.part.project_name ?? authPart.project_name,
      project_number: publicData?.part.project_number ?? authPart.project_number,
    }
    : publicData?.part ?? null;

  const isLoading = authLoading && publicLoading;
  const error = (authError && publicError) ? publicError : null;

  const activeDrawing = drawings.find((d) => d.id === activeDrawingId) || drawings[0] || null;

  function fileLabel(path: string): string {
    const base = path.split("/").pop() ?? "drawing.pdf";
    return base.replace(/^[0-9a-f-]{36}-/i, "");
  }

  async function snap(file: File) {
    setPhotoBusy(true);
    setPhotoErr(null);
    try {
      await uploadFile({ file, entity_type: "parts", entity_id: id, bucket: "photos" });
      setPhotoCount((n) => n + 1);
    } catch (e) {
      setPhotoErr(e instanceof Error ? e.message : "Upload failed — please sign in");
    } finally {
      setPhotoBusy(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0B1120", color: "#F8FAFC", maxWidth: 760, margin: "0 auto", padding: "20px 20px 100px" }}>
      {/* Top Header Navigation */}
      <header className="flex items-center justify-between mb-5 !pb-3 border-b border-slate-800/80">
        <button
          onClick={() => router.push("/worker")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700/60 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
        >
          <ChevronLeft size={16} /> Queue
        </button>

        {/* FabSimple Brand Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/15 border border-indigo-500/30 shadow-sm">
          <div className="w-4.5 h-4.5 rounded bg-indigo-500/30 flex items-center justify-center">
            <svg width="11" height="11" viewBox="0 0 20 20" fill="none">
              <rect x="0" y="0" width="8" height="8" fill="#818CF8" rx="1.5" />
              <rect x="12" y="0" width="8" height="8" fill="#818CF8" rx="1.5" opacity="0.5" />
              <rect x="0" y="12" width="8" height="8" fill="#818CF8" rx="1.5" opacity="0.5" />
              <rect x="12" y="12" width="8" height="8" fill="#818CF8" rx="1.5" opacity="0.85" />
            </svg>
          </div>
          <span className="text-xs font-bold tracking-wide text-indigo-300 uppercase">FabSimple</span>
        </div>

        <button
          onClick={() => router.push("/worker/scan")}
          className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700/60 text-slate-400 hover:text-white transition-colors"
          title="Scan another QR code"
        >
          <X size={16} />
        </button>
      </header>

      {isLoading && (
        <div className="text-center text-slate-400 py-16">
          <Loader2 size={28} className="animate-spin inline mb-3 text-indigo-400" />
          <div className="text-sm font-medium">Loading part details & drawing PDF…</div>
        </div>
      )}

      {error && !part && (
        <div className="rounded-xl p-5 bg-red-950/80 border border-red-800/80 text-red-200 text-sm mb-5 shadow-lg">
          <div className="font-bold text-base mb-1">Could not load part</div>
          <div className="text-xs text-red-300">{error}</div>
          <button
            onClick={() => loadPublicData()}
            className="mt-4 text-xs font-semibold flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-red-800 hover:bg-red-700 text-white shadow"
          >
            <RefreshCw size={13} /> Retry
          </button>
        </div>
      )}

      {part && (
        <>
          {/* Main Part Card */}
          <div className="rounded-2xl p-6 bg-slate-800/90 border border-slate-700/80 mb-5 shadow-xl">
            {/* Job ID + Project Name Header */}
            {(part.project_number || part.project_name) && (
              <div className="flex items-center gap-2 text-xs text-indigo-400 mb-3 !pb-2 border-b border-slate-700/60 font-semibold tracking-wide">
                {part.project_number && (
                  <span className="font-mono font-bold uppercase px-2 py-0.5 rounded bg-indigo-500/10 border border-indigo-500/20">
                    JOB {part.project_number}
                  </span>
                )}
                {part.project_number && part.project_name && <span className="text-slate-500">•</span>}
                {part.project_name && (
                  <span className="uppercase text-slate-300 truncate max-w-[400px]" title={part.project_name}>
                    {part.project_name}
                  </span>
                )}
              </div>
            )}

            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-3xl font-black font-mono text-white tracking-wider">{part.part_mark}</div>
                <div className="text-sm font-semibold text-slate-400 mt-1">{part.profile}</div>
              </div>
              <div className="flex-shrink-0 pt-1">
                <StatusPill status={part.status} />
              </div>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-3 gap-3 !mt-5 pt-4">
              <Info label="Assembly" value={part.assembly_mark ?? "—"} />
              <Info label="Heat #" value={part.heat_number ?? "—"} />
              <Info label="Weight" value={part.weight ? `${part.weight} lb` : "—"} />
            </div>
          </div>

          {/* Structural Drawing PDF Section */}
          <div className="rounded-2xl p-6 mb-5 bg-slate-800/90 border border-slate-700/80 shadow-xl">
            <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                  <FileText size={18} />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <span>Structural Drawing PDF</span>
                    {drawings.length > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold">
                        {drawings.length} file{drawings.length === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Official shop drawing attached to QR code mark
                  </div>
                </div>
              </div>

              {activeDrawing?.url && (
                <div className="flex items-center gap-2.5">
                  <a
                    href={activeDrawing.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold shadow-md flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    title="Open PDF in fullscreen tab or device reader"
                  >
                    <ExternalLink size={14} /> Fullscreen
                  </a>
                  <a
                    href={activeDrawing.url}
                    download={fileLabel(activeDrawing.storage_path)}
                    className="px-4 py-2 rounded-xl bg-slate-700/90 hover:bg-slate-600 text-slate-100 text-xs font-bold flex items-center gap-1.5 transition-all border border-slate-600/60 shadow-sm hover:scale-[1.02] active:scale-[0.98]"
                    title="Download PDF file"
                  >
                    <Download size={14} />
                    <span>Download</span>
                  </a>
                </div>
              )}
            </div>

            {publicLoading ? (
              <div className="text-xs text-slate-400 py-8 text-center flex items-center justify-center gap-2">
                <Loader2 size={18} className="animate-spin text-indigo-400" /> Loading drawing PDF…
              </div>
            ) : drawings.length === 0 ? (
              <div className="text-xs text-slate-400 p-4 bg-slate-900/60 rounded-xl text-center border border-slate-700/60 font-medium">
                ⚠️ No drawing PDF attached to this part mark yet.
              </div>
            ) : (
              <div className="space-y-4">
                {/* Multiple drawings revision tabs */}
                {drawings.length > 1 && (
                  <div className="flex items-center gap-3 overflow-x-auto pb-2 mb-4 pt-1">
                    {drawings.map((d, idx) => {
                      const isActive = d.id === activeDrawingId;
                      const revNum = drawings.length - idx;
                      return (
                        <button
                          key={d.id}
                          onClick={() => setActiveDrawingId(d.id)}
                          className={`text-xs px-3 py-1.5 rounded-xl font-mono font-bold transition-all flex items-center gap-2.5 flex-shrink-0 ${isActive
                            ? "bg-indigo-600 text-white shadow-md border border-indigo-400/50"
                            : "bg-slate-700/80 text-slate-300 hover:bg-slate-700 border border-slate-600/50"
                            }`}
                        >
                          <span className={`text-[10px] px-2.5 py-0.5 rounded-md font-extrabold uppercase tracking-wide ${isActive ? "bg-white/20 text-white" : "bg-slate-900/60 text-slate-300"
                            }`}>
                            v{revNum}{idx === 0 ? " (Latest)" : ""}
                          </span>
                          <span className="truncate max-w-[200px] font-sans text-xs font-semibold px-1">{fileLabel(d.storage_path)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Embedded Interactive PDF Viewer */}
                {activeDrawing?.url ? (
                  <div className="rounded-xl overflow-hidden border border-slate-600/80 bg-slate-950 shadow-inner">
                    <div className="bg-slate-900 px-4 py-1.5 flex items-center justify-between border-b border-slate-700/80 text-xs text-slate-200">
                      <div className="truncate font-mono font-semibold flex items-center gap-2">
                        <FileText size={14} className="text-indigo-400 flex-shrink-0" />
                        <span className="truncate text-slate-200">{fileLabel(activeDrawing.storage_path)}</span>
                      </div>
                      <button
                        onClick={() => setIsFullscreenPdf(!isFullscreenPdf)}
                        className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800 transition-colors flex items-center gap-1 text-[11px]"
                        title="Toggle viewer height"
                      >
                        {isFullscreenPdf ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                        <span className="hidden sm:inline">{isFullscreenPdf ? "Standard View" : "Expand Height"}</span>
                      </button>
                    </div>

                    <iframe
                      src={`${activeDrawing.url}#view=FitH`}
                      className={`w-full transition-all duration-200 ${isFullscreenPdf ? "h-[780px]" : "h-[500px]"
                        }`}
                      style={{ border: "none" }}
                      title="Part Structural Drawing PDF"
                    />
                  </div>
                ) : (
                  <div className="text-xs text-red-400 p-4 bg-red-950/40 rounded-xl border border-red-900/50">
                    Could not generate signed URL for drawing PDF.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Photos & Evidence Section */}
          <div className="rounded-2xl p-6 mb-5 bg-slate-800/90 border border-slate-700/80 shadow-xl">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3">
              Photos & Progress Evidence
            </div>
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
              className="w-full !p-2 rounded-xl flex items-center justify-center gap-2 bg-slate-700/80 hover:bg-slate-700 text-white font-bold text-xs border border-slate-600/60 shadow transition-colors"
            >
              {photoBusy ? <Loader2 size={16} className="animate-spin text-indigo-400" /> : <Camera size={16} />}
              {photoBusy ? "Uploading…" : photoCount > 0 ? `Add another photo (${photoCount} attached)` : "Take Photo"}
            </button>
            {photoErr && <div className="text-xs mt-2 text-red-400 font-medium">{photoErr}</div>}
          </div>

          {/* Status Update Action Button */}
          {NEXT_STATUS[part.status] ? (
            <button
              onClick={() =>
                update.mutate(
                  { id: part.id, body: { status: NEXT_STATUS[part.status] } },
                  { onSuccess: () => router.push("/worker") }
                )
              }
              disabled={update.isPending}
              className="w-full p-4.5 rounded-xl flex items-center justify-center gap-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-base shadow-lg transition-colors border border-emerald-500/30"
            >
              {update.isPending ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
              {STATUS_LABEL[part.status]}
            </button>
          ) : (
            <div className="text-center text-slate-400 text-xs font-semibold py-3 px-4 rounded-xl bg-slate-800/50 border border-slate-700/40">
              ✓ This part is marked as completed.
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/50 min-w-0">
      <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 truncate">{label}</div>
      <div className="text-xs font-mono font-bold text-white mt-1 truncate whitespace-nowrap">{value}</div>
    </div>
  );
}
