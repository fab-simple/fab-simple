// Audit log + activity feed writers. Both use service role (RLS-bypass) so
// that records always land even if the user's session has limited rights.

import type { Ctx } from "../lib/types.ts";

export async function writeAudit(
  ctx: Ctx,
  args: {
    action: "insert" | "update" | "delete" | "login" | "import" | "rpc";
    table_name: string;
    record_id?: string | null;
    old_values?: unknown;
    new_values?: unknown;
  }
) {
  try {
    await ctx.sbAdmin.from("audit_log").insert({
      company_id: ctx.user.company_id,
      user_id: ctx.user.id,
      action: args.action,
      table_name: args.table_name,
      record_id: args.record_id ?? null,
      old_values: args.old_values ?? null,
      new_values: args.new_values ?? null,
      ip_address: ctx.ip,
      user_agent: ctx.ua,
    });
  } catch (e) {
    console.warn("audit log write failed", e);
  }
}

export async function writeActivity(
  ctx: Ctx,
  args: {
    action: string;
    entity_type: string;
    entity_id?: string | null;
    entity_label?: string | null;
    metadata?: Record<string, unknown>;
  }
) {
  try {
    await ctx.sbAdmin.from("activity_feed").insert({
      company_id: ctx.user.company_id,
      user_id: ctx.user.id,
      user_name: ctx.user.full_name,
      action: args.action,
      entity_type: args.entity_type,
      entity_id: args.entity_id ?? null,
      entity_label: args.entity_label ?? null,
      metadata: args.metadata ?? null,
    });
  } catch (e) {
    console.warn("activity feed write failed", e);
  }
}
