// Admin-only operations: seed AISC, invite user, archive/restore project,
// convert estimate → project, QC report export, mark all notifications read.

import type { Ctx } from "../lib/types.ts";
import { ok, err } from "../lib/response.ts";
import { writeAudit, writeActivity } from "../services/audit.ts";

const AISC_303_SEED: { category: string; section_ref: string; item_text: string }[] = [
  { category: "Materials", section_ref: "§6.1", item_text: "Mill test reports received and verified" },
  { category: "Materials", section_ref: "§6.1", item_text: "Material grade matches contract specification" },
  { category: "Materials", section_ref: "§6.2", item_text: "Heat numbers traceable to all members" },
  { category: "Materials", section_ref: "§6.3", item_text: "Bolts conform to A325/A490 with proper markings" },
  { category: "Fabrication", section_ref: "§5.1", item_text: "Cutting tolerances verified per §5.1" },
  { category: "Fabrication", section_ref: "§5.2", item_text: "Drilling and reaming tolerances per §5.2" },
  { category: "Fabrication", section_ref: "§5.3", item_text: "Bend radii and cold-bend ratios per §5.3" },
  { category: "Welding", section_ref: "§6.4", item_text: "WPS approved and on file" },
  { category: "Welding", section_ref: "§6.4", item_text: "Welder qualification records current" },
  { category: "Welding", section_ref: "§6.5", item_text: "Weld VT/UT/MT/PT per applicable AWS D1.1" },
  { category: "Welding", section_ref: "§6.5", item_text: "CWI inspector certification valid" },
  { category: "Connections", section_ref: "§7.1", item_text: "Bolt installation method verified (turn-of-nut/torque)" },
  { category: "Connections", section_ref: "§7.2", item_text: "Faying surfaces prepared per slip-critical class" },
  { category: "Connections", section_ref: "§7.3", item_text: "Pretensioned bolts verified with Skidmore" },
  { category: "Erection", section_ref: "§8.1", item_text: "Erection drawings reviewed and field-marked" },
  { category: "Erection", section_ref: "§8.2", item_text: "Plumb, level and alignment within tolerance" },
  { category: "Erection", section_ref: "§8.3", item_text: "Anchor rod survey verified pre-erection" },
  { category: "Erection", section_ref: "§8.4", item_text: "Temporary bracing per erector engineer" },
  { category: "Coatings", section_ref: "§9.1", item_text: "Surface prep per SSPC class verified" },
  { category: "Coatings", section_ref: "§9.2", item_text: "Primer DFT meets project specification" },
  { category: "Coatings", section_ref: "§9.3", item_text: "Topcoat DFT and total DFT within tolerance" },
  { category: "Coatings", section_ref: "§9.4", item_text: "Galvanized coating thickness per ASTM A123" },
  { category: "Documentation", section_ref: "§10.1", item_text: "Inspection reports submitted weekly" },
  { category: "Documentation", section_ref: "§10.2", item_text: "Non-conformance reports closed before shipment" },
];

export async function seedAisc(ctx: Ctx): Promise<Response> {
  if (!["owner", "pm", "qc"].includes(ctx.user.role)) return err("Forbidden", 403, "forbidden");
  const { project_id } = await ctx.req.json().catch(() => ({}));
  if (!project_id) return err("project_id required", 422, "validation");

  const rows = AISC_303_SEED.map((s, i) => ({
    company_id: ctx.user.company_id,
    project_id,
    section_ref: s.section_ref,
    item_text: s.item_text,
    category: s.category,
    status: "open" as const,
    sort_order: i + 1,
  }));
  const { error } = await ctx.sb.from("aisc_checklist").insert(rows);
  if (error) return err(error.message, 400, "db_error");

  await writeAudit(ctx, { action: "rpc", table_name: "aisc_checklist", new_values: { seeded: rows.length, project_id } });
  return ok({ seeded: rows.length });
}

export async function inviteUser(ctx: Ctx): Promise<Response> {
  if (ctx.user.role !== "owner") return err("Only owners can invite users", 403, "forbidden");
  const body = await ctx.req.json().catch(() => ({}));
  const { email, role, full_name } = body;
  if (!email || !role) return err("email and role required", 422, "validation");

  // Check subscription user limit
  const [{ count: userCount }, { data: sub }] = await Promise.all([
    ctx.sb.from("users").select("id", { count: "exact", head: true }),
    ctx.sb.from("subscriptions").select("max_users").single(),
  ]);
  const limit = (sub?.max_users as number) ?? 10;
  if ((userCount ?? 0) >= limit) {
    return err(`User limit reached (${limit}). Upgrade your subscription.`, 402, "user_limit");
  }

  // Create token for accept-invite flow
  const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
  const { error: invErr } = await ctx.sb.from("user_invitations").insert({
    company_id: ctx.user.company_id,
    email,
    role,
    invited_by: ctx.user.id,
    token,
  });
  if (invErr) return err(invErr.message, 400, "db_error");

  // Trigger Supabase Auth invite (sends email)
  const inviteUrl = `${Deno.env.get("APP_URL") ?? ""}/auth/accept-invite?token=${token}`;
  let emailSent = true;
  try {
    await ctx.sbAdmin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: full_name ?? null, company_id: ctx.user.company_id, role, invite_token: token },
      redirectTo: inviteUrl,
    });
  } catch (e) {
    emailSent = false;
    console.warn("auth invite send failed (continuing)", e);
  }

  await writeAudit(ctx, { action: "rpc", table_name: "user_invitations", new_values: { email, role, email_sent: emailSent } });
  await writeActivity(ctx, {
    action: `invited ${email} as ${role}`,
    entity_type: "users",
    entity_label: email,
  });

  // SECURITY: never echo the raw token in the API response. It only needs to
  // travel out via the email we just sent. Echoing it puts the token into
  // browser network logs / devtools and gives any compromised admin session
  // a 7-day replayable credential for the invitee.
  return ok({
    invited: true,
    email,
    role,
    email_sent: emailSent,
  });
}

export async function archiveProject(ctx: Ctx, id: string): Promise<Response> {
  if (!["owner", "pm"].includes(ctx.user.role)) return err("Forbidden", 403, "forbidden");
  const { data: p, error } = await ctx.sb.from("projects")
    .update({ is_archived: true, status: "archived" })
    .eq("id", id).select().single();
  if (error) return err(error.message, 400, "db_error");
  await writeAudit(ctx, { action: "update", table_name: "projects", record_id: id, new_values: p });
  await writeActivity(ctx, { action: "archived project", entity_type: "projects", entity_id: id, entity_label: p.name as string });
  return ok(p);
}

export async function convertEstimate(ctx: Ctx): Promise<Response> {
  if (!["owner", "estimator", "pm"].includes(ctx.user.role)) return err("Forbidden", 403, "forbidden");
  const { estimate_id, pm_id, deadline } = await ctx.req.json().catch(() => ({}));
  if (!estimate_id) return err("estimate_id required", 422, "validation");

  const { data: est, error: eErr } = await ctx.sb.from("estimates").select("*").eq("id", estimate_id).maybeSingle();
  if (eErr || !est) return err("Estimate not found", 404, "not_found");

  // Calculate pricing breakdown totals from the estimate
  const materials = Array.isArray(est.materials_breakdown) ? est.materials_breakdown : [];
  let materialTotal = 0;
  let totalTons = 0;
  for (const m of materials) {
    const tons = Number(m.tons || 0);
    const ppt = Number(m.price_per_ton || 0);
    materialTotal += tons * ppt;
    totalTons += tons;
  }

  const laborHours = Number(est.detailing_hours || 0) + Number(est.fabrication_hours || 0) + Number(est.erection_hours || 0);
  const laborTotal = laborHours * Number(est.labor_rate || 75.00);

  const freightTotal = Number(est.freight_mill_to_shop || 0) + Number(est.freight_shop_to_site || 0);

  let coatingTotal = 0;
  if (est.paint_coating_required) {
    if (est.coating_pricing_method === "per_ton") {
      coatingTotal = totalTons * Number(est.coating_price_per_ton || 0);
    } else {
      coatingTotal = Number(est.coating_lump_sum || 0);
    }
  }

  const subtotal = materialTotal + laborTotal + freightTotal + coatingTotal;
  const marginTotal = subtotal * (Number(est.margin_pct || 15) / 100);
  const contingencyTotal = subtotal * (Number(est.contingency_pct || 0) / 100);
  const totalBidPrice = subtotal + marginTotal + contingencyTotal;

  const finalContractValue = est.total_amount && Number(est.total_amount) > 0 
    ? Number(est.total_amount) 
    : totalBidPrice;

  const baselineBudget = {
    material: materialTotal,
    labor: laborTotal,
    freight: freightTotal,
    coating: coatingTotal,
    subtotal: subtotal,
    margin: marginTotal,
    contingency: contingencyTotal,
    total: finalContractValue
  };

  const { data: project, error: pErr } = await ctx.sb.from("projects").insert({
    company_id: ctx.user.company_id,
    name: est.project_name,
    number: null, // blank Job Number on creation
    gc_name: est.gc_name,
    architect_eor: est.architect_eor,
    project_location: est.project_location,
    contract_value: finalContractValue,
    est_tonnage: totalTons || est.structural_tons,
    unique_piece_marks: est.unique_piece_marks,
    baseline_budget: baselineBudget,
    drawing_set_ref: est.drawing_set_ref,
    exclusions_qualifications: est.exclusions_qualifications,
    estimate_id: est.id,
    pm_id: pm_id ?? null,
    deadline: deadline ?? est.bid_due_date ?? null,
    status: "awarded_setup", // Pending Job Number
    created_by: ctx.user.id,
  }).select().single();
  if (pErr) return err(pErr.message, 400, "db_error");

  // Mark estimate as won and link
  await ctx.sb.from("estimates").update({
    status: "won",
    won_at: new Date().toISOString(),
    converted_project_id: project.id,
  }).eq("id", estimate_id);

  // Seed baseline budgets into job_costs tracker
  const baselineCosts = [
    { company_id: ctx.user.company_id, project_id: project.id, cost_code: "material", description: "Material Baseline Budget", budget_amount: materialTotal },
    { company_id: ctx.user.company_id, project_id: project.id, cost_code: "labor", description: "Labor Baseline Budget", budget_amount: laborTotal },
    { company_id: ctx.user.company_id, project_id: project.id, cost_code: "freight", description: "Freight Baseline Budget", budget_amount: freightTotal },
    { company_id: ctx.user.company_id, project_id: project.id, cost_code: "coating", description: "Paint/Coating Baseline Budget", budget_amount: coatingTotal },
  ];
  await ctx.sb.from("job_costs").insert(baselineCosts);

  // Seed billing_line_items for AIA G703 Billing
  const billingRows = [];
  let sortOrder = 0;
  for (const m of materials) {
    const tons = Number(m.tons || 0);
    const ppt = Number(m.price_per_ton || 0);
    if (tons > 0) {
      billingRows.push({
        company_id: ctx.user.company_id,
        project_id: project.id,
        description: `Material - ${m.shape}`,
        quantity: tons,
        unit: "ton",
        unit_cost: ppt,
        total_cost: tons * ppt,
        sort_order: sortOrder++,
        source: "estimate_conversion",
      });
    }
  }

  if (laborHours > 0) {
    billingRows.push({
      company_id: ctx.user.company_id,
      project_id: project.id,
      description: `Labor - Detailing/Fabrication/Erection`,
      quantity: laborHours,
      unit: "hr",
      unit_cost: Number(est.labor_rate || 75.00),
      total_cost: laborTotal,
      sort_order: sortOrder++,
      source: "estimate_conversion",
    });
  }

  if (freightTotal > 0) {
    billingRows.push({
      company_id: ctx.user.company_id,
      project_id: project.id,
      description: `Freight`,
      quantity: 1,
      unit: "ls",
      unit_cost: freightTotal,
      total_cost: freightTotal,
      sort_order: sortOrder++,
      source: "estimate_conversion",
    });
  }

  if (coatingTotal > 0) {
    billingRows.push({
      company_id: ctx.user.company_id,
      project_id: project.id,
      description: `Paint/Coating (${est.coating_type || "Shop Primer"})`,
      quantity: 1,
      unit: "ls",
      unit_cost: coatingTotal,
      total_cost: coatingTotal,
      sort_order: sortOrder++,
      source: "estimate_conversion",
    });
  }

  let linesCarried = 0;
  if (billingRows.length > 0) {
    const { error: liErr } = await ctx.sbAdmin.from("billing_line_items").insert(billingRows);
    if (!liErr) {
      linesCarried = billingRows.length;
    } else {
      console.warn("convertEstimate: could not insert billing_line_items", liErr.message);
    }
  }

  await writeAudit(ctx, {
    action: "rpc",
    table_name: "projects",
    record_id: project.id as string,
    new_values: { ...project, lines_carried: linesCarried },
  });
  await writeActivity(ctx, {
    action: `converted estimate to project (${linesCarried} line items carried)`,
    entity_type: "projects",
    entity_id: project.id as string,
    entity_label: project.name as string,
  });

  return ok({ ...project, lines_carried: linesCarried });
}

export async function qcReport(ctx: Ctx): Promise<Response> {
  if (!["owner", "qc", "pm"].includes(ctx.user.role)) return err("Forbidden", 403, "forbidden");
  const projectId = ctx.url.searchParams.get("project_id");
  let welds = ctx.sb.from("weld_inspections").select("*");
  let paints = ctx.sb.from("paint_inspections").select("*");
  let ncrs = ctx.sb.from("ncr_reports").select("*");
  let aisc = ctx.sb.from("aisc_checklist").select("*");
  if (projectId) {
    welds = welds.eq("project_id", projectId);
    paints = paints.eq("project_id", projectId);
    ncrs = ncrs.eq("project_id", projectId);
    aisc = aisc.eq("project_id", projectId);
  }
  const [w, p, n, a] = await Promise.all([welds, paints, ncrs, aisc]);
  return ok({
    welds: w.data ?? [],
    paint: p.data ?? [],
    ncrs: n.data ?? [],
    aisc: a.data ?? [],
    generated_at: new Date().toISOString(),
    project_id: projectId,
  });
}

export async function markAllNotificationsRead(ctx: Ctx): Promise<Response> {
  const { error } = await ctx.sb.from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("user_id", ctx.user.id)
    .eq("is_read", false);
  if (error) return err(error.message, 400, "db_error");
  return ok({ marked: true });
}
