"use client";

import { useEffect, useState } from "react";
import { FabAPI, uploadFile, type FileAttachment } from "@/lib/api";
import { Upload, Loader2, Trash2, FileText, Download } from "lucide-react";

type Bucket = "drawings" | "mtrs" | "photos" | "billing";

interface Props {
  entityType: string;
  entityId: string;
  bucket: Bucket;
  accept?: string;
  label?: string;
  maxFiles?: number;
}

export function FileUploader({ entityType, entityId, bucket, accept, label = "Attachments", maxFiles = 20 }: Props) {
  const [files, setFiles] = useState<FileAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    try {
      const list = await FabAPI.listFiles(entityType, entityId);
      setFiles(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally { setLoading(false); }
  }
  useEffect(() => { if (entityId) refresh(); /* eslint-disable-next-line */ }, [entityId, entityType]);

  async function handleFile(f: File) {
    setUploading(true); setError(null);
    try {
      await uploadFile({ file: f, entity_type: entityType, entity_id: entityId, bucket });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally { setUploading(false); }
  }

  async function openFile(id: string) {
    try {
      const { url } = await FabAPI.signRead(id);
      window.open(url, "_blank");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cannot open file");
    }
  }

  async function deleteFile(id: string) {
    if (!confirm("Delete this attachment?")) return;
    try {
      await FabAPI.deleteFile(id);
      setFiles((f) => f.filter((x) => x.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] uppercase font-semibold tracking-wider" style={{ color: "var(--muted)" }}>
          {label} {files.length > 0 && `(${files.length})`}
        </span>
        <label className="btn btn-sm" style={{ cursor: files.length >= maxFiles ? "not-allowed" : "pointer", opacity: files.length >= maxFiles ? 0.5 : 1 }}>
          {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
          {uploading ? "Uploading…" : "Add file"}
          <input
            type="file"
            accept={accept}
            style={{ display: "none" }}
            disabled={uploading || files.length >= maxFiles}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
        </label>
      </div>

      {error && (
        <div className="pill pill-red" style={{ padding: "6px 10px", fontSize: 11, marginBottom: 8 }}>{error}</div>
      )}

      {loading ? (
        <div className="text-[12px]" style={{ color: "var(--muted)" }}><Loader2 size={12} className="animate-spin inline" /> Loading…</div>
      ) : files.length === 0 ? (
        <div className="text-[12px] p-4 rounded" style={{ background: "var(--bg-muted)", color: "var(--muted)", textAlign: "center" }}>
          No files yet
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {files.map((f) => (
            <div key={f.id} className="flex items-center gap-2 p-2 rounded" style={{ background: "var(--bg-muted)" }}>
              <FileText size={14} style={{ color: "var(--muted)", flexShrink: 0 }} />
              <button
                onClick={() => openFile(f.id)}
                className="text-[12px] font-medium flex-1 text-left truncate"
                style={{ color: "var(--primary)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                title={f.storage_path}
              >
                {f.storage_path.split("/").pop()}
              </button>
              <span className="text-[10px] font-mono" style={{ color: "var(--faint)" }}>
                {f.size_bytes ? `${(f.size_bytes / 1024).toFixed(1)} KB` : "—"}
              </span>
              <button onClick={() => openFile(f.id)} title="Download" className="p-1 rounded" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--muted)" }}>
                <Download size={12} />
              </button>
              <button onClick={() => deleteFile(f.id)} title="Delete" className="p-1 rounded" style={{ background: "transparent", border: "none", cursor: "pointer", color: "#DC2626" }}>
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
