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

  // Generate PRJ-YYYY-NNNN
  const { data: projNum } = await ctx.sbAdmin.rpc("next_sequence_number", {
    p_company_id: ctx.user.company_id,
    p_table_name: "projects",
    p_prefix: `PRJ-${new Date().getFullYear()}`,
    p_width: 4,
  });

  const { data: project, error: pErr } = await ctx.sb.from("projects").insert({
    company_id: ctx.user.company_id,
    name: est.project_name,
    number: projNum,
    gc_name: est.gc_name,
    contract_value: est.total_amount,
    est_tonnage: est.structural_tons,
    pm_id: pm_id ?? null,
    deadline: deadline ?? null,
    status: "active",
    created_by: ctx.user.id,
  }).select().single();
  if (pErr) return err(pErr.message, 400, "db_error");

  // Mark estimate as won and link
  await ctx.sb.from("estimates").update({
    status: "won",
    won_at: new Date().toISOString(),
    converted_project_id: project.id,
  }).eq("id", estimate_id);

  // Carry estimate line items over to the new project's billing schedule of
  // values so AIA G703 + job-cost rollups have something to point at on day 1.
  let linesCarried = 0;
  const { data: estLines } = await ctx.sb.from("estimate_line_items")
    .select("description, quantity, unit, unit_cost, total_cost, sort_order")
    .eq("estimate_id", estimate_id);

  if (estLines && estLines.length > 0) {
    const billingRows = estLines.map((line, idx) => ({
      company_id: ctx.user.company_id,
      project_id: project.id,
      description: line.description ?? `Line ${idx + 1}`,
      quantity: line.quantity ?? 1,
      unit: line.unit ?? "ls",
      unit_cost: line.unit_cost ?? 0,
      total_cost: line.total_cost ?? 0,
      sort_order: line.sort_order ?? idx,
      source: "estimate_conversion",
    }));
    // billing_line_items may not exist on every deployment yet — degrade
    // gracefully if the table is absent so the project conversion itself
    // still succeeds.
    const { error: liErr } = await ctx.sbAdmin
      .from("billing_line_items")
      .insert(billingRows);
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
