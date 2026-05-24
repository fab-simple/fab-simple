// XSS prevention for string fields. Strips HTML tags and dangerous JS protocols.

const SCRIPT_RE = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
const TAG_RE = /<\/?[a-z][^>]*?>/gi;
const JS_PROTO_RE = /^\s*javascript:/i;
const DATA_HTML_RE = /^\s*data:text\/html/i;

export function sanitizeString(s: string): string {
  if (typeof s !== "string") return s;
  return s
    .replace(SCRIPT_RE, "")
    .replace(TAG_RE, "")
    .replace(JS_PROTO_RE, "")
    .replace(DATA_HTML_RE, "")
    .trim();
}

export function sanitize<T>(obj: T): T {
  if (obj == null || typeof obj !== "object") {
    return typeof obj === "string" ? (sanitizeString(obj as string) as T) : obj;
  }
  if (Array.isArray(obj)) return obj.map(sanitize) as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = sanitizeString(v);
    else if (v && typeof v === "object") out[k] = sanitize(v);
    else out[k] = v;
  }
  return out as T;
}
