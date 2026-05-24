"use client";

import { useEffect } from "react";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { useResourceList } from "@/hooks/useResource";
import { createClient } from "@/lib/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Activity } from "lucide-react";

interface ActivityItem {
  id: string; user_name: string | null; action: string;
  entity_type: string; entity_label: string | null; created_at: string;
  metadata: Record<string, unknown> | null;
}

const COLORS = ["#4F46E5", "#2563EB", "#7C3AED", "#EA580C", "#DC2626", "#0D9488", "#16A34A"];

export default function LiveActivityPage() {
  const list = useResourceList<ActivityItem>("activity_feed", { order_by: "created_at", dir: "desc", limit: "100" });
  const qc = useQueryClient();

  // Subscribe to realtime inserts and invalidate the query
  useEffect(() => {
    const sb = createClient();
    const channel = sb
      .channel("activity_feed_changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_feed" }, () => {
        qc.invalidateQueries({ queryKey: ["activity_feed"] });
      })
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, [qc]);

  return (
    <PageWrapper title="Live Activity">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[20px] font-bold" style={{ color: "var(--text)" }}>Live Activity</div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>Real-time stream of shop floor + admin events</div>
        </div>
        <span className="pill pill-done" style={{ fontSize: 11, padding: "4px 10px" }}>● Live</span>
      </div>

      {list.isLoading ? (
        <div className="card" style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
          <Loader2 size={18} className="animate-spin" style={{ display: "inline" }} /> Loading…
        </div>
      ) : (
        <div className="card">
          <div className="card-body" style={{ padding: 0 }}>
            {(list.data ?? []).map((a, i) => (
              <div key={a.id} className="flex items-start gap-3 p-3" style={{ borderBottom: "1px solid var(--bg-muted)" }}>
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0"
                  style={{ background: COLORS[i % COLORS.length] }}
                >
                  {(a.user_name ?? "?").slice(0, 1)}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="text-[13px]">
                    <span className="font-semibold" style={{ color: "var(--text)" }}>{a.user_name ?? "System"}</span>
                    <span style={{ color: "var(--muted)" }}> {a.action} </span>
                    {a.entity_label && (
                      <span className="font-mono font-bold" style={{ color: "var(--primary)" }}>{a.entity_label}</span>
                    )}
                  </div>
                  <div className="text-[11px] font-mono" style={{ color: "var(--faint)", marginTop: 2 }}>
                    {new Date(a.created_at).toLocaleString()}
                  </div>
                </div>
                <Activity size={14} style={{ color: "var(--faint)" }} />
              </div>
            ))}
            {!list.data?.length && (
              <div className="p-8 text-center text-[12px]" style={{ color: "var(--muted)" }}>
                No activity yet. Update a part status, create a project, or run a QC inspection to see events here.
              </div>
            )}
          </div>
        </div>
      )}
    </PageWrapper>
  );
}
