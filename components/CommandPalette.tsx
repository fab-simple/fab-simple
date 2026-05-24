"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FabAPI, type SearchHit } from "@/lib/api";
import { Search, Loader2, FolderKanban, ListChecks, FileText, AlertTriangle, FileDiff, FileQuestion, ArrowRight } from "lucide-react";

const KIND_ICON: Record<SearchHit["kind"], React.ComponentType<{ size?: number }>> = {
  project: FolderKanban,
  part: ListChecks,
  drawing: FileText,
  ncr: AlertTriangle,
  change_order: FileDiff,
  rfi: FileQuestion,
};

const QUICK_LINKS: { label: string; href: string }[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Projects", href: "/dashboard/projects" },
  { label: "Parts", href: "/dashboard/parts" },
  { label: "Cut List Optimizer", href: "/dashboard/cut-list" },
  { label: "Import CSV", href: "/dashboard/import" },
  { label: "Paint Inspection", href: "/dashboard/paint-inspection" },
  { label: "NCR Reports", href: "/dashboard/ncr" },
  { label: "AISC 303 QC", href: "/dashboard/aisc" },
  { label: "Billing", href: "/dashboard/billing" },
  { label: "Live Activity", href: "/dashboard/live-activity" },
];

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K to toggle
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((s) => !s);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setCursor(0);
    } else {
      setQ(""); setHits([]);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (!q || q.length < 2) { setHits([]); return; }
    setBusy(true);
    const handle = setTimeout(async () => {
      try {
        const res = await FabAPI.search(q);
        setHits(res.hits);
      } catch { setHits([]); }
      finally { setBusy(false); }
    }, 200);
    return () => clearTimeout(handle);
  }, [q]);

  const items = q.length >= 2
    ? hits.map((h) => ({ label: h.label, subtitle: h.subtitle, href: h.href, kind: h.kind as keyof typeof KIND_ICON | undefined }))
    : QUICK_LINKS.filter((l) => !q || l.label.toLowerCase().includes(q.toLowerCase()))
                .map((l) => ({ label: l.label, subtitle: undefined, href: l.href, kind: undefined }));

  function go(href: string) { setOpen(false); router.push(href); }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor((c) => Math.min(c + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    else if (e.key === "Enter" && items[cursor]) { e.preventDefault(); go(items[cursor].href); }
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center" style={{ background: "rgba(15,23,42,0.55)", paddingTop: "10vh" }} onClick={() => setOpen(false)}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: 560, maxWidth: "90vw", boxShadow: "var(--shadow-lg)" }}>
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <Search size={16} style={{ color: "var(--muted)" }} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setCursor(0); }}
            onKeyDown={onKeyDown}
            placeholder="Search projects, parts, drawings, NCRs… or jump to a page"
            className="flex-1"
            style={{ border: "none", outline: "none", background: "transparent", fontSize: 14, color: "var(--text)" }}
          />
          {busy && <Loader2 size={14} className="animate-spin" style={{ color: "var(--muted)" }} />}
          <kbd style={{ fontSize: 10, padding: "2px 6px", border: "1px solid var(--border)", borderRadius: 4, color: "var(--muted)" }}>esc</kbd>
        </div>
        <div style={{ maxHeight: 360, overflowY: "auto", padding: 4 }}>
          {items.length === 0 && q.length >= 2 && (
            <div className="p-6 text-center text-[12px]" style={{ color: "var(--muted)" }}>No matches</div>
          )}
          {items.map((it, i) => {
            const Icon = it.kind ? KIND_ICON[it.kind] : ArrowRight;
            return (
              <Link
                key={it.href + i}
                href={it.href}
                onClick={() => setOpen(false)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "8px 12px", borderRadius: 6, textDecoration: "none",
                  background: i === cursor ? "rgba(79,70,229,0.08)" : "transparent",
                  color: "var(--text)",
                }}
              >
                <div style={{ width: 24, height: 24, background: "var(--bg-muted)", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Icon size={12} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="text-[13px] font-semibold" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</div>
                  {it.subtitle && (
                    <div className="text-[11px]" style={{ color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.subtitle}</div>
                  )}
                </div>
                {it.kind && (
                  <span className="pill" style={{ fontSize: 9, padding: "2px 6px", textTransform: "uppercase" }}>{it.kind.replace("_", " ")}</span>
                )}
              </Link>
            );
          })}
        </div>
        <div className="flex items-center justify-between px-4 py-2" style={{ borderTop: "1px solid var(--border)", fontSize: 10, color: "var(--muted)" }}>
          <div>↑ ↓ navigate · ↵ open · esc close</div>
          <div>⌘K to toggle</div>
        </div>
      </div>
    </div>
  );
}
