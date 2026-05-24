// User-scoped + service-role Supabase client factories.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** RLS-enforced client. Pass the user's bearer token to scope queries. */
export function userClient(bearer: string) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${bearer}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Service-role client. **Bypasses RLS.** Use only for:
 *   1. audit_log writes
 *   2. activity_feed writes
 *   3. inviting new users
 *   4. next_sequence_number() RPC (also security definer at SQL layer)
 *   5. last_login bookkeeping
 */
export function adminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
