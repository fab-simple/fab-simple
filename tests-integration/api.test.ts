// Edge Function HTTP integration tests. Requires a running local stack with
// the demo seed: `npx supabase start && npx supabase db reset`.

import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const API_BASE = process.env.NEXT_PUBLIC_API_BASE!;

let token: string;

const DEMO_EMAIL = process.env.E2E_DEMO_EMAIL ?? "owner@fabsimple.demo";
const DEMO_PASSWORD = process.env.E2E_DEMO_PASSWORD ?? "demo-password-12345";

beforeAll(async () => {
  const sb = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
  if (error || !data.session) throw new Error("Demo signin failed — apply seed migration first");
  token = data.session.access_token;
});

function authHeaders() {
  return {
    apikey: ANON_KEY,
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
}

describe("Edge Function API", () => {
  it("GET /health returns ok", async () => {
    const r = await fetch(`${API_BASE}/health`);
    expect(r.ok).toBe(true);
    const j = await r.json();
    expect(j.ok).toBe(true);
    expect(j.data.status).toBe("healthy");
  });

  it("GET /projects returns rows for the signed-in user", async () => {
    const r = await fetch(`${API_BASE}/projects`, { headers: authHeaders() });
    expect(r.ok).toBe(true);
    const j = await r.json();
    expect(j.ok).toBe(true);
    expect(Array.isArray(j.data)).toBe(true);
  });

  it("GET /dashboard returns aggregate KPIs", async () => {
    const r = await fetch(`${API_BASE}/dashboard`, { headers: authHeaders() });
    expect(r.ok).toBe(true);
    const j = await r.json();
    expect(j.data).toHaveProperty("kpis");
  });

  it("GET /search?q=… returns hits with kind+id+href", async () => {
    const r = await fetch(`${API_BASE}/search?q=ds`, { headers: authHeaders() });
    expect(r.ok).toBe(true);
    const j = await r.json();
    expect(Array.isArray(j.data.hits)).toBe(true);
  });

  it("POST /cut-optimize returns a plan", async () => {
    const r = await fetch(`${API_BASE}/cut-optimize`, {
      method: "POST", headers: authHeaders(),
      body: JSON.stringify({
        profile: "W12x26", stock_length: 240,
        cuts: [{ length: 96, qty: 4 }, { length: 48, qty: 6 }],
      }),
    });
    expect(r.ok).toBe(true);
    const j = await r.json();
    expect(j.data.total_bars).toBeGreaterThan(0);
    expect(j.data.bars.length).toBe(j.data.total_bars);
  });

  it("POST /signup-bootstrap rejects missing fields", async () => {
    const r = await fetch(`${API_BASE}/signup-bootstrap`, {
      method: "POST",
      headers: { apikey: ANON_KEY, "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(r.status).toBe(422);
  });

  it("rejects requests without auth", async () => {
    const r = await fetch(`${API_BASE}/projects`);
    expect(r.status).toBeGreaterThanOrEqual(400);
  });
});
