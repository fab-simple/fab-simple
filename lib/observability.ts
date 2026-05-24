// Minimal observability hook.
//
// In production, swap the body of `captureException` and `captureMessage`
// for `Sentry.captureException(...)` once @sentry/nextjs is installed and
// `NEXT_PUBLIC_SENTRY_DSN` is set. The helpers below give us call sites
// today without committing to a vendor or adding dependencies.

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

export function captureException(err: unknown, context?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const payload = {
    msg: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
    context,
    ts: new Date().toISOString(),
  };
  console.error("[obs]", payload);
  if (DSN) {
    // Future: Sentry.captureException(err, { extra: context });
  }
}

export function captureMessage(msg: string, level: "info" | "warning" | "error" = "info", context?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  if (DSN) {
    // Future: Sentry.captureMessage(msg, { level, extra: context });
  }
  if (level === "error") console.error("[obs]", { msg, context });
  else if (level === "warning") console.warn("[obs]", { msg, context });
  else console.log("[obs]", { msg, context });
}

export function setUser(user: { id: string; email?: string; role?: string }) {
  if (typeof window === "undefined") return;
  if (DSN) {
    // Future: Sentry.setUser({ id: user.id, email: user.email, role: user.role });
  }
}

// Wire global error handlers once at app boot
let installed = false;
export function installGlobalErrorHandlers() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("error", (e) => captureException(e.error ?? e.message, { type: "window.error" }));
  window.addEventListener("unhandledrejection", (e) =>
    captureException(e.reason, { type: "unhandledrejection" })
  );
}
