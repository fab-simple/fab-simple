import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Sanitize a `next` redirect target so we never bounce the user to an
 * external origin. Accepts only same-origin paths that start with a single
 * slash. Anything else (absolute URLs, protocol-relative `//evil.com`,
 * empty strings) falls back to `/dashboard`.
 */
function safeNext(raw: string | null): string {
  if (!raw) return "/dashboard";
  if (!raw.startsWith("/")) return "/dashboard";
  if (raw.startsWith("//")) return "/dashboard"; // protocol-relative
  if (raw.startsWith("/\\")) return "/dashboard"; // backslash trick
  return raw;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const type = url.searchParams.get("type");
  const rawNext = url.searchParams.get("next");

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  // Password-recovery callbacks should land on /auth/update-password so the
  // user can actually set a new password — not silently into /dashboard.
  if (type === "recovery") {
    return NextResponse.redirect(new URL("/auth/update-password", request.url));
  }

  const next = safeNext(rawNext);
  return NextResponse.redirect(new URL(next, request.url));
}
