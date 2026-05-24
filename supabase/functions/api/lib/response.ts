// Standardised JSON responses with CORS headers.

const ALLOWED_ORIGIN = Deno.env.get("CORS_ORIGIN") ?? "*";

export const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

export function json(body: unknown, status = 200, extra: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders, ...extra },
  });
}

export function ok<T>(data: T, extra?: Record<string, unknown>): Response {
  return json({ ok: true, data, ...(extra ?? {}) });
}

export function err(message: string, status = 400, code?: string): Response {
  return json({ ok: false, error: { message, code: code ?? "error" } }, status);
}

export function preflight(): Response {
  return new Response(null, { status: 204, headers: corsHeaders });
}
