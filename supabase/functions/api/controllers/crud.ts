// Generic CRUD: GET /{table}, GET /{table}/{id}, POST /{table},
// PATCH /{table}/{id}, DELETE /{table}/{id}.
//
// Every request is RLS-enforced via ctx.sb (user-scoped client).
// Inserts auto-fill company_id, created_by where the column exists, and
// generate sequential business IDs via next_sequence_number() when configured.

import type { Ctx } from "../lib/types.ts";
import { ok, err } from "../lib/response.ts";
import { tableConfig, canRead, canInsert, canUpdate, canDelete } from "../lib/permissions.ts";
import { getInsertSchema, getUpdateSchema } from "../schemas/validation.ts";
import { sanitize } from "../lib/sanitize.ts";
import { writeAudit, writeActivity } from "../services/audit.ts";

const MAX_LIMIT = 1000;

export async function listOrGet(ctx: Ctx, table: string, id?: string): Promise<Response> {
  const cfg = tableConfig(table);
  if (!cfg) return err(`Unknown table '${table}'`, 404, "unknown_table");
  if (!canRead(ctx.user.role, table)) return err("Forbidden", 403, "forbidden");

  if (id) {
    const { data, error } = await ctx.sb.from(table).select("*").eq("id", id).maybeSingle();
    if (error) return err(error.message, 400, "db_error");
    if (!data) return err("Not found", 404, "not_found");
    return ok(data);
  }

  const params = ctx.url.searchParams;
  const limit = Math.min(parseInt(params.get("limit") ?? "100", 10) || 100, MAX_LIMIT);
  const offset = parseInt(params.get("offset") ?? "0", 10) || 0;
  const orderBy = params.get("order_by") ?? "created_at";
  const direction = params.get("dir") === "asc" ? true : false;

  let q = ctx.sb.from(table).select("*", { count: "exact" }).range(offset, offset + limit - 1).order(orderBy, { ascending: direction });

  // Apply field=value filters from query params (skipping reserved keys)
  const reserved = new Set(["limit", "offset", "order_by", "dir", "q"]);
  for (const [k, v] of params.entries()) {
    if (reserved.has(k)) continue;
    if (k.endsWith("__in")) {
      q = q.in(k.replace(/__in$/, ""), v.split(","));
    } else if (k.endsWith("__gte")) {
      q = q.gte(k.replace(/__gte$/, ""), v);
    } else if (k.endsWith("__lte")) {
      q = q.lte(k.replace(/__lte$/, ""), v);
    } else if (k.endsWith("__ilike")) {
      q = q.ilike(k.replace(/__ilike$/, ""), `%${v}%`);
    } else {
      q = q.eq(k, v);
    }
  }

  const { data, error, count } = await q;
  if (error) return err(error.message, 400, "db_error");
  return ok(data ?? [], { count: count ?? 0, limit, offset });
}

export async function create(ctx: Ctx, table: string): Promise<Response> {
  const cfg = tableConfig(table);
  if (!cfg) return err(`Unknown table '${table}'`, 404, "unknown_table");
  if (!canInsert(ctx.user.role, table)) return err("Forbidden", 403, "forbidden");

  const schema = getInsertSchema(table);
  if (!schema) return err(`No insert schema for '${table}'`, 400, "no_schema");

  let raw: unknown;
  try { raw = await ctx.req.json(); } catch { return err("Invalid JSON body", 400, "bad_json"); }
  const sanitized = sanitize(raw);
  const parsed = schema.safeParse(sanitized);
  if (!parsed.success) {
    return err("Validation failed", 422, "validation");
  }

  const row: Record<string, unknown> = { ...(parsed.data as Record<string, unknown>) };
  if (cfg.hasCompanyId) row.company_id = ctx.user.company_id;

  // Auto-generate business ID via atomic sequence if configured + caller didn't supply one.
  if (cfg.sequence && !row[cfg.sequence.field]) {
    const resolvedPrefix = cfg.sequence.prefix.replace("YYYY", String(new Date().getFullYear()));
    const { data: seq, error: seqErr } = await ctx.sbAdmin.rpc("next_sequence_number", {
      p_company_id: ctx.user.company_id,
      p_table_name: table,
      p_prefix: resolvedPrefix,
      p_width: cfg.sequence.width ?? 4,
    });
    if (seqErr) return err(`Sequence error: ${seqErr.message}`, 500, "sequence");
    row[cfg.sequence.field] = seq;
  }

  // Insert via user-scoped client (so RLS validates)
  const { data, error } = await ctx.sb.from(table).insert(row).select().single();
  if (error) return err(error.message, 400, "db_error");

  await writeAudit(ctx, { action: "insert", table_name: table, record_id: data.id, new_values: data });
  if (cfg.activity) {
    const label = cfg.activity.label_field ? (data as Record<string, unknown>)[cfg.activity.label_field] as string : null;
    await writeActivity(ctx, {
      action: `created ${table.replace(/_/g, " ")}`,
      entity_type: cfg.activity.entity_type,
      entity_id: data.id as string,
      entity_label: label ?? null,
    });
  }

  return ok(data);
}

export async function update(ctx: Ctx, table: string, id: string): Promise<Response> {
  const cfg = tableConfig(table);
  if (!cfg) return err(`Unknown table '${table}'`, 404, "unknown_table");
  if (!canUpdate(ctx.user.role, table)) return err("Forbidden", 403, "forbidden");

  const schema = getUpdateSchema(table);
  if (!schema) return err(`No update schema for '${table}'`, 400, "no_schema");

  let raw: unknown;
  try { raw = await ctx.req.json(); } catch { return err("Invalid JSON body", 400, "bad_json"); }
  const parsed = schema.safeParse(sanitize(raw));
  if (!parsed.success) return err("Validation failed", 422, "validation");

  const { data: oldRow } = await ctx.sb.from(table).select("*").eq("id", id).maybeSingle();
  if (!oldRow) return err("Not found", 404, "not_found");

  const { data, error } = await ctx.sb.from(table).update(parsed.data as Record<string, unknown>).eq("id", id).select().single();
  if (error) return err(error.message, 400, "db_error");

  await writeAudit(ctx, { action: "update", table_name: table, record_id: id, old_values: oldRow, new_values: data });
  if (cfg.activity) {
    const label = cfg.activity.label_field ? (data as Record<string, unknown>)[cfg.activity.label_field] as string : null;
    await writeActivity(ctx, {
      action: `updated ${table.replace(/_/g, " ")}`,
      entity_type: cfg.activity.entity_type,
      entity_id: id,
      entity_label: label ?? null,
    });
  }
  return ok(data);
}

export async function remove(ctx: Ctx, table: string, id: string): Promise<Response> {
  const cfg = tableConfig(table);
  if (!cfg) return err(`Unknown table '${table}'`, 404, "unknown_table");
  if (!canDelete(ctx.user.role, table)) return err("Forbidden", 403, "forbidden");

  const { data: oldRow } = await ctx.sb.from(table).select("*").eq("id", id).maybeSingle();
  if (!oldRow) return err("Not found", 404, "not_found");

  const { error } = await ctx.sb.from(table).delete().eq("id", id);
  if (error) return err(error.message, 400, "db_error");

  await writeAudit(ctx, { action: "delete", table_name: table, record_id: id, old_values: oldRow });
  if (cfg.activity) {
    await writeActivity(ctx, {
      action: `deleted ${table.replace(/_/g, " ")}`,
      entity_type: cfg.activity.entity_type,
      entity_id: id,
    });
  }
  return ok({ deleted: true, id });
}
