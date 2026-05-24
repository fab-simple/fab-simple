// Cross-instance rate limit.
//
// Order of preference:
//   1. Upstash Redis (cheapest @ scale, ~1ms p50, requires UPSTASH_REDIS_REST_URL/TOKEN)
//   2. Postgres rl_check() RPC (always available; uses the rate_limit_buckets table)
//   3. In-memory map (per-instance only; resets on cold start)
//
// All three return the same shape so callers don't care which is active.
//
// Default policy: 120 requests / 60s per client key (IP).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const LIMIT = Number(Deno.env.get("RATE_LIMIT") ?? "120");
const WINDOW_S = Number(Deno.env.get("RATE_WINDOW_SECONDS") ?? "60");

const memory = new Map<string, { count: number; resetAt: number }>();

const UPSTASH_URL = Deno.env.get("UPSTASH_REDIS_REST_URL");
const UPSTASH_TOKEN = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const RL_BACKEND = (Deno.env.get("RATE_LIMIT_BACKEND") ?? "auto").toLowerCase();

let _admin: ReturnType<typeof createClient> | null = null;
function adminClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
  _admin ??= createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  return _admin;
}

export interface RateLimitResult { ok: boolean; remaining: number; resetAt: number; backend: string; }

export async function rateLimit(key: string): Promise<RateLimitResult> {
  // Explicit forced backend (useful for tests)
  if (RL_BACKEND === "memory") return memoryLimit(key);
  if (RL_BACKEND === "postgres") return (await postgresLimit(key)) ?? memoryLimit(key);
  if (RL_BACKEND === "upstash") {
    if (UPSTASH_URL && UPSTASH_TOKEN) {
      try { return await upstashLimit(key); } catch { /* fall back */ }
    }
    return memoryLimit(key);
  }

  // Auto: prefer Upstash → Postgres → memory
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try { return await upstashLimit(key); } catch { /* fall through */ }
  }
  const pg = await postgresLimit(key);
  if (pg) return pg;
  return memoryLimit(key);
}

function memoryLimit(key: string): RateLimitResult {
  const now = Date.now();
  const bucket = memory.get(key);
  if (!bucket || bucket.resetAt < now) {
    memory.set(key, { count: 1, resetAt: now + WINDOW_S * 1000 });
    return { ok: true, remaining: LIMIT - 1, resetAt: now + WINDOW_S * 1000, backend: "memory" };
  }
  bucket.count += 1;
  return { ok: bucket.count <= LIMIT, remaining: Math.max(0, LIMIT - bucket.count), resetAt: bucket.resetAt, backend: "memory" };
}

async function postgresLimit(key: string): Promise<RateLimitResult | null> {
  const admin = adminClient();
  if (!admin) return null;
  try {
    const { data, error } = await admin.rpc("rl_check", {
      p_key: key, p_max: LIMIT, p_window_seconds: WINDOW_S,
    });
    if (error || !data || data.length === 0) return null;
    const row = data[0] as { over_limit: boolean; used: number; reset_at: string };
    return {
      ok: !row.over_limit,
      remaining: Math.max(0, LIMIT - row.used),
      resetAt: +new Date(row.reset_at),
      backend: "postgres",
    };
  } catch {
    return null;
  }
}

async function upstashLimit(key: string): Promise<RateLimitResult> {
  const k = `fabsimple:rl:${key}`;
  const now = Date.now();
  const resetAt = now + WINDOW_S * 1000;
  const incrResp = await fetch(`${UPSTASH_URL}/incr/${k}`, {
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
  });
  const incr = await incrResp.json();
  const count = incr.result as number;
  if (count === 1) {
    await fetch(`${UPSTASH_URL}/pexpire/${k}/${WINDOW_S * 1000}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    });
  }
  return { ok: count <= LIMIT, remaining: Math.max(0, LIMIT - count), resetAt, backend: "upstash" };
}
