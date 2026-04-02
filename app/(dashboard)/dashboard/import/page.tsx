"use client";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { useState } from "react";
import { Upload, CheckCircle, AlertCircle } from "lucide-react";

const IMPORT_COLUMNS = ["Part ID", "Assembly ID", "Drawing No.", "Profile", "Material", "Length", "Weight", "Phase", "Description"];

const SAMPLE_PREVIEW = [
  { id: "W14×82-1044", assembly: "A-101", dwg: "DS-104", profile: "W14×82", material: "A992", length: "29′-6″", weight: 2410 },
  { id: "HSS6×6×0.5-1089", assembly: "A-112", dwg: "DS-112", profile: "HSS6×6×0.5", material: "A500 Gr.C", length: "18′-0″", weight: 861 },
  { id: "MC12×10.6-2001", assembly: "B-201", dwg: "DS-201", profile: "MC12×10.6", material: "A36", length: "22′-3″", weight: 470 },
];

export default function ImportPage() {
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const [dragging, setDragging] = useState(false);

  return (
    <PageWrapper title="Import / Tekla CSV">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          {["upload", "preview", "done"].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                style={{ background: step === s ? "var(--primary)" : i < ["upload", "preview", "done"].indexOf(step) ? "var(--green)" : "var(--border-2)" }}
              >
                {i < ["upload", "preview", "done"].indexOf(step) ? "✓" : i + 1}
              </div>
              <span className="text-[12px] font-semibold capitalize" style={{ color: step === s ? "var(--primary)" : "var(--muted)" }}>{s}</span>
              {i < 2 && <span style={{ color: "var(--border-2)" }}>→</span>}
            </div>
          ))}
        </div>

        {step === "upload" && (
          <div className="card">
            <div className="card-body">
              <div
                className="border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors"
                style={{
                  borderColor: dragging ? "var(--primary)" : "var(--border-2)",
                  background: dragging ? "var(--primary-bg)" : "var(--bg-muted)",
                }}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={() => { setDragging(false); setStep("preview"); }}
                onClick={() => setStep("preview")}
              >
                <Upload size={32} className="mx-auto mb-3" style={{ color: dragging ? "var(--primary)" : "var(--muted)" }} />
                <div className="font-bold text-[14px] mb-1" style={{ color: "var(--text)" }}>Drop Tekla CSV or click to browse</div>
                <div className="text-[12px]" style={{ color: "var(--muted)" }}>Supports Tekla Structures .csv export format</div>
              </div>

              <div className="mt-5" style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                <div className="font-semibold text-[12px] mb-2" style={{ color: "var(--text)" }}>Expected Column Mapping:</div>
                <div className="flex flex-wrap gap-1.5">
                  {IMPORT_COLUMNS.map((c) => (
                    <span key={c} className="pill pill-info">{c}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="card">
            <div className="card-header">
              <div className="card-title">CSV Preview — 3 of 47 rows</div>
              <div className="flex items-center gap-2">
                <CheckCircle size={13} style={{ color: "var(--green)" }} />
                <span className="text-[12px]" style={{ color: "var(--green)" }}>44 valid · 0 errors</span>
                <AlertCircle size={13} style={{ color: "#D97706" }} />
                <span className="text-[12px]" style={{ color: "#D97706" }}>3 warnings</span>
              </div>
            </div>
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr><th>Part ID</th><th>Assembly</th><th>Drawing</th><th>Profile</th><th>Material</th><th>Length</th><th>Weight</th></tr>
                </thead>
                <tbody>
                  {SAMPLE_PREVIEW.map((r) => (
                    <tr key={r.id}>
                      <td className="td-mono">{r.id}</td>
                      <td className="font-mono text-[11px]" style={{ color: "var(--primary)" }}>{r.assembly}</td>
                      <td className="td-mono">{r.dwg}</td>
                      <td className="td-mono">{r.profile}</td>
                      <td style={{ fontSize: 12 }}>{r.material}</td>
                      <td className="td-mono">{r.length}</td>
                      <td className="td-mono">{r.weight}</td>
                    </tr>
                  ))}
                  <tr><td colSpan={7} className="text-center py-2 text-[11px]" style={{ color: "var(--faint)" }}>… 44 more rows</td></tr>
                </tbody>
              </table>
            </div>
            <div className="card-body" style={{ borderTop: "1px solid var(--border)" }}>
              <div className="flex gap-3 justify-end">
                <button className="btn" onClick={() => setStep("upload")}>← Back</button>
                <button className="btn btn-primary" onClick={() => setStep("done")}>Import 47 Parts →</button>
              </div>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="card">
            <div className="card-body text-center py-12">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: "var(--green-bg)" }}>
                <CheckCircle size={32} style={{ color: "var(--green)" }} />
              </div>
              <div className="font-bold text-[18px] mb-2" style={{ color: "var(--text)" }}>Import Complete!</div>
              <div className="text-[13px] mb-6" style={{ color: "var(--muted)" }}>47 parts imported to Dallas Skyline Tower. Parts are now visible in the Parts List.</div>
              <div className="flex gap-3 justify-center">
                <button className="btn" onClick={() => setStep("upload")}>Import Another</button>
                <button className="btn btn-primary" onClick={() => window.location.href = "/dashboard/parts"}>View Parts →</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageWrapper>
  );
}
