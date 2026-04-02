"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_SECTIONS, type NavItem } from "@/lib/nav-config";
import { useAppSelector, useAppDispatch } from "@/hooks/useAppRedux";
import { setSidebarOpen } from "@/store/uiSlice";
import { LogOut, X } from "lucide-react";

export function Sidebar() {
  const pathname = usePathname();
  const dispatch = useAppDispatch();
  const sidebarOpen = useAppSelector((s) => s.ui.sidebarOpen);
  const { name, role, initials, avatarColor } = useAppSelector((s) => s.auth);

  const close = () => dispatch(setSidebarOpen(false));

  return (
    <>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={close}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-60 flex flex-col
          lg:static lg:translate-x-0 lg:z-auto
          transition-transform duration-200 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
        style={{ background: "var(--sidebar)" }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-2.5 px-4 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--sidebar-border)" }}
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.18)" }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1" y="1" width="6" height="6" fill="white" rx="1" />
              <rect x="9" y="1" width="6" height="6" fill="white" rx="1" opacity=".5" />
              <rect x="1" y="9" width="6" height="6" fill="white" rx="1" opacity=".5" />
              <rect x="9" y="9" width="6" height="6" fill="white" rx="1" opacity=".8" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white font-bold text-[15px] tracking-tight">FabSimple</div>
            <div className="text-[10px] font-mono" style={{ color: "rgba(255,255,255,0.35)" }}>v4.0 · US Edition</div>
          </div>
          <button
            onClick={close}
            className="lg:hidden p-1 rounded-md transition-colors"
            style={{ color: "rgba(255,255,255,0.5)" }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2 px-2">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} className="mb-1">
              <div
                className="px-2 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest"
                style={{ color: "rgba(255,255,255,0.3)" }}
              >
                {section.label}
              </div>
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    onClick={() => window.innerWidth < 1024 && close()}
                    className={`
                      flex items-center gap-2 px-2.5 py-[6px] mx-1 rounded-lg text-[13px] font-medium
                      transition-all duration-100 group relative
                      ${active ? "text-white" : "hover:text-white"}
                    `}
                    style={{
                      color: active ? "#fff" : "rgba(255,255,255,0.62)",
                      background: active
                        ? "rgba(255,255,255,0.13)"
                        : undefined,
                    }}
                    onMouseEnter={(e) => {
                      if (!active)
                        (e.currentTarget as HTMLElement).style.background =
                          "rgba(255,255,255,0.07)";
                    }}
                    onMouseLeave={(e) => {
                      if (!active)
                        (e.currentTarget as HTMLElement).style.background = "";
                    }}
                  >
                    <Icon size={15} className="flex-shrink-0" />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge && (
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${item.badgeClass}`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div
          className="p-3 flex-shrink-0"
          style={{ borderTop: "1px solid var(--sidebar-border)" }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
              style={{ background: avatarColor }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-semibold truncate" style={{ color: "rgba(255,255,255,0.85)" }}>
                {name}
              </div>
              <div className="text-[10px] capitalize" style={{ color: "rgba(255,255,255,0.4)" }}>
                {role}
              </div>
            </div>
            <button
              className="p-1.5 rounded-md transition-colors hover:text-white"
              style={{ color: "rgba(255,255,255,0.4)", background: "transparent", border: "none", cursor: "pointer" }}
              title="Sign out"
              onClick={() => window.location.href = "/"}
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
