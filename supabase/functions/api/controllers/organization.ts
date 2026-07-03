// Organization profile endpoints: every signed-in user can fetch their
// own company row (needed for AIA G702 contractor name, headers, branding);
// only Owners can update it.

import type { Ctx } from "../lib/types.ts";
import { ok, err } from "../lib/response.ts";
import { writeAudit } from "../services/audit.ts";

const ORG_SELECT =
  "id, name, legal_name, address_line1, address_line2, city, state, zip, " +
  "phone, email, website, license_number, tax_id, logo_url, plan, " +
  "aisc_cert, max_parts, max_projects, max_users, active, default_exclusions_qualifications";

// Fields a non-owner could in principle update if we ever expose them.
// Owner-only for now; this whitelist guards against payload-injection of
// `plan`, `max_*`, `id`, etc.
const ORG_UPDATABLE = new Set<string>([
  "name", "legal_name",
  "address_line1", "address_line2", "city", "state", "zip",
  "phone", "email", "website",
  "license_number", "tax_id",
  "logo_url",
  "aisc_cert",
  "default_exclusions_qualifications",
]);

export async function getOrganization(ctx: Ctx): Promise<Response> {
  const { data, error } = await ctx.sb
    .from("companies")
    .select(ORG_SELECT)
    .eq("id", ctx.user.company_id)
    .maybeSingle();
  if (error) return err(error.message, 400, "db_error");
  if (!data) return err("Organization not found", 404, "not_found");
  return ok(data);
}

export async function updateOrganization(ctx: Ctx): Promise<Response> {
  if (ctx.user.role !== "owner") {
    return err("Only owners can update the organization profile", 403, "forbidden");
  }
  const body = (await ctx.req.json().catch(() => ({}))) as Record<string, unknown>;

  // Whitelist payload to known-safe columns; reject if nothing valid was sent.
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (ORG_UPDATABLE.has(k)) patch[k] = v;
  }
  if (Object.keys(patch).length === 0) {
    return err("No updatable fields provided", 422, "validation");
  }
  patch.updated_at = new Date().toISOString();

  const { data: oldRow } = await ctx.sb
    .from("companies")
    .select(ORG_SELECT)
    .eq("id", ctx.user.company_id)
    .maybeSingle();

  const { data, error } = await ctx.sb
    .from("companies")
    .update(patch)
    .eq("id", ctx.user.company_id)
    .select(ORG_SELECT)
    .single();
  if (error) return err(error.message, 400, "db_error");

  await writeAudit(ctx, {
    action: "update",
    table_name: "companies",
    record_id: ctx.user.company_id,
    old_values: oldRow ?? null,
    new_values: data,
  });

  return ok(data);
}
