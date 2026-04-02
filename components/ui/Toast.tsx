"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { X } from "lucide-react";

type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

const CONFIG: Record<ToastType, { bg: string; border: string; color: string; emoji: string }> = {
  success: { bg: "var(--green-bg)", border: "var(--green-bd)", color: "var(--green)", emoji: "✓" },
  error:   { bg: "var(--red-bg)",   border: "var(--red-bd)",   color: "var(--red)",   emoji: "✕" },
  warning: { bg: "var(--amber-bg)", border: "var(--amber-bd)", color: "var(--amber)", emoji: "⚠" },
  info:    { bg: "#0F172A",         border: "#1E293B",          color: "#fff",         emoji: "ℹ" },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: ToastType = "success") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div id="toast-root">
        {toasts.map((t) => {
          const cfg = CONFIG[t.type];
          return (
            <div
              key={t.id}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-[13px] font-semibold pointer-events-auto"
              style={{
                background: cfg.bg,
                border: `1px solid ${cfg.border}`,
                color: cfg.color,
                boxShadow: "var(--shadow-lg)",
                minWidth: "260px",
                maxWidth: "380px",
              }}
            >
              <span className="text-sm flex-shrink-0">{cfg.emoji}</span>
              <span className="flex-1">{t.message}</span>
              <button
                onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                style={{ background: "none", border: "none", cursor: "pointer", color: cfg.color, opacity: 0.6 }}
              >
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
