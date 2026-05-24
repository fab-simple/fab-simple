import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = new Set([
  "/auth/signin",
  "/auth/signup",
  "/auth/forgot",
  "/auth/callback",
  "/auth/accept-invite",
]);

const WORKER_ALLOW = [
  "/worker",
  "/dashboard/worker",
  "/dashboard/parts",      // worker can read/update assigned parts
  "/dashboard/drawings",   // worker reads drawings (QR scan)
];

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

  // Public paths — always allow
  if (PUBLIC_PATHS.has(path) || path.startsWith("/auth")) return response;

  // Static + Next internals
  if (path.startsWith("/_next") || path.startsWith("/api") || path === "/favicon.ico") {
    return response;
  }

  // Not logged in → redirect to signin
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/signin";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  // Workers are restricted to a small set of routes
  const role = (user.user_metadata?.role as string | undefined)
    ?? (user.app_metadata?.role as string | undefined);
  if (role === "worker") {
    const allowed = WORKER_ALLOW.some((p) => path === p || path.startsWith(p + "/"));
    if (!allowed) {
      const url = request.nextUrl.clone();
      url.pathname = "/worker";
      return NextResponse.redirect(url);
    }
  }

  return response;
}
