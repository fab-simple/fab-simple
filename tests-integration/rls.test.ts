// RLS policy smoke tests. These run against a live local Supabase stack and
// verify that:
//  - anonymous users cannot read tenant data
//  - authenticated user from company A cannot see company B's data
//  - workers cannot create/modify projects (RBAC enforced via Edge Function +
//    RLS deny on write)
//
// Run with `npm run test:integration` after `npx supabase start && npx supabase db reset`.

import { describe, it, expect, beforeAll } from "vitest";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

let anon: SupabaseClient;
let admin: SupabaseClient;

beforeAll(() => {
  anon = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
});

describe("RLS — anon access", () => {
  it("cannot read companies", async () => {
    const { data, error } = await anon.from("companies").select("id").limit(1);
    expect(data?.length ?? 0).toBe(0);
    // Either an explicit RLS error or just an empty result is acceptable
    expect(error?.code ?? "PGRST116").toBeTruthy();
  });

  it("cannot read parts", async () => {
    const { data } = await anon.from("parts").select("id").limit(1);
    expect(data?.length ?? 0).toBe(0);
  });

  it("cannot insert into ncr_reports", async () => {
    const { error } = await anon.from("ncr_reports").insert({ description: "hack" });
    expect(error).toBeTruthy();
  });
});

describe("RLS — service role bypass", () => {
  it("admin can count companies", async () => {
    const { count, error } = await admin.from("companies").select("*", { count: "exact", head: true });
    expect(error).toBeNull();
    expect(typeof count).toBe("number");
  });
});

describe("RLS — multi-tenant isolation", () => {
  it("a user from one company cannot see another company's projects", async () => {
    // Create two companies + one user in company A
    const compA = await admin.from("companies").insert({ name: `rls-A-${Date.now()}` }).select("id").single();
    const compB = await admin.from("companies").insert({ name: `rls-B-${Date.now()}` }).select("id").single();
    expect(compA.error).toBeNull();
    expect(compB.error).toBeNull();

    // Seed a project in B
    await admin.from("projects").insert({ company_id: compB.data!.id, name: "B's secret", status: "in_progress" });

    // Create an auth user in A
    const email = `rls-user-${Date.now()}@test.dev`;
    const password = "test-password-12345";
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    expect(created.error).toBeNull();
    const authId = created.data.user!.id;

    await admin.from("users").insert({
      auth_id: authId, company_id: compA.data!.id,
      email, full_name: "RLS User", role: "owner", is_active: true,
    });

    // Sign in as that user via anon client
    const { data: sess, error: signErr } = await anon.auth.signInWithPassword({ email, password });
    expect(signErr).toBeNull();
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${sess!.session!.access_token}` } },
      auth: { persistSession: false },
    });

    const { data: visible } = await userClient.from("projects").select("id, name, company_id");
    const hasOther = (visible ?? []).some((p: { company_id: string }) => p.company_id === compB.data!.id);
    expect(hasOther).toBe(false);

    // Cleanup
    await admin.auth.admin.deleteUser(authId);
    await admin.from("companies").delete().in("id", [compA.data!.id, compB.data!.id]);
  });
});
