"use client";

import Link from "next/link";
import { useAppDispatch } from "@/hooks/useAppRedux";
import { closeNotifPanel } from "@/store/uiSlice";
import { useNotifications, type Notification } from "@/hooks/useNotifications";
import { Loader2 } from "lucide-react";

const iconMap: Record<Notification["type"], { bg: string; text: string; emoji: string }> = {
  ncr_created:   { bg: "var(--red-bg)",   text: "var(--red)",   emoji: "⚠" },
  qc_failure:    { bg: "var(--red-bg)",   text: "var(--red)",   emoji: "⚠" },
  cert_expiry:   { bg: "var(--amber-bg)", text: "var(--amber)", emoji: "📅" },
  inventory_low: { bg: "var(--amber-bg)", text: "var(--amber)", emoji: "📦" },
  co_approved:   { bg: "var(--green-bg)", text: "var(--green)", emoji: "✓" },
  info:          { bg: "var(--blue-bg)",  text: "var(--blue)",  emoji: "ℹ" },
};

const borderMap: Record<Notification["type"], string> = {
  ncr_created: "var(--red-bd)",
  qc_failure: "var(--red-bd)",
  cert_expiry: "var(--amber-bd)",
  inventory_low: "var(--amber-bd)",
  co_approved: "var(--green-bd)",
  info: "var(--blue-bd)",
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  return `${d}d ago`;
}

export function NotifPanel() {
  const dispatch = useAppDispatch();
  const { data, isLoading, markAllRead, unread } = useNotifications();

  return (
    <div
      className="absolute top-full right-0 mt-2 w-80 rounded-xl overflow-hidden z-50"
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-lg)",
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div>
          <span className="font-bold text-[13px]" style={{ color: "var(--text)" }}>Notifications</span>
          {unread > 0 && (
            <span className="ml-2 text-[10px] font-mono" style={{ color: "var(--muted)" }}>
              {unread} unread
            </span>
          )}
        </div>
        <button
          className="text-[11px] font-semibold cursor-pointer disabled:opacity-50"
          style={{ color: "var(--primary)", background: "none", border: "none" }}
          disabled={markAllRead.isPending || unread === 0}
          onClick={() => markAllRead.mutate()}
        >
          {markAllRead.isPending ? "…" : "Mark all read"}
        </button>
      </div>

      <div className="max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="p-8 text-center text-[12px]" style={{ color: "var(--muted)" }}>
            <Loader2 size={16} className="animate-spin inline" /> Loading…
          </div>
        ) : (data ?? []).length === 0 ? (
          <div className="p-8 text-center text-[12px]" style={{ color: "var(--muted)" }}>
            You&apos;re all caught up.
          </div>
        ) : (
          (data ?? []).map((n) => {
            const ic = iconMap[n.type] ?? iconMap.info;
            const body = (
              <div
                key={n.id}
                className="flex gap-3 px-4 py-3 transition-colors"
                style={{
                  borderBottom: "1px solid var(--border)",
                  borderLeft: `3px solid ${borderMap[n.type] ?? borderMap.info}`,
                  background: n.is_read ? "transparent" : "rgba(79,70,229,0.04)",
                  cursor: n.entity_link ? "pointer" : "default",
                }}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-xs flex-shrink-0"
                  style={{ background: ic.bg, color: ic.text }}
                >
                  {ic.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold leading-snug" style={{ color: "var(--text)" }}>{n.title}</p>
                  <p className="text-[12px] leading-snug mb-1" style={{ color: "var(--text-2)" }}>{n.message}</p>
                  <span className="text-[10px] font-mono" style={{ color: "var(--faint)" }}>
                    {relativeTime(n.created_at)}
                  </span>
                </div>
              </div>
            );
            return n.entity_link ? (
              <Link key={n.id} href={n.entity_link} onClick={() => dispatch(closeNotifPanel())} style={{ display: "block", textDecoration: "none" }}>
                {body}
              </Link>
            ) : body;
          })
        )}
      </div>
    </div>
  );
}
