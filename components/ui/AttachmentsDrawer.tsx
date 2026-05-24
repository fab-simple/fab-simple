"use client";

import { FileUploader } from "@/components/ui/FileUploader";
import { X } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  entityType: string;
  entityId: string;
  bucket: "drawings" | "mtrs" | "photos" | "billing";
  title?: string;
  subtitle?: string;
  accept?: string;
}

export function AttachmentsDrawer({ open, onClose, entityType, entityId, bucket, title, subtitle, accept }: Props) {
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40" onClick={onClose} />
      <aside
        className="fixed right-0 top-0 bottom-0 z-50 flex flex-col"
        style={{
          width: 420, maxWidth: "92vw",
          background: "var(--bg-card)",
          borderLeft: "1px solid var(--border)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <div>
            <div className="font-bold text-[14px]" style={{ color: "var(--text)" }}>{title ?? "Attachments"}</div>
            {subtitle && <div className="text-[11px]" style={{ color: "var(--muted)" }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--muted)" }}>
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <FileUploader
            entityType={entityType}
            entityId={entityId}
            bucket={bucket}
            accept={accept}
            label=""
          />
        </div>
      </aside>
    </>
  );
}
