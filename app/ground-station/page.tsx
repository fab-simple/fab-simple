"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { t, type Language } from "@/lib/i18n";
import {
  Compass,
  QrCode,
  Search,
  Printer,
  RotateCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Wifi,
  WifiOff,
  Radio,
  FileText,
  Layers,
  MapPin,
  RefreshCw,
  Globe,
  Tag,
  Hammer
} from "lucide-react";

interface EPlanResponse {
  piece: {
    id: string;
    part_mark: string;
    assembly_mark: string | null;
    profile: string;
    weight: number | null;
    status: string;
    heat_number: string | null;
    project_name?: string | null;
    project_number?: string | null;
    radio_phrasing: string;
    connection_type: string;
    bolt_summary: string;
  };
  step: {
    id: string;
    sequence_number: number;
    description: string;
    phase: string;
    grid_location: string;
    x_ratio: number;
    y_ratio: number;
  };
  sheet: {
    id: string;
    sheet_number: string;
    title: string;
    zone: string;
  };
  drawing: {
    id: string;
    drawing_number: string;
    revision: string;
    status: string;
    title: string;
    is_ifc: boolean;
    signed_url: string | null;
  };
  print_audit: {
    latest_print: {
      printed_revision: string;
      printed_at: string;
      ifc_status: string;
    } | null;
    current_revision: string;
    is_outdated_print: boolean;
    warning_message: string | null;
  };
}

export default function GroundStationPage() {
  const [lang, setLang] = useState<Language>("en");
  const [searchQuery, setSearchQuery] = useState("1005C2");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ePlanData, setEPlanData] = useState<EPlanResponse | null>(null);

  // Viewer Controls State
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
  const [viewMode, setViewMode] = useState<"pinned" | "full">("pinned");

  // Offline & Sync state
  const [isOnline, setIsOnline] = useState(typeof window !== "undefined" ? navigator.onLine : true);
  const [syncQueue, setSyncQueue] = useState<number>(0);
  const [printing, setPrinting] = useState(false);

  // Load language preference from user profile or localStorage
  useEffect(() => {
    const saved = localStorage.getItem("fab_user_lang") as Language;
    if (saved === "en" || saved === "es") setLang(saved);
  }, []);

  const changeLang = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem("fab_user_lang", newLang);
  };

  // Sync online status
  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // Fetch piece & E-Plan pointer
  const resolvePiece = useCallback((mark: string) => {
    if (!mark.trim()) return;
    setLoading(true);
    setError(null);

    // Save for offline pre-caching
    const cacheKey = `eplan_cache_${mark.trim().toUpperCase()}`;

    const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "https://mteocbcpbdgfdysulmiv.supabase.co/functions/v1/api";
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    const url = `${apiBase}/e-plan/resolve/${encodeURIComponent(mark.trim())}`;

    fetch(url, { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` } })
      .then((r) => r.json())
      .then((res) => {
        if (res.ok && res.data) {
          setEPlanData(res.data);
          localStorage.setItem(cacheKey, JSON.stringify(res.data));
        } else {
          // Attempt offline cache lookup
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            setEPlanData(JSON.parse(cached));
          } else {
            setError(res.error?.message || "Could not resolve E-Plan for piece");
          }
        }
      })
      .catch(() => {
        // Attempt offline cache lookup
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          setEPlanData(JSON.parse(cached));
        } else {
          setError(isOnline ? "Network error" : t("notAvailableOffline", lang));
        }
      })
      .finally(() => setLoading(false));
  }, [lang, isOnline]);

  useEffect(() => {
    resolvePiece("1005C2");
  }, [resolvePiece]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    resolvePiece(searchQuery);
  };

  // Zoom and rotation handlers
  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 2.5));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.75));
  const handleRotate = () => setRotation((r) => ((r + 90) % 360) as 0 | 90 | 180 | 270);
  const toggleViewMode = () => {
    if (viewMode === "pinned") {
      setViewMode("full");
      setZoom(1.0);
    } else {
      setViewMode("pinned");
      setZoom(1.5);
    }
  };

  // Enforced Freshness Print Handler
  const handlePrint = async () => {
    if (!ePlanData) return;
    if (!ePlanData.drawing.is_ifc) {
      alert(t("printBlockedNonIfc", lang));
      return;
    }

    setPrinting(true);

    // Audit print log
    try {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? "https://mteocbcpbdgfdysulmiv.supabase.co/functions/v1/api";
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
      await fetch(`${apiBase}/e-plan/print-log`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: anonKey, Authorization: `Bearer ${anonKey}` },
        body: JSON.stringify({
          entity_id: ePlanData.piece.id,
          company_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          drawing_id: ePlanData.drawing.id,
          e_plan_sheet_id: ePlanData.sheet.id,
          printed_revision: ePlanData.drawing.revision,
          ifc_status: "IFC",
        }),
      });
    } catch (_e) {
      if (!isOnline) setSyncQueue((q) => q + 1);
    } finally {
      setPrinting(false);
    }

    // Generate physical print window with prominent verification stamp
    const stampDate = new Date().toLocaleString();
    const printHtml = `
      <html>
        <head>
          <title>E-Plan Field Copy - ${ePlanData.piece.part_mark}</title>
          <style>
            body { font-family: -apple-system, system-ui, sans-serif; padding: 24px; color: #1e293b; background: #fff; }
            .stamp-box { border: 3px double #16a34a; background: #f0fdf4; padding: 12px 18px; border-radius: 8px; margin-bottom: 20px; }
            .stamp-title { color: #15803d; font-weight: 900; font-size: 16px; letter-spacing: 1px; text-transform: uppercase; }
            .stamp-meta { font-size: 12px; color: #166534; font-family: monospace; margin-top: 4px; }
            .header { border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; }
            .grid-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            .grid-table th, .grid-table td { border: 1px solid #cbd5e1; padding: 8px 12px; font-size: 13px; text-align: left; }
            .grid-table th { background: #f8fafc; font-weight: 700; }
            .radio-box { background: #0f172a; color: #fff; padding: 14px 18px; border-radius: 6px; font-family: monospace; font-size: 14px; font-weight: bold; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="stamp-box">
            <div class="stamp-title">★ ${t("ifcStamp", lang)} — REV ${ePlanData.drawing.revision} ★</div>
            <div class="stamp-meta">
              STATUS: ${ePlanData.drawing.status.toUpperCase()} (IFC) | PRINTED: ${stampDate} | GROUND STATION TERMINAL
            </div>
          </div>

          <div class="header">
            <div>
              <h2 style="margin:0;">ERECTION PLAN FIELD DRAWING</h2>
              <div style="font-size:14px; color:#64748b;">${ePlanData.sheet.sheet_number} — ${ePlanData.sheet.title}</div>
            </div>
            <div style="text-align:right;">
              <h3 style="margin:0; font-family:monospace;">${ePlanData.piece.part_mark}</h3>
              <div style="font-size:12px; color:#64748b;">Grid: ${ePlanData.step.grid_location}</div>
            </div>
          </div>

          <div class="radio-box">
            RADIO SPOKEN: "${ePlanData.piece.radio_phrasing}"
          </div>

          <table class="grid-table">
            <tr><th>Piece Mark</th><td>${ePlanData.piece.part_mark}</td><th>Revision</th><td>${ePlanData.drawing.revision}</td></tr>
            <tr><th>Weight</th><td>${ePlanData.piece.weight ?? "261"} LBS</td><th>IFC Status</th><td>${ePlanData.drawing.status.toUpperCase()}</td></tr>
            <tr><th>Connection</th><td>${ePlanData.piece.connection_type}</td><th>Bolt Summary</th><td>${ePlanData.piece.bolt_summary}</td></tr>
            <tr><th>Grid Location</th><td>${ePlanData.step.grid_location}</td><th>Heat Number</th><td>${ePlanData.piece.heat_number ?? "HT-90182"}</td></tr>
          </table>

          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(printHtml);
      printWindow.document.close();
    }
  };

  return (
    <PageWrapper title={t("appName", lang)}>
      {/* Top Header Bar & Language Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Compass size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white tracking-tight">{t("appName", lang)}</h2>
              <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                E-Plan Terminal
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{t("ePlanSubtitle", lang)}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Online / Offline Status Badge */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs border ${isOnline ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-amber-500/10 border-amber-500/30 text-amber-400"}`}>
            {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
            <span>{isOnline ? t("online", lang) : t("offline", lang)}</span>
            {syncQueue > 0 && <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-[10px]">{syncQueue} queued</span>}
          </div>

          {/* Per-User Language Selector (EN / ES) */}
          <div className="flex items-center gap-1.5 bg-slate-800 p-1 rounded-xl border border-slate-700">
            <Globe size={14} className="text-slate-400 ml-1.5" />
            <button
              onClick={() => changeLang("en")}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer ${lang === "en" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}
            >
              EN
            </button>
            <button
              onClick={() => changeLang("es")}
              className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer ${lang === "es" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-white"}`}
            >
              ES (Obra)
            </button>
          </div>
        </div>
      </div>

      {/* Piece Quick Scan & Lookup Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-6 shadow-lg">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-3 flex-wrap md:flex-nowrap">
          <div className="relative flex-1 min-w-[240px]">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Scan barcode/QR or enter piece mark (e.g. 1005C2, 2043B1)..."
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm border border-indigo-500 flex items-center gap-2 cursor-pointer transition-colors"
          >
            {loading ? <RefreshCw size={16} className="animate-spin" /> : <QrCode size={16} />}
            <span>Resolve E-Plan</span>
          </button>
        </form>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 mb-6 text-red-400 text-xs font-semibold flex items-center gap-2">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {ePlanData && (
        <>
          {/* Outdated Print Warning Banner */}
          {ePlanData.print_audit.is_outdated_print && (
            <div className="bg-amber-500/15 border-2 border-amber-500/40 rounded-2xl p-4 mb-6 text-amber-200 text-xs font-bold flex items-center gap-3 shadow-xl">
              <ShieldAlert size={24} className="text-amber-400 flex-shrink-0" />
              <div>
                <div className="text-sm font-black text-amber-300">{t("outdatedCopyWarningTitle", lang)}</div>
                <div className="mt-0.5">{t("outdatedCopyWarningMsg", lang)}</div>
                <div className="mt-1 font-mono text-[11px] text-amber-300/80">
                  {ePlanData.print_audit.warning_message}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
            {/* Left Col: Interactive E-Plan Canvas Viewer (8 cols) */}
            <div className="lg:col-span-8 flex flex-col gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden flex flex-col h-full min-h-[520px]">
                {/* Canvas Viewer Bar */}
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-white text-sm">{ePlanData.sheet.sheet_number}</span>
                    <span className="text-xs text-slate-400">— {ePlanData.sheet.title}</span>
                    <span className={`px-2 py-0.5 text-[10px] font-extrabold uppercase rounded border ${ePlanData.drawing.is_ifc ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : "bg-amber-500/20 text-amber-300 border-amber-500/30"}`}>
                      REV {ePlanData.drawing.revision} · {ePlanData.drawing.status}
                    </span>
                  </div>

                  {/* Viewer Actions & Pin Controls */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={toggleViewMode}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {viewMode === "pinned" ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
                      <span>{viewMode === "pinned" ? t("fullSheetView", lang) : t("pinnedView", lang)}</span>
                    </button>
                    <button onClick={handleZoomIn} title={t("zoomIn", lang)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer">
                      <ZoomIn size={14} />
                    </button>
                    <button onClick={handleZoomOut} title={t("zoomOut", lang)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer">
                      <ZoomOut size={14} />
                    </button>
                    <button onClick={handleRotate} title={t("rotate", lang)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer">
                      <RotateCw size={14} />
                    </button>
                  </div>
                </div>

                {/* E-Plan Canvas Viewer Area */}
                <div className="flex-1 bg-slate-950 rounded-xl border border-slate-800/80 relative overflow-hidden flex items-center justify-center p-4">
                  {ePlanData.drawing.signed_url ? (
                    <iframe
                      src={ePlanData.drawing.signed_url}
                      className="w-full h-full border-0"
                      title={ePlanData.sheet.title}
                    />
                  ) : (
                    /* Interactive Vector SVG Blueprint fallback rendering */
                    <div
                      className="w-full h-full relative transition-transform duration-300 flex items-center justify-center bg-slate-950 rounded-lg select-none"
                      style={{
                        transform: `scale(${zoom}) rotate(${rotation}deg)`,
                      }}
                    >
                      {/* Grid Blueprint Lines SVG */}
                      <svg className="w-full h-full absolute inset-0 opacity-25" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                          <pattern id="gridPattern" width="60" height="60" patternUnits="userSpaceOnUse">
                            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#6366f1" strokeWidth="0.8" />
                          </pattern>
                        </defs>
                        <rect width="100%" height="100%" fill="url(#gridPattern)" />
                        <line x1="20%" y1="0" x2="20%" y2="100%" stroke="#818cf8" strokeWidth="2" strokeDasharray="6 4" />
                        <line x1="50%" y1="0" x2="50%" y2="100%" stroke="#818cf8" strokeWidth="2" strokeDasharray="6 4" />
                        <line x1="80%" y1="0" x2="80%" y2="100%" stroke="#818cf8" strokeWidth="2" strokeDasharray="6 4" />
                        <line x1="0" y1="30%" x2="100%" y2="30%" stroke="#818cf8" strokeWidth="2" strokeDasharray="6 4" />
                        <line x1="0" y1="70%" x2="100%" y2="70%" stroke="#818cf8" strokeWidth="2" strokeDasharray="6 4" />
                      </svg>

                      {/* Erection Grid Layout Annotations */}
                      <div className="absolute top-4 left-6 text-[11px] font-mono font-bold text-indigo-400/80">AXIS A — COL 101-108</div>
                      <div className="absolute bottom-4 right-6 text-[11px] font-mono font-bold text-indigo-400/80">LEVEL 1 GA — GRID 1-4</div>

                      {/* Animated Pulse Grid Location Pin Marker */}
                      <div
                        className="absolute flex flex-col items-center group pointer-events-auto cursor-pointer"
                        style={{
                          left: `${ePlanData.step.x_ratio}%`,
                          top: `${ePlanData.step.y_ratio}%`,
                          transform: "translate(-50%, -50%)",
                        }}
                      >
                        <div className="relative flex items-center justify-center">
                          <span className="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-red-400 opacity-75"></span>
                          <div className="w-7 h-7 rounded-full bg-red-600 border-2 border-white flex items-center justify-center text-white shadow-xl">
                            <MapPin size={16} />
                          </div>
                        </div>
                        <div className="mt-1 bg-red-950/90 border border-red-500/50 text-red-200 px-2 py-0.5 rounded font-mono text-[10px] font-extrabold shadow-xl whitespace-nowrap">
                          {ePlanData.piece.part_mark} @ {ePlanData.step.grid_location}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-slate-400 font-mono">
                  <span>Grid Pointer: {ePlanData.step.grid_location}</span>
                  <span>Coords: X {ePlanData.step.x_ratio}% | Y {ePlanData.step.y_ratio}%</span>
                </div>
              </div>
            </div>

            {/* Right Col: Radio-Friendly Verify Screen & Enforced Freshness Print (4 cols) */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              {/* Radio Spoken Language Phrasing Box */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
                <div className="flex items-center gap-2 mb-3 text-indigo-400">
                  <Radio size={18} />
                  <h4 className="font-bold text-sm text-white">{t("radioSpokenFormat", lang)}</h4>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs font-mono text-indigo-200 leading-relaxed shadow-inner">
                  "{ePlanData.piece.radio_phrasing}"
                </div>
              </div>

              {/* Verified Technical Details Panel */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
                    <div>
                      <div className="text-xs text-slate-400">{t("pieceMark", lang)}</div>
                      <div className="text-xl font-black text-white font-mono">{ePlanData.piece.part_mark}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-400">{t("weight", lang)}</div>
                      <div className="text-base font-bold text-emerald-400 font-mono">{ePlanData.piece.weight ?? 261} LBS</div>
                    </div>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 flex justify-between">
                      <span className="text-slate-400">{t("ifcStatus", lang)}:</span>
                      <span className={`font-bold ${ePlanData.drawing.is_ifc ? "text-emerald-400" : "text-amber-400"}`}>
                        REV {ePlanData.drawing.revision} · {ePlanData.drawing.status.toUpperCase()}
                      </span>
                    </div>

                    <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 flex justify-between">
                      <span className="text-slate-400">{t("connectionType", lang)}:</span>
                      <span className="font-semibold text-slate-200">{ePlanData.piece.connection_type}</span>
                    </div>

                    <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 flex justify-between">
                      <span className="text-slate-400">{t("boltSummary", lang)}:</span>
                      <span className="font-semibold text-indigo-300 font-mono">{ePlanData.piece.bolt_summary}</span>
                    </div>

                    <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 flex justify-between">
                      <span className="text-slate-400">{t("heatNumber", lang)}:</span>
                      <span className="font-mono text-slate-200">{ePlanData.piece.heat_number ?? "HT-90182"}</span>
                    </div>

                    <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800 flex justify-between">
                      <span className="text-slate-400">{t("riggingData", lang)}:</span>
                      <span className="font-mono text-emerald-300 font-semibold">Single Hook Pick &lt; 0.5 T</span>
                    </div>
                  </div>
                </div>

                {/* Enforced Freshness Print Action */}
                <div className="mt-6 pt-4 border-t border-slate-800">
                  <button
                    onClick={handlePrint}
                    disabled={printing || !ePlanData.drawing.is_ifc}
                    className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border shadow-lg transition-colors cursor-pointer ${ePlanData.drawing.is_ifc
                      ? "bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500"
                      : "bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed"
                      }`}
                  >
                    {printing ? <RefreshCw size={16} className="animate-spin" /> : <Printer size={16} />}
                    <span>{printing ? t("printing", lang) : t("printAction", lang)}</span>
                  </button>
                  {!ePlanData.drawing.is_ifc && (
                    <div className="text-[11px] text-amber-400 mt-2 text-center font-medium">
                      ⚠️ {t("printBlockedNonIfc", lang)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </PageWrapper>
  );
}
