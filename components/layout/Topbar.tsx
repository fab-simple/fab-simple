"use client";

import { Bell, Menu, Download, Search } from "lucide-react";
import { useAppSelector, useAppDispatch } from "@/hooks/useAppRedux";
import { toggleSidebar, toggleNotifPanel, closeNotifPanel } from "@/store/uiSlice";
import { NotifPanel } from "./NotifPanel";
import { useNotifications } from "@/hooks/useNotifications";
import { downloadCurrentCsv } from "@/lib/csv-export";
import { useEffect, useRef } from "react";

export function Topbar() {
  const dispatch = useAppDispatch();
  const pageTitle = useAppSelector((s) => s.ui.pageTitle);
  const notifOpen = useAppSelector((s) => s.ui.notifPanelOpen);
  const panelRef = useRef<HTMLDivElement>(null);
  const { unread } = useNotifications();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        dispatch(closeNotifPanel());
      }
    }
    if (notifOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [notifOpen, dispatch]);

  return (
    <header
      className="flex items-center gap-3 px-4 md:px-6 h-14 flex-shrink-0 relative z-30"
      style={{
        background: "var(--bg-card)",
        borderBottom: "1px solid var(--border)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      {/* Mobile hamburger */}
      <button
        className="lg:hidden p-2 rounded-lg transition-colors hover:bg-slate-100"
        style={{ color: "var(--muted)", border: "1px solid var(--border)" }}
        onClick={() => dispatch(toggleSidebar())}
      >
        <Menu size={16} />
      </button>

      <h1 className="flex-1 font-bold text-[16px]" style={{ color: "var(--text)" }}>
        {pageTitle}
      </h1>

      <button
        onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
        className="hidden md:inline-flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors"
        style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--muted)", fontSize: 12, cursor: "pointer", marginRight: 8 }}
        title="Search (⌘K)"
      >
        <Search size={12} />
        <span>Search…</span>
        <kbd style={{ fontSize: 10, padding: "1px 5px", borderRadius: 3, background: "var(--bg-muted)" }}>⌘K</kbd>
      </button>

      <div className="flex items-center gap-2">
        <button
          className="btn btn-sm hidden sm:inline-flex"
          onClick={downloadCurrentCsv}
          title="Download visible data as CSV"
        >
          <Download size={13} />
          Export CSV
        </button>

        {/* Notification bell */}
        <div className="relative" ref={panelRef}>
          <button
            className="relative p-2 rounded-lg transition-colors"
            style={{
              background: "transparent",
              border: "1px solid var(--border)",
              color: "var(--muted)",
              cursor: "pointer",
            }}
            onClick={() => dispatch(toggleNotifPanel())}
          >
            <Bell size={15} />
            {unread > 0 && (
              <span
                className="absolute -top-1 -right-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white leading-none"
                style={{ background: "#DC2626" }}
              >
                {unread > 99 ? "99+" : unread}
              </span>
            )}
          </button>
          {notifOpen && <NotifPanel />}
        </div>
      </div>
    </header>
  );
}
