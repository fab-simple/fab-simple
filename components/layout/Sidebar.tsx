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
          className="fixed inset-0 z-40 bg-slate-900/80 backdrop-blur-sm lg:hidden"
          onClick={close}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex flex-col h-full
          lg:static lg:translate-x-0 lg:z-auto
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
        style={{
          background: "var(--sidebar)",
          borderRight: "1px solid var(--sidebar-border)",
          width: 256,
          minWidth: 256,
          flexShrink: 0,
        }}
      >
        {/* Logo Header */}
        <div
          className="flex items-center gap-3 px-5 flex-shrink-0"
          style={{ height: 64 }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(255, 255, 255, 0.1)" }}
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="0" y="0" width="8" height="8" fill="white" rx="1.5" />
              <rect x="12" y="0" width="8" height="8" fill="white" rx="1.5" opacity="0.5" />
              <rect x="0" y="12" width="8" height="8" fill="white" rx="1.5" opacity="0.5" />
              <rect x="12" y="12" width="8" height="8" fill="white" rx="1.5" opacity="0.85" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white font-semibold text-[15px] tracking-tight">FabSimple</div>
          </div>
          <button
            onClick={close}
            className="lg:hidden p-1.5 rounded-md text-slate-400 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {NAV_SECTIONS.map((section, si) => (
            <div key={section.label} style={{ marginTop: si === 0 ? 0 : 24 }}>
              {/* Subtle Section Header */}
              {section.label !== "Overview" && (
                <div
                  className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-500"
                >
                  {section.label}
                </div>
              )}

              {/* Items List */}
              <div className="flex flex-col gap-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  // Exact match for dashboard root, fuzzy for subroutes
                  const active =
                    item.href === "/dashboard"
                      ? pathname === "/dashboard"
                      : pathname.startsWith(item.href);

                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      onClick={() => window.innerWidth < 1024 && close()}
                      className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors group relative"
                      style={{
                        background: active ? "var(--sidebar-active, rgba(255,255,255,0.1))" : "transparent",
                        color: active ? "#ffffff" : "rgba(255, 255, 255, 0.65)",
                        textDecoration: "none"
                      }}
                      onMouseEnter={(e) => {
                        if (!active) {
                          e.currentTarget.style.color = "#ffffff";
                          e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!active) {
                          e.currentTarget.style.color = "rgba(255, 255, 255, 0.65)";
                          e.currentTarget.style.background = "transparent";
                        }
                      }}
                    >
                      {active && (
                        <div
                          className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full"
                          style={{ background: "var(--primary)" }}
                        />
                      )}
                      <Icon
                        size={16}
                        strokeWidth={active ? 2.5 : 2}
                        className={active ? "" : "transition-colors opacity-70 group-hover:opacity-100"}
                        color={active ? "var(--primary-bd)" : "currentColor"}
                      />
                      <span className="flex-1 text-[13px] font-medium leading-none">
                        {item.label}
                      </span>
                      {item.badge && (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded leading-none ${item.badgeClass || (active ? "bg-white/20 text-white" : "bg-white/10 text-white/70")
                            }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer — User profile */}
        <div className="flex-shrink-0 p-3" style={{ borderTop: "1px solid var(--sidebar-border)" }}>
          <div
            className="flex items-center gap-3 w-full p-2 rounded-md transition-colors cursor-pointer group"
            style={{ background: "transparent" }}
            onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0 shadow-sm"
              style={{ background: avatarColor }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium text-white truncate leading-tight">
                {name}
              </div>
              <div className="text-[11px] text-white/50 capitalize leading-tight mt-0.5">
                {role}
              </div>
            </div>
            <button
              className="p-1.5 rounded-md text-white/50 group-hover:text-white group-hover:bg-white/10 transition-all border-none bg-transparent cursor-pointer"
              title="Sign out"
              onClick={() => (window.location.href = "/")}
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
