"use client";

import { useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FabAPI, getToken } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

export interface Notification {
  id: string;
  type: "cert_expiry" | "inventory_low" | "qc_failure" | "ncr_created" | "co_approved" | "info";
  title: string;
  message: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_link: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

const FAB_MODE = process.env.NEXT_PUBLIC_FAB_MODE ?? "demo";

export function useNotifications() {
  const qc = useQueryClient();

  const q = useQuery<Notification[]>({
    queryKey: ["notifications", "list"],
    queryFn: () => FabAPI.list<Notification>("notifications", {
      order_by: "created_at", dir: "desc", limit: 50,
    }),
    enabled: FAB_MODE === "live" && !!getToken(),
    refetchInterval: 60_000,
  });

  const unread = useMemo(() => (q.data ?? []).filter((n) => !n.is_read).length, [q.data]);

  // Realtime: invalidate the list when a new notification arrives
  useEffect(() => {
    if (FAB_MODE !== "live") return;
    const sb = createClient();
    const channel = sb
      .channel("notifications_realtime")
      .on("postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => { qc.invalidateQueries({ queryKey: ["notifications"] }); }
      )
      .subscribe();
    return () => { sb.removeChannel(channel); };
  }, [qc]);

  const markAllRead = useMutation<unknown, Error, void>({
    mutationFn: () => FabAPI.markAllNotificationsRead(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return { ...q, unread, markAllRead };
}
