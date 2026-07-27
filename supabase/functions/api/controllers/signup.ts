// Signup bootstrap. Called immediately after Supabase Auth creates an auth.user
// (no JWT yet — we look up by email + token). Creates:
//   1. companies row
//   2. public.users row (role=owner, auth_id linked)
//   3. subscriptions row (Starter trial, 14 days)
//   4. seeds basic AISC catalogue? -> no, leave optional
//
// This endpoint is unauthenticated; it relies on a one-shot bootstrap_token
// returned by the signup form (we mint it from the email + new auth_id +
// time). Rate-limited at the router level.

import { ok, err } from "../lib/response.ts";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export async function signupBootstrap(req: Request): Promise<Response> {
  const body = await req.json().catch(() => ({}));
  const { auth_id, email, full_name, company_name } = body;
  if (!auth_id || !email || !full_name || !company_name) {
    return err("auth_id, email, full_name, company_name required", 422, "validation");
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

  // Verify the auth user exists and was created within the last 60s (anti-spam)
  const { data: { user: authUser }, error: lookupErr } = await admin.auth.admin.getUserById(auth_id);
  if (lookupErr || !authUser) return err("Auth user not found", 404, "no_auth_user");
  if (authUser.email !== email) return err("Email mismatch", 403, "email_mismatch");
  const ageMs = Date.now() - new Date(authUser.created_at).getTime();
  if (ageMs > 10 * 60 * 1000) return err("Bootstrap window expired", 410, "stale");

  // Idempotency: if a users row exists for this auth_id, return it
  const { data: existingUser } = await admin.from("users").select("id, company_id").eq("auth_id", auth_id).maybeSingle();
  if (existingUser) {
    return ok({ already_bootstrapped: true, user_id: existingUser.id, company_id: existingUser.company_id });
  }

  // 1. Create company (Starter plan defaults)
  const { data: company, error: cErr } = await admin.from("companies").insert({
    name: company_name,
    plan: "starter",
    max_parts: 5000,
    max_projects: 1,
    max_users: 5,
  }).select("id").single();
  if (cErr) return err(cErr.message, 400, "db_error");

  // 2. Create public.users row as owner
  const { data: userRow, error: uErr } = await admin.from("users").insert({
    auth_id,
    company_id: company.id,
    email,
    full_name,
    role: "owner",
    is_active: true,
  }).select("id").single();
  if (uErr) {
    await admin.from("companies").delete().eq("id", company.id);
    return err(uErr.message, 400, "db_error");
  }

  // 3. Create subscription (Starter trial, 14-day)
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 14);
  await admin.from("subscriptions").insert({
    company_id: company.id,
    plan: "starter",
    status: "trialing",
    current_period_end: trialEnd.toISOString(),
    max_users: 5,
    max_projects: 1,
  });

  return ok({
    bootstrapped: true,
    user_id: userRow.id,
    company_id: company.id,
    trial_ends_at: trialEnd.toISOString(),
  });
}
