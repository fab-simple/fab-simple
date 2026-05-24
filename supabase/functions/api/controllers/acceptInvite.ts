// Accept-invite flow (public — no caller JWT yet).
//
// 1. Owner calls POST /invite-user — inserts a user_invitations row and asks
//    Supabase to send a magic link with `?token=<invite_token>`.
// 2. Invitee clicks the email, lands on /auth/accept-invite which calls
//    POST /accept-invite { token, password } in the browser.
// 3. We look up the invitation, create/update the Supabase auth user, and
//    create the public.users row in the inviting company with the assigned
//    role. The invitation row is marked accepted_at = now().
// 4. The client then signs the user in with email+password and lands them
//    on /dashboard with a real role-bearing JWT.
//
// Without this route, the link the owner sent was a 404 and customers could
// not onboard their team.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ok, err } from "../lib/response.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

interface AcceptBody {
  token?: string;
  email?: string;
  password?: string;
  full_name?: string;
}

export async function acceptInvite(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as AcceptBody;
  const { token, email, password, full_name } = body;
  if (!token || !email || !password) {
    return err("token, email and password are required", 422, "validation");
  }
  if (password.length < 8) {
    return err("Password must be at least 8 characters", 422, "validation");
  }

  const sb = adminClient();

  // 1) Look up the invitation, verify not consumed / not expired.
  const { data: inv, error: invErr } = await sb.from("user_invitations")
    .select("id, company_id, email, role, accepted_at, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (invErr || !inv) return err("Invalid or expired invitation", 404, "invalid_token");
  if (inv.accepted_at) return err("Invitation already used", 409, "already_used");
  if (inv.expires_at && new Date(inv.expires_at as string).getTime() < Date.now()) {
    return err("Invitation has expired", 410, "expired");
  }
  if ((inv.email as string).toLowerCase() !== email.toLowerCase()) {
    return err("Email does not match invitation", 403, "email_mismatch");
  }

  // 2) Make sure the email isn't already used by an auth user. If they exist
  //    (e.g. Supabase Auth pre-created them when the owner clicked Invite),
  //    just set the password and metadata.
  const list = await sb.auth.admin.listUsers({ perPage: 200 });
  const existing = list.data?.users.find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase());

  let authUserId: string;
  if (existing) {
    const { data: upd, error: updErr } = await sb.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name ?? null },
      app_metadata: { role: inv.role, company_id: inv.company_id },
    });
    if (updErr || !upd) return err(updErr?.message ?? "Failed to set password", 400, "auth_error");
    authUserId = upd.user.id;
  } else {
    const { data: newUser, error: newErr } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name ?? null },
      app_metadata: { role: inv.role, company_id: inv.company_id },
    });
    if (newErr || !newUser) return err(newErr?.message ?? "Failed to create user", 400, "auth_error");
    authUserId = newUser.user.id;
  }

  // 3) Upsert the public.users row. The trg_sync_user_role_to_jwt trigger
  //    will keep auth.users.app_metadata.role in sync on subsequent edits.
  const { data: existingProfile } = await sb.from("users")
    .select("id").eq("auth_id", authUserId).maybeSingle();

  if (existingProfile) {
    await sb.from("users").update({
      company_id: inv.company_id,
      role: inv.role,
      email,
      full_name: full_name ?? null,
      is_active: true,
    }).eq("id", existingProfile.id);
  } else {
    const { error: insErr } = await sb.from("users").insert({
      auth_id: authUserId,
      company_id: inv.company_id,
      role: inv.role,
      email,
      full_name: full_name ?? null,
      is_active: true,
    });
    if (insErr) return err(insErr.message, 400, "db_error");
  }

  // 4) Mark the invitation consumed.
  await sb.from("user_invitations").update({
    accepted_at: new Date().toISOString(),
  }).eq("id", inv.id);

  return ok({ accepted: true, email, role: inv.role });
}
