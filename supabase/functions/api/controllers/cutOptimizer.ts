// 1D cut list optimizer — first-fit-decreasing bin packing with kerf allowance.

import type { Ctx } from "../lib/types.ts";
import { ok, err } from "../lib/response.ts";
import { writeAudit } from "../services/audit.ts";

interface CutRequest {
  project_id?: string;
  profile: string;
  stock_length: number;
  kerf?: number;
  min_remnant?: number;
  cuts: { length: number; qty: number; mark?: string }[];
}

interface PackedBar {
  bar_index: number;
  cuts: { length: number; mark?: string }[];
  used_length: number;
  remnant: number;
  waste: number;
}

export async function cutOptimize(ctx: Ctx): Promise<Response> {
  if (!["owner", "foreman", "pm", "estimator"].includes(ctx.user.role)) {
    return err("Forbidden", 403, "forbidden");
  }
  let req: CutRequest;
  try { req = await ctx.req.json(); } catch { return err("Invalid JSON", 400, "bad_json"); }
  if (!req.profile || !req.stock_length || !Array.isArray(req.cuts)) {
    return err("profile, stock_length, and cuts required", 422, "validation");
  }

  const kerf = req.kerf ?? 0.125;
  const minRemnant = req.min_remnant ?? 6;
  const stock = req.stock_length;

  // Expand qty into individual cuts and sort descending
  const expanded: { length: number; mark?: string }[] = [];
  for (const c of req.cuts) {
    for (let i = 0; i < c.qty; i++) expanded.push({ length: c.length, mark: c.mark });
  }
  expanded.sort((a, b) => b.length - a.length);

  const bars: PackedBar[] = [];

  for (const cut of expanded) {
    if (cut.length > stock) {
      return err(`Cut length ${cut.length} exceeds stock length ${stock}`, 422, "bad_cut");
    }
    let placed = false;
    for (const bar of bars) {
      const next = bar.used_length + cut.length + (bar.cuts.length > 0 ? kerf : 0);
      if (next <= stock) {
        bar.cuts.push(cut);
        bar.used_length = next;
        bar.remnant = stock - bar.used_length;
        placed = true;
        break;
      }
    }
    if (!placed) {
      bars.push({
        bar_index: bars.length + 1,
        cuts: [cut],
        used_length: cut.length,
        remnant: stock - cut.length,
        waste: 0,
      });
    }
  }

  // Compute waste (remnant < minRemnant counts as waste)
  let totalWaste = 0;
  for (const bar of bars) {
    bar.waste = bar.remnant < minRemnant ? bar.remnant : 0;
    totalWaste += bar.waste;
  }
  const totalUsed = bars.reduce((s, b) => s + b.used_length, 0);
  const totalStock = bars.length * stock;
  const wastePct = totalStock === 0 ? 0 : ((totalStock - totalUsed) / totalStock) * 100;
  const yieldPct = 100 - wastePct;

  const plan = {
    profile: req.profile,
    stock_length: stock,
    kerf,
    min_remnant: minRemnant,
    total_bars: bars.length,
    total_used: totalUsed,
    total_stock: totalStock,
    waste_percentage: Number(wastePct.toFixed(2)),
    yield_percentage: Number(yieldPct.toFixed(2)),
    bars,
  };

  // Persist if project_id provided
  if (req.project_id) {
    await ctx.sb.from("cut_plans").insert({
      company_id: ctx.user.company_id,
      project_id: req.project_id,
      profile: req.profile,
      stock_length: stock,
      kerf,
      min_remnant: minRemnant,
      cuts: bars,
      waste_percentage: plan.waste_percentage,
      total_bars: bars.length,
      total_yield_pct: plan.yield_percentage,
      parameters_json: { input_cuts: req.cuts, kerf, min_remnant: minRemnant },
    });
    await writeAudit(ctx, { action: "rpc", table_name: "cut_plans", new_values: plan });
  }

  return ok(plan);
}
