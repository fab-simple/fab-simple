// Bulk operations.
//
// Currently exposes:
//   POST /parts/bulk-update  body: { ids: string[]; patch: { status?, phase?, notes?, assigned_user_id? } }
//   POST /<table>/bulk-update  generic shape (gated by permissions matrix
//     update list), useful for any table where you want to flip status/notes
//     across many rows without making N HTTP round trips.
//
// Semantics:
//   - Per-row outcome (allSettled-style) — one row failing RLS or validation
//     doesn't roll back the others.
//   - Auth/RBAC: caller must pass `canUpdate(role, table)`.
//   - Audit log: writes one audit_log row per successful mutation so the
//     forensic trail is identical to single-row PATCHes.
//   - Activity feed: one summary line ("bulk-updated 27 parts → complete")
//     instead of polluting the feed with hundreds of identical events.
//   - Hard cap: 500 ids per request.

import type { Ctx } from "../lib/types.ts";
import { ok, err } from "../lib/response.ts";
import { tableConfig, canUpdate } from "../lib/permissions.ts";
import { sanitize } from "../lib/sanitize.ts";
import { writeAudit, writeActivity } from "../services/audit.ts";

const MAX_BULK = 500;

interface BulkBody {
  ids?: unknown;
  patch?: unknown;
}

interface Outcome {
  id: string;
  ok: boolean;
  error?: { message: string; code: string };
}

export async function bulkUpdate(ctx: Ctx, table: string): Promise<Response> {
  const cfg = tableConfig(table);
  if (!cfg) return err(`Unknown table '${table}'`, 404, "unknown_table");
  if (!canUpdate(ctx.user.role, table)) return err("Forbidden", 403, "forbidden");

  let raw: BulkBody;
  try {
    raw = await ctx.req.json() as BulkBody;
  } catch {
    return err("Invalid JSON body", 400, "bad_json");
  }

  const ids = Array.isArray(raw.ids) ? (raw.ids as unknown[]).map(String).filter(Boolean) : [];
  if (ids.length === 0) return err("ids[] required", 422, "validation");
  if (ids.length > MAX_BULK) {
    return err(`Too many ids — max ${MAX_BULK} per request`, 422, "too_many");
  }

  if (raw.patch == null || typeof raw.patch !== "object" || Array.isArray(raw.patch)) {
    return err("patch object required", 422, "validation");
  }

  // Sanitize the patch to strip <script>/javascript: / HTML before it goes
  // anywhere near the DB. The exact column whitelist is enforced by RLS +
  // the BEFORE-UPDATE column-lock triggers we shipped in the CEO review
  // migration, so a worker who somehow includes `role` here gets a 42501.
  const patch = sanitize(raw.patch as Record<string, unknown>);
  // Strip identity / immutable columns that no caller has any business
  // setting via bulk.
  for (const reserved of ["id", "company_id", "created_at", "updated_at", "created_by", "auth_id"]) {
    delete patch[reserved];
  }
  if (Object.keys(patch).length === 0) {
    return err("patch is empty after stripping reserved columns", 422, "validation");
  }

  // Issue updates in parallel with a small concurrency cap so we don't
  // hammer the DB or trip rate limits.
  const CONCURRENCY = 8;
  const outcomes: Outcome[] = [];

  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const slice = ids.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(
      slice.map((id) => updateOne(ctx, table, id, patch)),
    );
    settled.forEach((r, idx) => {
      const id = slice[idx];
      if (r.status === "fulfilled") {
        outcomes.push(r.value);
      } else {
        outcomes.push({
          id,
          ok: false,
          error: { message: String(r.reason), code: "exception" },
        });
      }
    });
  }

  const succeeded = outcomes.filter((o) => o.ok);
  const failed = outcomes.filter((o) => !o.ok);

  // Activity feed: single summary line per bulk action — much easier to
  // read than 500 identical events.
  if (succeeded.length > 0 && cfg.activity) {
    const summaryFields = Object.keys(patch).join(", ");
    await writeActivity(ctx, {
      action: `bulk-updated ${succeeded.length} ${table.replace(/_/g, " ")} (${summaryFields})`,
      entity_type: cfg.activity.entity_type,
      entity_id: null,
      entity_label: null,
    });
  }

  return ok({
    total: ids.length,
    succeeded: succeeded.length,
    failed: failed.length,
    succeeded_ids: succeeded.map((o) => o.id),
    failures: failed,
    patch_applied: patch,
  });
}

async function updateOne(
  ctx: Ctx,
  table: string,
  id: string,
  patch: Record<string, unknown>,
): Promise<Outcome> {
  const { data: oldRow, error: readErr } = await ctx.sb
    .from(table)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (readErr) {
    return { id, ok: false, error: { message: readErr.message, code: "read_error" } };
  }
  if (!oldRow) {
    return { id, ok: false, error: { message: "Not found or access denied", code: "not_found" } };
  }

  const { data, error } = await ctx.sb
    .from(table)
    .update(patch)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    return { id, ok: false, error: { message: error.message, code: error.code ?? "db_error" } };
  }
  if (!data) {
    // RLS returned 0 rows — happens when the caller can SELECT but not
    // UPDATE this particular row, or a column-lock trigger silently
    // dropped the row (it shouldn't — triggers raise).
    return { id, ok: false, error: { message: "Update returned no row (RLS or column lock)", code: "rls_blocked" } };
  }

  await writeAudit(ctx, {
    action: "update",
    table_name: table,
    record_id: id,
    old_values: oldRow,
    new_values: data,
  });
  return { id, ok: true };
}
