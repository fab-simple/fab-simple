"use client";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { ACTIVITY_FEED } from "@/lib/mock-data";

const DOT_COLORS: Record<string, string> = {
  "status_update": "var(--primary)",
  "inspection": "var(--green)",
  "receiving": "#D97706",
  "shipping": "var(--teal)",
  "qc": "var(--violet)",
};

export default function LiveActivityPage() {
  return (
    <PageWrapper title="Live Activity Feed">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-[13px] font-semibold" style={{ color: "var(--text)" }}>Live — updates every 30s</span>
        <span className="pill pill-done ml-2">Online</span>
      </div>

      <div className="card">
        <div className="card-body">
          {ACTIVITY_FEED.map((a, i) => (
            <div
              key={a.id}
              className="flex items-start gap-3 py-3 relative"
              style={{ borderBottom: i < ACTIVITY_FEED.length - 1 ? "1px solid var(--bg-muted)" : "none" }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                style={{ background: a.color }}
              >
                {a.user_name.slice(0, 1)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-[13px]" style={{ color: "var(--text)" }}>{a.user_name}</span>
                  <span className="text-[12px]" style={{ color: "var(--muted)" }}>{a.action}</span>
                  <span className="font-mono text-[11px] font-bold" style={{ color: "var(--primary)" }}>{a.entity_id}</span>
                </div>
                {a.detail && (
                  <div className="text-[12px] mt-0.5" style={{ color: "var(--muted)" }}>{a.detail}</div>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: DOT_COLORS[a.category]?.replace(")", "-bg)").replace("var(--", "var(--") || "var(--bg-muted)", color: DOT_COLORS[a.category] || "var(--muted)" }}
                  >
                    {a.category.replace("_", " ")}
                  </span>
                  <span className="font-mono text-[10px]" style={{ color: "var(--faint)" }}>{a.time}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageWrapper>
  );
}
