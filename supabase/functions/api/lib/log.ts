// Structured JSON logger for Edge Functions.
// Outputs single-line JSON so Supabase Logs / Logflare can parse and index.

type Level = "debug" | "info" | "warn" | "error";

interface LogFields {
  msg: string;
  level: Level;
  ts: string;
  request_id?: string;
  user_id?: string;
  company_id?: string;
  route?: string;
  method?: string;
  status?: number;
  duration_ms?: number;
  error_code?: string;
  [key: string]: unknown;
}

function emit(fields: LogFields) {
  const line = JSON.stringify(fields);
  if (fields.level === "error") console.error(line);
  else if (fields.level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  info: (msg: string, fields: Record<string, unknown> = {}) =>
    emit({ ...fields, msg, level: "info", ts: new Date().toISOString() }),
  warn: (msg: string, fields: Record<string, unknown> = {}) =>
    emit({ ...fields, msg, level: "warn", ts: new Date().toISOString() }),
  error: (msg: string, fields: Record<string, unknown> = {}) =>
    emit({ ...fields, msg, level: "error", ts: new Date().toISOString() }),
  debug: (msg: string, fields: Record<string, unknown> = {}) => {
    if (Deno.env.get("LOG_LEVEL") === "debug") {
      emit({ ...fields, msg, level: "debug", ts: new Date().toISOString() });
    }
  },
};

export function requestId(): string {
  return crypto.randomUUID();
}
