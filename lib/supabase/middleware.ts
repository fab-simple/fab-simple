import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { rolesForPath, homeForRole, type Role } from "@/lib/nav-config";

const PUBLIC_PATHS = new Set([
  "/auth/signin",
  "/auth/signup",
  "/auth/forgot",
  "/auth/update-password",
  "/auth/callback",
  "/auth/accept-invite",
]);

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(items) {
          items.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  // Public auth flows — always allow.
  if (PUBLIC_PATHS.has(path) || path.startsWith("/auth")) return response;

  // Next.js internals + API passthrough.
  if (path.startsWith("/_next") || path.startsWith("/api") || path === "/favicon.ico") {
    return response;
  }

  // Not signed in → redirect to signin with the intended path preserved.
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/signin";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  // SECURITY: read role from app_metadata ONLY. user_metadata is
  // user-writable via supabase.auth.updateUser({ data: { role: ... } }),
  // so trusting it would let any signed-in user spoof their role and
  // bypass route gating.
  const role = ((user.app_metadata?.role as string | undefined) ?? "") as Role;

  // Workers are exclusively allowed on /worker and a tiny allow-list of
  // dashboard surfaces required for QR-scan deep links (drawings, parts).
  if (role === "worker") {
    const allowed = rolesForPath(path);
    if (!allowed || !allowed.includes("worker")) {
      const url = request.nextUrl.clone();
      url.pathname = "/worker";
      return NextResponse.redirect(url);
    }
    return response;
  }

  // For every other role: check the canonical route → roles map. Routes that
  // aren't listed (e.g. /, /worker-specific paths) fall through here untouched
  // unless they're explicitly in the matrix.
  const allowed = rolesForPath(path);
  if (allowed && role && !allowed.includes(role)) {
    const url = request.nextUrl.clone();
    url.pathname = homeForRole(role);
    url.searchParams.set("denied", path);
    return NextResponse.redirect(url);
  }

  return response;
}
