"use client";

// QR scanner for the shop floor. Uses the BarcodeDetector API on Android Chrome
// (no install required); falls back to a manual-entry input on iOS/desktop.
// QR payloads follow `fabsimple://part/<uuid>` produced by /dashboard/qr-codes.

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, AlertCircle, Keyboard, X } from "lucide-react";

type DetectFn = (video: HTMLVideoElement) => Promise<string | null>;

declare global {
  interface Window {
    BarcodeDetector?: new (opts?: { formats: string[] }) => { detect: (s: HTMLVideoElement | ImageBitmap) => Promise<{ rawValue: string }[]> };
  }
}

function parseFabUri(raw: string): string | null {
  try {
    if (raw.startsWith("fabsimple://part/")) return raw.split("/").pop() ?? null;
    if (raw.includes("/worker/parts/")) return raw.split("/worker/parts/")[1].split(/[?#]/)[0];
    // Accept bare UUID as well
    const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
    const m = raw.match(uuid);
    return m ? m[0] : null;
  } catch { return null; }
}

export default function ScanPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [manualValue, setManualValue] = useState("");
  const stoppedRef = useRef(false);

  useEffect(() => {
    if (manual) return;
    if (typeof window === "undefined" || !navigator.mediaDevices) { setError("Camera not available on this device"); return; }
    if (!window.BarcodeDetector) { setError("This browser cannot scan QR — use manual entry."); return; }

    let stream: MediaStream | null = null;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const detector = new window.BarcodeDetector!({ formats: ["qr_code"] });
        const detect: DetectFn = async (v) => {
          try {
            const res = await detector.detect(v);
            return res[0]?.rawValue ?? null;
          } catch { return null; }
        };
        const loop = async () => {
          if (stoppedRef.current || !videoRef.current) return;
          const raw = await detect(videoRef.current);
          if (raw) {
            const id = parseFabUri(raw);
            if (id) { stoppedRef.current = true; router.push(`/worker/parts/${id}`); return; }
          }
          requestAnimationFrame(loop);
        };
        loop();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Camera permission denied");
      }
    })();

    return () => {
      stoppedRef.current = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [manual, router]);

  function submitManual() {
    const id = parseFabUri(manualValue.trim());
    if (id) router.push(`/worker/parts/${id}`);
    else setError("Not a valid part code");
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0F172A", color: "white", maxWidth: 420, margin: "0 auto", padding: 16 }}>
      <header className="flex items-center justify-between mb-4">
        <div className="text-[18px] font-bold">Scan part</div>
        <button onClick={() => router.back()} className="p-2 rounded-md" style={{ background: "transparent", border: "1px solid #1E293B", color: "#94A3B8" }}>
          <X size={16} />
        </button>
      </header>

      {!manual && (
        <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", aspectRatio: "1 / 1", background: "#000" }}>
          <video ref={videoRef} playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: "15%", border: "3px solid rgba(255,255,255,0.6)", borderRadius: 16, pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: 12, left: 0, right: 0, textAlign: "center", color: "#E2E8F0", fontSize: 12 }}>
            <Camera size={14} style={{ display: "inline", marginRight: 6 }} /> Point camera at QR code
          </div>
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-md p-3" style={{ background: "#7F1D1D", color: "#FEE2E2", fontSize: 13 }}>
          <AlertCircle size={14} style={{ display: "inline", marginRight: 6 }} /> {error}
        </div>
      )}

      <button onClick={() => { setManual(!manual); setError(null); }}
        className="w-full mt-4 p-3 rounded-xl flex items-center justify-center gap-2"
        style={{ background: "#1E293B", border: "1px solid #334155", color: "white", fontSize: 14 }}
      >
        <Keyboard size={14} /> {manual ? "Use camera" : "Type code manually"}
      </button>

      {manual && (
        <div className="mt-3">
          <input
            value={manualValue}
            onChange={(e) => setManualValue(e.target.value)}
            placeholder="Paste fabsimple://part/<id> or UUID"
            style={{ width: "100%", padding: 14, borderRadius: 10, background: "#1E293B", border: "1px solid #334155", color: "white", fontSize: 14 }}
          />
          <button onClick={submitManual} className="w-full mt-2 p-3 rounded-xl"
            style={{ background: "#4F46E5", color: "white", border: "none", fontSize: 14, fontWeight: 700 }}>
            Go to part
          </button>
        </div>
      )}
    </div>
  );
}
