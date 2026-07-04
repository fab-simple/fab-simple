// Erection Operations Controller
// Handles safety gate overrides, field RCSC bolt-up inspections,
// weather/delay logs, crew tracking, and punch list management.

import { adminClient } from "../lib/supabase.ts";
import { ok, err } from "../lib/response.ts";

export async function overrideSafetyGate(req: Request): Promise<Response> {
  const sbAdmin = adminClient();
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch (_e) {
    return err("Invalid JSON body", 400);
  }

  const { step_id, company_id, action, override_by, justification } = body;
  if (!step_id || !company_id || !action || !justification) {
    return err("step_id, company_id, action, and justification are required for safety gate overrides", 400);
  }

  // 1. Insert audit log
  const { data: auditLog, error: auditErr } = await sbAdmin
    .from("erection_audit_logs")
    .insert([{
      company_id,
      step_id,
      action: String(action),
      override_by: override_by || null,
      justification: String(justification),
      created_at: new Date().toISOString(),
    }])
    .select()
    .single();

  if (auditErr) return err(auditErr.message, 500);

  // 2. Update step state
  const updatePayload: Record<string, unknown> = {};
  if (action === "concrete_cure_override") updatePayload.concrete_cure_certified = true;
  if (action === "site_readiness_override") updatePayload.site_readiness_cleared = true;
  if (action === "critical_lift_override") updatePayload.critical_lift = false;

  if (Object.keys(updatePayload).length > 0) {
    await sbAdmin.from("erection_sequence").update(updatePayload).eq("id", step_id);
  }

  return ok({ audit_log: auditLog, step_updated: updatePayload });
}

export async function recordFieldBoltInspection(req: Request): Promise<Response> {
  const sbAdmin = adminClient();
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch (_e) {
    return err("Invalid JSON body", 400);
  }

  const { company_id, part_id, part_mark, inspection_method, result, inspector_id, notes } = body;
  if (!company_id || !part_mark) {
    return err("company_id and part_mark are required", 400);
  }

  const { data, error } = await sbAdmin
    .from("field_bolt_inspections")
    .insert([{
      company_id,
      part_id: part_id || null,
      part_mark: String(part_mark),
      inspection_method: String(inspection_method || "turn_of_nut"),
      result: String(result || "pass"),
      inspector_id: inspector_id || null,
      notes: notes || null,
      inspected_at: new Date().toISOString(),
    }])
    .select()
    .single();

  if (error) return err(error.message, 500);
  return ok(data);
}

export async function logErectionDelay(req: Request): Promise<Response> {
  const sbAdmin = adminClient();
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch (_e) {
    return err("Invalid JSON body", 400);
  }

  const { company_id, project_id, type, start_time, end_time, zone_affected, notes, created_by } = body;
  if (!company_id || !project_id || !type) {
    return err("company_id, project_id, and type are required", 400);
  }

  const sTime = start_time ? new Date(String(start_time)) : new Date();
  const eTime = end_time ? new Date(String(end_time)) : new Date();
  const durationMins = Math.max(0, Math.round((eTime.getTime() - sTime.getTime()) / 60000));

  const { data, error } = await sbAdmin
    .from("erection_delays")
    .insert([{
      company_id,
      project_id,
      type: String(type),
      start_time: sTime.toISOString(),
      end_time: eTime.toISOString(),
      duration_minutes: durationMins,
      zone_affected: zone_affected || null,
      notes: notes || null,
      created_by: created_by || null,
      created_at: new Date().toISOString(),
    }])
    .select()
    .single();

  if (error) return err(error.message, 500);

  // Auto-flag project schedule status if delay is > 120 mins
  if (durationMins > 120) {
    await sbAdmin.from("projects").update({ schedule_status: "at_risk" }).eq("id", project_id);
  }

  return ok(data);
}
