"use client";

import { type ReactNode } from "react";
import { Loader2, X } from "lucide-react";

export function ResourceModal({
  title, onClose, onSubmit, submitting, error, children, submitLabel = "Save",
  width = 480,
}: {
  title: string;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  submitting?: boolean;
  error?: string | null;
  children: ReactNode;
  submitLabel?: string;
  width?: number;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(15,23,42,0.5)" }} onClick={onClose}>
      <div className="card" style={{ width, maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div className="card-header" style={{ position: "sticky", top: 0, zIndex: 5, background: "var(--bg-card)" }}>
          <div className="card-title">{title}</div>
          <button type="button" onClick={onClose} className="btn btn-sm" style={{ padding: 6, height: 28, width: 28, justifyContent: "center" }}>
            <X size={14} />
          </button>
        </div>
        <form className="card-body" onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {children}
          {error && <div className="pill pill-red" style={{ padding: "8px 12px", fontSize: 12 }}>{error}</div>}
          <div className="flex justify-end gap-2 mt-2">
            <button type="button" onClick={onClose} className="btn">Cancel</button>
            <button type="submit" disabled={submitting} className="btn btn-primary">
              {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
              {submitting ? "Saving…" : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function Field({ label, required, children, hint }: { label: string; required?: boolean; children: ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] uppercase font-semibold tracking-wider" style={{ color: "var(--muted)" }}>
        {label}{required && <span style={{ color: "#DC2626" }}> *</span>}
      </span>
      {children}
      {hint && <span className="text-[11px]" style={{ color: "var(--muted)" }}>{hint}</span>}
    </label>
  );
}
