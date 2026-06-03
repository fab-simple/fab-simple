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

// Hard cap on a single list response. Customers with bigger windows must
// paginate (page / per_page). At ~200 KB per row × 200 rows we're under the
// Edge Function 6 MB response limit even on the heaviest tables.
const MAX_PER_PAGE = 200;
const DEFAULT_PER_PAGE = 25;

// Field name validator for sort/filter — only allow snake_case identifiers
// so callers can't smuggle SQL via order_by.
const FIELD_RE = /^[a-z_][a-z0-9_]*$/;

function parseInteger(raw: string | null, fallback: number): number {
  if (raw == null) return fallback;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

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

  // Pagination — supports BOTH legacy (?limit=&offset=) and the new
  // (?page=&per_page=) style. The legacy form is kept so existing pages and
  // hooks don't break the moment this ships.
  let perPage: number;
  let offset: number;
  let page: number;

  const perPageRaw = params.get("per_page") ?? params.get("limit");
  perPage = Math.min(
    Math.max(parseInteger(perPageRaw, DEFAULT_PER_PAGE), 1),
    MAX_PER_PAGE,
  );

  const pageParam = params.get("page");
  if (pageParam != null) {
    page = Math.max(parseInteger(pageParam, 1), 1);
    offset = (page - 1) * perPage;
  } else {
    offset = Math.max(parseInteger(params.get("offset"), 0), 0);
    page = Math.floor(offset / perPage) + 1;
  }

  const rawOrderBy = params.get("order_by") ?? "created_at";
  const orderBy = FIELD_RE.test(rawOrderBy) ? rawOrderBy : "created_at";
  const ascending = params.get("dir") === "asc";

  // Always include a deterministic tiebreaker (id). Without it, rows with
  // identical primary sort keys (e.g. 96 parts seeded in one transaction
  // share the exact same created_at) shuffle between requests and pages
  // start overlapping — the classic "scroll-and-see-the-same-row-again"
  // pagination bug. Skip the tiebreaker when the caller is already
  // sorting by id.
  let q = ctx.sb
    .from(table)
    .select("*", { count: "exact" })
    .range(offset, offset + perPage - 1)
    .order(orderBy, { ascending });
  if (orderBy !== "id") {
    q = q.order("id", { ascending: true });
  }

  // Apply field=value filters. The format is either:
  //   `column=value`              → eq
  //   `column__op=value`          → op ∈ in, neq, gt, gte, lt, lte, ilike, like, is_null, not_null
  const reserved = new Set([
    "limit", "offset", "per_page", "page", "order_by", "dir", "q",
  ]);
  const SUFFIXES = [
    "__in", "__neq", "__gt", "__gte", "__lt", "__lte",
    "__ilike", "__like", "__is_null", "__not_null",
  ] as const;

  for (const [k, v] of params.entries()) {
    if (reserved.has(k)) continue;

    let column = k;
    let op: typeof SUFFIXES[number] | "__eq" = "__eq";
    for (const suf of SUFFIXES) {
      if (k.endsWith(suf)) {
        column = k.slice(0, -suf.length);
        op = suf;
        break;
      }
    }
    if (!FIELD_RE.test(column)) continue; // ignore garbage param names

    switch (op) {
      case "__in":      q = q.in(column, v.split(",").map((s) => s.trim()).filter(Boolean)); break;
      case "__neq":     q = q.neq(column, v); break;
      case "__gt":      q = q.gt(column, v); break;
      case "__gte":     q = q.gte(column, v); break;
      case "__lt":      q = q.lt(column, v); break;
      case "__lte":     q = q.lte(column, v); break;
      case "__ilike":   q = q.ilike(column, v.includes("%") ? v : `%${v}%`); break;
      case "__like":    q = q.like(column, v.includes("%") ? v : `%${v}%`); break;
      case "__is_null": q = q.is(column, null); break;
      case "__not_null": q = q.not(column, "is", null); break;
      case "__eq":
      default:          q = q.eq(column, v); break;
    }
  }

  const { data, error, count } = await q;
  if (error) return err(error.message, 400, "db_error");

  const total = count ?? 0;
  const has_more = offset + (data?.length ?? 0) < total;

  // Dual-shape response: top-level `data` stays a bare array for legacy
  // callers (`FabAPI.list` unwraps `data` directly into `T[]`). The new
  // `pagination` envelope sits alongside for new callers (`listPaged`)
  // that need total / page / per_page / has_more.
  return ok(data ?? [], {
    pagination: { total, page, per_page: perPage, has_more, offset },
    // Legacy keys (so old code that read `count` / `limit` / `offset` at
    // the top level still works).
    count: total,
    limit: perPage,
    offset,
  });
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
