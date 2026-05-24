// JWT validation + user lookup. Returns a fully populated Ctx or null.

import type { Ctx, Role } from "../lib/types.ts";
import { userClient, adminClient } from "../lib/supabase.ts";
import { err } from "../lib/response.ts";

export async function authenticate(req: Request, url: URL): Promise<Ctx | Response> {
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return err("Missing or malformed Authorization header", 401, "unauthenticated");
  }
  const bearer = authHeader.slice("Bearer ".length).trim();
  if (!bearer) return err("Empty bearer token", 401, "unauthenticated");

  const sb = userClient(bearer);
  const sbAdmin = adminClient();

  // Verify JWT via getUser (this hits Supabase Auth, validating the token)
  const { data: authData, error: authErr } = await sb.auth.getUser(bearer);
  if (authErr || !authData?.user) {
    return err("Invalid or expired token", 401, "unauthenticated");
  }

  // Look up our public.users row
  const { data: row, error: rowErr } = await sbAdmin
    .from("users")
    .select("id, company_id, role, full_name, email, is_active")
    .eq("auth_id", authData.user.id)
    .single();

  if (rowErr || !row) {
    return err("User profile not found", 403, "no_profile");
  }
  if (!row.is_active) {
    return err("User account is deactivated", 403, "deactivated");
  }

  return {
    req,
    url,
    user: {
      id: row.id as string,
      auth_id: authData.user.id,
      company_id: row.company_id as string,
      role: row.role as Role,
      full_name: row.full_name as string,
      email: row.email as string,
    },
    sb,
    sbAdmin,
    bearer,
    ip:
      req.headers.get("cf-connecting-ip") ??
      req.headers.get("x-forwarded-for") ??
      "unknown",
    ua: req.headers.get("user-agent") ?? "unknown",
  };
}
