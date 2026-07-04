// Owner / PM dashboard aggregates. All queries fan out in parallel and assemble
// the response in a single pass. The frontend hits this once on load + on
// realtime invalidation, so cutting from 9 sequential round-trips to 1 parallel
// batch is the single biggest performance win on the platform.

import type { Ctx } from "../lib/types.ts";
import { ok } from "../lib/response.ts";

// project_status enum is ('active','on_hold','completed','archived').
// "Active" for dashboard purposes covers active + on_hold (still on the books).
const ACTIVE_PROJECT_STATUSES = ["active", "on_hold"];

export async function dashboard(ctx: Ctx): Promise<Response> {
  const { sb, user } = ctx;
  const wantsFinancial = user.role === "owner" || user.role === "accounting";

  const [
    partsRes,
    projectsRes,
    certsRes,
    invRes,
    activityRes,
    ncrsRes,
    cosRes,
    rfisRes,
    billingRes,
    poRes,
    recentPartsRes,
    dailyLogRes,
  ] = await Promise.all([
    sb.from("parts").select("id,status,weight,project_id").limit(50000),
    sb.from("projects")
      .select("id,name,number,gc_name,contract_value,deadline,status,color,pm_id")
      .in("status", ACTIVE_PROJECT_STATUSES)
      .order("deadline", { ascending: true })
      .limit(20),
    sb.from("certifications").select("id,cert_type,holder_name,expiry_date,alert_days"),
    sb.from("inventory")
      .select("id,profile,grade,quantity,reorder_point,status")
      .in("status", ["low", "out"]),
    sb.from("activity_feed").select("*").order("created_at", { ascending: false }).limit(10),
    sb.from("ncr_reports").select("id,ncr_number,description,status").in("status", ["open", "in_progress"]).limit(20),
    sb.from("change_orders").select("id,co_number,amount,status").eq("status", "pending").limit(20),
    sb.from("rfis").select("id,rfi_number,question,status").eq("status", "open").limit(20),
    wantsFinancial
      ? sb.from("billing_applications").select("amount_due,retainage_withheld,status,completed_to_date")
      : Promise.resolve({ data: null, error: null }),
    wantsFinancial
      ? sb.from("purchase_orders").select("total_amount,status")
      : Promise.resolve({ data: null, error: null }),
    // Recent parts for the "Recent Parts" card on the dashboard.
    sb.from("parts")
      .select("id,part_mark,profile,status,project_id,updated_at,projects(name)")
      .order("updated_at", { ascending: false })
      .limit(6),
    // Last 7 days of production log entries for the bar chart.
    sb.from("daily_production_log")
      .select("log_date,station,parts_completed,operation_type")
      .gte("log_date", new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10))
      .order("log_date", { ascending: true })
      .limit(50),
  ]);

  const parts = partsRes.data ?? [];
  const projectsRaw = projectsRes.data ?? [];
  const partsByStatus: Record<string, number> = {
    not_started: 0, ordered: 0, in_progress: 0, complete: 0, shipped: 0, on_hold: 0,
  };
  let totalWeight = 0;
  // Bucket parts by project for project-level progress in one pass
  const partsByProject = new Map<string, { total: number; completed: number }>();
  for (const p of parts) {
    const status = p.status as string;
    partsByStatus[status] = (partsByStatus[status] ?? 0) + 1;
    totalWeight += Number(p.weight ?? 0);
    const pid = p.project_id as string | null;
    if (pid) {
      const bucket = partsByProject.get(pid) ?? { total: 0, completed: 0 };
      bucket.total += 1;
      if (status === "complete" || status === "shipped") bucket.completed += 1;
      partsByProject.set(pid, bucket);
    }
  }

  const projects = projectsRaw.map((proj) => {
    const bucket = partsByProject.get(proj.id as string) ?? { total: 0, completed: 0 };
    const progress = bucket.total === 0 ? 0 : Math.round((bucket.completed / bucket.total) * 100);
    return { ...proj, total_parts: bucket.total, completed: bucket.completed, progress };
  });

  let financial: Record<string, number> | null = null;
  if (wantsFinancial) {
    const billing = billingRes.data ?? [];
    const poRows = poRes.data ?? [];
    const backlog = projectsRaw.reduce((s, p) => s + Number(p.contract_value ?? 0), 0);
    const billed = billing.filter((b) => b.status !== "draft")
      .reduce((s, b) => s + Number(b.completed_to_date ?? 0), 0);
    const retainage = billing.reduce((s, b) => s + Number(b.retainage_withheld ?? 0), 0);
    const collected = billing.filter((b) => b.status === "paid")
      .reduce((s, b) => s + Number(b.completed_to_date ?? 0), 0);
    const poTotal = poRows.reduce((s, p) => s + Number(p.total_amount ?? 0), 0);
    financial = { backlog, billed, retainage_held: retainage, collected, po_total: poTotal };
  }

  const today = Date.now();
  const certAlerts = (certsRes.data ?? []).filter((c) => {
    const expiry = +new Date(c.expiry_date as string);
    const days = Math.ceil((expiry - today) / 86400000);
    return days <= (c.alert_days as number);
  });

  // Reduce the last week of production logs into a per-day total for the chart.
  const dailyMap = new Map<string, number>();
  for (const row of (dailyLogRes.data ?? []) as Array<{ log_date: string; parts_completed: number }>) {
    dailyMap.set(row.log_date, (dailyMap.get(row.log_date) ?? 0) + (row.parts_completed ?? 0));
  }
  const productionByDay = Array.from(dailyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, parts_completed]) => ({ date, parts_completed }));

  const recentParts = (recentPartsRes.data ?? []).map((p) => ({
    id: p.id as string,
    part_mark: p.part_mark as string,
    profile: p.profile as string,
    status: p.status as string,
    project_id: p.project_id as string | null,
    project_name: (p.projects as { name?: string } | null)?.name ?? null,
  }));

  return ok({
    parts_by_status: partsByStatus,
    total_parts: parts.length,
    total_weight: totalWeight,
    projects,
    financial,
    cert_alerts: certAlerts,
    inventory_alerts: invRes.data ?? [],
    activity: activityRes.data ?? [],
    open_ncrs: ncrsRes.data ?? [],
    open_change_orders: cosRes.data ?? [],
    open_rfis: rfisRes.data ?? [],
    recent_parts: recentParts,
    production_by_day: productionByDay,
  });
}
