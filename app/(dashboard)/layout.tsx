"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full" style={{ background: "var(--bg)" }}>
      {/* Sidebar with right border separator */}
      <div style={{ borderRight: "1px solid var(--border)", flexShrink: 0 }}>
        <Sidebar />
      </div>

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar />
        {/* Constrained content: max-width + centered */}
        <main className="flex-1 overflow-y-auto">
          <div
            style={{
              maxWidth: 1280,
              margin: "0 auto",
              padding: "32px 40px",
            }}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
