// Global search across projects, parts, drawings, NCRs, change orders, RFIs.
// Each table is queried in parallel with an ilike on its identifying column.
// Returns up to 5 hits per category.

import type { Ctx } from "../lib/types.ts";
import { ok, err } from "../lib/response.ts";

interface Hit {
  kind: "project" | "part" | "drawing" | "ncr" | "change_order" | "rfi";
  id: string;
  label: string;
  subtitle?: string;
  href: string;
}

export async function search(ctx: Ctx): Promise<Response> {
  const q = ctx.url.searchParams.get("q")?.trim();
  if (!q || q.length < 2) return ok({ hits: [], q });
  const like = `%${q}%`;

  const [projects, parts, drawings, ncrs, cos, rfis] = await Promise.all([
    ctx.sb.from("projects").select("id, name, number").or(`name.ilike.${like},number.ilike.${like}`).limit(5),
    ctx.sb.from("parts").select("id, part_mark, profile, project_id").ilike("part_mark", like).limit(5),
    ctx.sb.from("drawings").select("id, drawing_number, title, revision").or(`drawing_number.ilike.${like},title.ilike.${like}`).limit(5),
    ctx.sb.from("ncr_reports").select("id, ncr_number, description").or(`ncr_number.ilike.${like},description.ilike.${like}`).limit(5),
    ctx.sb.from("change_orders").select("id, co_number, description").or(`co_number.ilike.${like},description.ilike.${like}`).limit(5),
    ctx.sb.from("rfis").select("id, rfi_number, question").or(`rfi_number.ilike.${like},question.ilike.${like}`).limit(5),
  ]);

  const hits: Hit[] = [];
  for (const p of projects.data ?? []) hits.push({ kind: "project", id: p.id as string, label: p.name as string, subtitle: p.number as string, href: `/dashboard/projects/${p.id}` });
  for (const p of parts.data ?? []) hits.push({ kind: "part", id: p.id as string, label: p.part_mark as string, subtitle: p.profile as string, href: `/dashboard/parts/${p.id}` });
  for (const d of drawings.data ?? []) hits.push({ kind: "drawing", id: d.id as string, label: `${d.drawing_number} Rev ${d.revision}`, subtitle: d.title as string ?? "", href: "/dashboard/drawings" });
  for (const n of ncrs.data ?? []) hits.push({ kind: "ncr", id: n.id as string, label: n.ncr_number as string, subtitle: (n.description as string)?.slice(0, 80), href: "/dashboard/ncr" });
  for (const c of cos.data ?? []) hits.push({ kind: "change_order", id: c.id as string, label: c.co_number as string, subtitle: (c.description as string)?.slice(0, 80), href: "/dashboard/change-orders" });
  for (const r of rfis.data ?? []) hits.push({ kind: "rfi", id: r.id as string, label: r.rfi_number as string, subtitle: (r.question as string)?.slice(0, 80), href: "/dashboard/rfis" });

  return ok({ hits, q });
}
