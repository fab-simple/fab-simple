"use client";

import { use, useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useResource, useUpdate } from "@/hooks/useResource";
import { uploadFile, FabAPI, type FileAttachment } from "@/lib/api";
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
    <div style={{ minHeight: "100vh", background: "#0F172A", color: "white", maxWidth: 600, margin: "0 auto", padding: "16px 16px 100px" }}>
      {/* Top Header Navigation */}
      <header className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
        <button
          onClick={() => router.push("/worker")}
          className="flex items-center gap-1 text-[13px] text-slate-400 hover:text-white"
          style={{ background: "transparent", border: "none", cursor: "pointer" }}
        >
          <ChevronLeft size={16} /> Worker Queue
        </button>

        {/* FabSimple Brand Badge */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-indigo-500/10 border border-indigo-500/20">
          <div className="w-4 h-4 rounded bg-indigo-500/20 flex items-center justify-center">
            <svg width="10" height="10" viewBox="0 0 20 20" fill="none">
              <rect x="0" y="0" width="8" height="8" fill="#818CF8" rx="1.5" />
              <rect x="12" y="0" width="8" height="8" fill="#818CF8" rx="1.5" opacity="0.5" />
              <rect x="0" y="12" width="8" height="8" fill="#818CF8" rx="1.5" opacity="0.5" />
              <rect x="12" y="12" width="8" height="8" fill="#818CF8" rx="1.5" opacity="0.85" />
            </svg>
          </div>
          <span className="text-[11px] font-bold tracking-tight text-indigo-300">FabSimple</span>
        </div>

        <button
          onClick={() => router.push("/worker/scan")}
          className="p-1.5 rounded-md text-slate-400 hover:text-white border border-slate-800"
          style={{ background: "transparent" }}
          title="Scan another QR code"
        >
          <X size={16} />
        </button>
      </header>

      {isLoading && (
        <div className="text-center text-slate-400 py-12">
          <Loader2 size={24} className="animate-spin inline mb-2" />
          <div>Loading part & drawing PDF…</div>
        </div>
      )}

      {error && !part && (
        <div className="rounded-xl p-4 bg-red-950/80 border border-red-800 text-red-200 text-sm mb-4">
          <div className="font-semibold mb-1">Could not load part</div>
          <div>{error}</div>
          <button
            onClick={() => loadPublicData()}
            className="mt-3 text-xs flex items-center gap-1.5 px-3 py-1.5 rounded bg-red-800 text-white"
          >
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {part && (
        <>
          {/* Main Part Card */}
          <div className="rounded-xl p-5 bg-slate-800/80 border border-slate-700 mb-4 shadow-lg">
            {/* Job ID + Project Name Minimal Header */}
            {(part.project_number || part.project_name) && (
              <div className="flex items-center gap-1.5 text-xs text-indigo-400 mb-2 font-medium">
                {part.project_number && (
                  <span className="font-mono font-bold uppercase">Job {part.project_number}</span>
                )}
                {part.project_number && part.project_name && <span className="text-slate-500">•</span>}
                {part.project_name && (
                  <span className="uppercase text-slate-300 truncate">{part.project_name}</span>
                )}
              </div>
            )}

            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-2xl font-black font-mono text-white tracking-wide">{part.part_mark}</div>
                <div className="text-sm font-medium text-slate-400 mt-0.5">{part.profile}</div>
              </div>
              <StatusPill status={part.status} />
            </div>

            <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-700/60">
              <Info label="Assembly" value={part.assembly_mark ?? "—"} />
              <Info label="Heat #" value={part.heat_number ?? "—"} />
              <Info label="Weight" value={part.weight ? `${part.weight} lb` : "—"} />
            </div>
          </div>

          {/* Drawing PDF Section */}
          <div className="rounded-xl p-4 mb-4 bg-slate-800/80 border border-slate-700 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <FileText size={16} className="text-indigo-400" />
                <span>Structural Drawing PDF</span>
                {drawings.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-normal">
                    {drawings.length} file{drawings.length === 1 ? "" : "s"}
                  </span>
                )}
              </div>

              {activeDrawing?.url && (
                <div className="flex items-center gap-1.5">
                  <a
                    href={activeDrawing.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn text-xs px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1 text-[11px] font-semibold"
                    title="Open PDF in native browser tab or reader"
                  >
                    <ExternalLink size={12} /> Fullscreen
                  </a>
                  <a
                    href={activeDrawing.url}
                    download={fileLabel(activeDrawing.storage_path)}
                    className="btn text-xs p-1.5 rounded bg-slate-700 hover:bg-slate-600 text-slate-200"
                    title="Download PDF"
                  >
                    <Download size={14} />
                  </a>
                </div>
              )}
            </div>

            {publicLoading ? (
              <div className="text-xs text-slate-400 py-6 text-center flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin text-indigo-400" /> Fetching drawing PDF…
              </div>
            ) : drawings.length === 0 ? (
              <div className="text-xs text-slate-400 p-4 bg-slate-900/50 rounded-lg text-center border border-slate-700/50">
                ⚠️ No drawing PDF attached to this part mark yet.
              </div>
            ) : (
              <div className="space-y-3">
                {/* Multiple drawings selector tab */}
                {drawings.length > 1 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {drawings.map((d, idx) => (
                      <button
                        key={d.id}
                        onClick={() => setActiveDrawingId(d.id)}
                        className={`text-xs px-3 py-1.5 rounded-lg font-mono truncate max-w-[180px] transition-colors ${
                          d.id === activeDrawingId
                            ? "bg-indigo-600 text-white font-bold"
                            : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                        }`}
                      >
                        v{drawings.length - idx} • {fileLabel(d.storage_path)}
                      </button>
                    ))}
                  </div>
                )}

                {/* Embedded Interactive PDF Viewer */}
                {activeDrawing?.url ? (
                  <div className="relative rounded-lg overflow-hidden border border-slate-600 bg-slate-950 shadow-inner">
                    <div className="bg-slate-900 px-3 py-2 flex items-center justify-between border-b border-slate-700 text-xs text-slate-300">
                      <div className="truncate font-mono font-semibold flex items-center gap-1.5">
                        <FileText size={13} className="text-indigo-400 flex-shrink-0" />
                        <span className="truncate">{fileLabel(activeDrawing.storage_path)}</span>
                      </div>
                      <button
                        onClick={() => setIsFullscreenPdf(!isFullscreenPdf)}
                        className="text-slate-400 hover:text-white p-1 rounded"
                        title="Toggle full height"
                      >
                        {isFullscreenPdf ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                      </button>
                    </div>

                    <iframe
                      src={`${activeDrawing.url}#view=FitH`}
                      className={`w-full transition-all duration-200 ${
                        isFullscreenPdf ? "h-[750px]" : "h-[450px]"
                      }`}
                      style={{ border: "none" }}
                      title="Part Drawing PDF"
                    />
                  </div>
                ) : (
                  <div className="text-xs text-red-400 p-3 bg-red-950/40 rounded-lg">
                    Could not load signed URL for drawing PDF.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Photo evidence section */}
          <div className="rounded-xl p-4 mb-4 bg-slate-800/80 border border-slate-700 shadow-lg">
            <div className="text-xs font-bold text-slate-200 mb-2">Photos / Progress Evidence</div>
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
              className="w-full p-3 rounded-lg flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-semibold text-xs transition-colors"
            >
              {photoBusy ? <Loader2 size={16} className="animate-spin text-indigo-400" /> : <Camera size={16} />}
              {photoBusy ? "Uploading…" : photoCount > 0 ? `Add another photo (${photoCount} attached)` : "Take photo"}
            </button>
            {photoErr && <div className="text-xs mt-2 text-red-400">{photoErr}</div>}
          </div>

          {/* Status update button (for signed-in workers) */}
          {NEXT_STATUS[part.status] ? (
            <button
              onClick={() =>
                update.mutate(
                  { id: part.id, body: { status: NEXT_STATUS[part.status] } },
                  { onSuccess: () => router.push("/worker") }
                )
              }
              disabled={update.isPending}
              className="w-full p-4 rounded-xl flex items-center justify-center gap-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base shadow-lg transition-colors"
            >
              {update.isPending ? <Loader2 size={20} className="animate-spin" /> : <Check size={20} />}
              {STATUS_LABEL[part.status]}
            </button>
          ) : (
            <div className="text-center text-slate-400 text-xs py-2">
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
    <div>
      <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">{label}</div>
      <div className="text-xs font-mono font-semibold text-white mt-0.5 truncate">{value}</div>
    </div>
  );
}
