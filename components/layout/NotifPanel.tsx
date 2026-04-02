"use client";

import { NOTIFICATIONS } from "@/lib/mock-data";
import { useAppDispatch } from "@/hooks/useAppRedux";
import { closeNotifPanel } from "@/store/uiSlice";

const iconMap: Record<string, { bg: string; text: string; emoji: string }> = {
  error:   { bg: "var(--red-bg)",   text: "var(--red)",   emoji: "⚠" },
  warning: { bg: "var(--amber-bg)", text: "var(--amber)", emoji: "📦" },
  success: { bg: "var(--green-bg)", text: "var(--green)", emoji: "✓" },
  info:    { bg: "var(--blue-bg)",  text: "var(--blue)",  emoji: "ℹ" },
};

const borderMap: Record<string, string> = {
  error: "var(--red-bd)",
  warning: "var(--amber-bd)",
  success: "var(--green-bd)",
  info: "var(--blue-bd)",
};

export function NotifPanel() {
  const dispatch = useAppDispatch();

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
        <span className="font-bold text-[13px]" style={{ color: "var(--text)" }}>
          Notifications
        </span>
        <button
          className="text-[11px] font-semibold cursor-pointer"
          style={{ color: "var(--primary)", background: "none", border: "none" }}
          onClick={() => dispatch(closeNotifPanel())}
        >
          Mark all read
        </button>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {NOTIFICATIONS.map((n) => {
          const ic = iconMap[n.type] || iconMap.info;
          return (
            <div
              key={n.id}
              className="flex gap-3 px-4 py-3"
              style={{
                borderBottom: "1px solid var(--border)",
                borderLeft: `3px solid ${borderMap[n.type]}`,
              }}
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs flex-shrink-0"
                style={{ background: ic.bg, color: ic.text }}
              >
                {ic.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] leading-snug mb-1" style={{ color: "var(--text-2)" }}>
                  {n.message}
                </p>
                <span className="text-[10px] font-mono" style={{ color: "var(--faint)" }}>
                  {n.created_at}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
