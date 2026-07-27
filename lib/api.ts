// FabAPI — canonical client-side wrapper.
//
//   • Bearer token held in closure (no localStorage, no XSS exfil surface)
//   • Refresh-token cookies handled by @supabase/ssr middleware
//   • XSS sanitization on every outbound string
//   • 20-min idle timeout (Worker) / 30-min (others)
//   • 401 → forced sign-out · 403 → toast · 429 → exponential backoff (max 3)

import { createClient } from "@/lib/supabase/client";
import { captureException } from "@/lib/observability";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ??
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/api`;

const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

let token: string | null = null;
let role: string | null = null;
let lastActivity = Date.now();

const IDLE_LIMITS: Record<string, number> = {
  worker: 20 * 60 * 1000,
  default: 30 * 60 * 1000,
};

export function setSession(accessToken: string | null, userRole?: string | null) {
  token = accessToken;
  role = userRole ?? null;
  lastActivity = Date.now();
}

export function getRole() { return role; }
export function getToken() { return token; }

// Page refresh sequence:
//   1. middleware reads cookie → user is signed in → page renders
//   2. React mounts → useDashboard/useResource* queries fire **immediately**
//   3. AuthSync's useEffect runs **after** that first render, so setSession
//      hasn't populated `token` yet → first API call ships no Bearer → 401
//      → old behaviour was signOut() → user bounced to /auth/signin
//
// To kill that race, every request asks the Supabase browser client for the
// current session if our in-memory cache is empty. getSession() resolves in a
// microtask when the cookies are already present (no network), so this is
// effectively free on the hot path.
async function ensureAccessToken(): Promise<string | null> {
  if (token) return token;
  if (typeof window === "undefined") return null;
  try {
    const sb = createClient();
    const { data: { session } } = await sb.auth.getSession();
    if (session?.access_token) {
      token = session.access_token;
      lastActivity = Date.now();
      return token;
    }
  } catch { /* swallow — caller falls through to the no-token path */ }
  return null;
}

// Same as above but force-skips the cache. Used after a 401 to give the SDK
// a chance to rotate the access_token (Supabase silently refreshes when the
// stored refresh_token is still valid) before we give up and sign the user out.
async function refreshAccessToken(): Promise<string | null> {
  token = null;
  return ensureAccessToken();
}

function isIdle(): boolean {
  const limit = IDLE_LIMITS[role ?? "default"] ?? IDLE_LIMITS.default;
  return Date.now() - lastActivity > limit;
}

const SCRIPT_RE = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
const TAG_RE = /<\/?[a-z][^>]*?>/gi;
const JS_PROTO_RE = /^\s*javascript:/i;

function sanitizeString(s: string) {
  return s.replace(SCRIPT_RE, "").replace(TAG_RE, "").replace(JS_PROTO_RE, "").trim();
}

export function sanitize<T>(input: T): T {
  if (input == null) return input;
  if (typeof input === "string") return sanitizeString(input) as unknown as T;
  if (Array.isArray(input)) return input.map(sanitize) as unknown as T;
  if (typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      out[k] = typeof v === "string" ? sanitizeString(v) : sanitize(v);
    }
    return out as T;
  }
  return input;
}

export class FabApiError extends Error {
  status: number;
  code: string;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type FetchOpts = {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  skipSanitize?: boolean;
  retries?: number;
};

export interface Pagination {
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
  offset?: number;
}

// Internal envelope returned by `callEnvelope` — exposes both data and the
// pagination metadata that the legacy `call<T>()` discards.
interface Envelope<T> {
  data: T;
  pagination?: Pagination;
}

async function callEnvelope<T>(path: string, method: string, opts: FetchOpts = {}): Promise<Envelope<T>> {
  if (isIdle()) {
    await signOut();
    throw new FabApiError("Session expired due to inactivity", 401, "idle_timeout");
  }
  lastActivity = Date.now();

  const url = new URL(API_BASE + path);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v != null) url.searchParams.set(k, String(v));
    }
  }

  const body = opts.body == null ? undefined :
    opts.skipSanitize ? JSON.stringify(opts.body) :
    JSON.stringify(sanitize(opts.body));

  const headers: Record<string, string> = {
    apikey: ANON_KEY,
    "content-type": "application/json",
  };
  const initialToken = await ensureAccessToken();
  if (initialToken) headers.authorization = `Bearer ${initialToken}`;

  const retries = opts.retries ?? 3;
  let lastError: FabApiError | null = null;
  let didReauth = false;

  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(url.toString(), { method, headers, body });
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 2 ** attempt * 500));
      lastError = new FabApiError("Rate limited", 429, "rate_limited");
      continue;
    }
    const text = await res.text();
    let json: {
      ok?: boolean;
      data?: unknown;
      error?: { message: string; code: string };
      count?: number;
      pagination?: Pagination;
    } = {};
    try { json = text ? JSON.parse(text) : {}; } catch { /* non-json */ }

    if (!res.ok) {
      const msg = json.error?.message ?? `HTTP ${res.status}`;
      const code = json.error?.code ?? "http_error";
      // 401 can fire for two reasons we can recover from:
      //   • race: AuthSync hasn't pushed the token into module state yet
      //   • drift: our cached access_token rotated server-side
      // Give the Supabase SDK one shot to hand us a fresh token before we
      // give up and sign the user out — otherwise refreshes feel like
      // random signouts even though the session is still valid.
      if (res.status === 401 && !didReauth) {
        didReauth = true;
        const fresh = await refreshAccessToken();
        if (fresh && fresh !== initialToken) {
          headers.authorization = `Bearer ${fresh}`;
          continue;
        }
      }
      if (res.status === 401) await signOut();
      const fabErr = new FabApiError(msg, res.status, code);
      if (res.status >= 500) captureException(fabErr, { route: path, method, status: res.status });
      throw fabErr;
    }
    return {
      data: (json.data ?? json) as T,
      pagination: json.pagination,
    };
  }
  throw lastError ?? new FabApiError("Network error", 0, "network");
}

async function call<T>(path: string, method: string, opts: FetchOpts = {}): Promise<T> {
  const env = await callEnvelope<T>(path, method, opts);
  return env.data;
}

async function signOut() {
  setSession(null, null);
  try {
    const sb = createClient();
    await sb.auth.signOut();
  } catch { /* ignore */ }
  if (typeof window !== "undefined") {
    window.location.href = "/auth/signin";
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------
export interface PagedResult<T> {
  rows: T[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

export interface BulkUpdateResult {
  total: number;
  succeeded: number;
  failed: number;
  succeeded_ids: string[];
  failures: Array<{ id: string; error: { message: string; code: string } }>;
  patch_applied: Record<string, unknown>;
}

/** One aggregated material line on a PO built from parts (profile + grade). */
export interface PoLineItem {
  profile: string;
  grade: string | null;
  qty: number;
  piece_count: number;
  total_weight_lb: number;
}

/** Read-only preview of the PO that would be created from a project's not_started parts. */
export interface PoFromPartsPreview {
  project_id: string;
  project_name: string;
  parts_count: number;
  line_items: PoLineItem[];
  total_pieces: number;
  total_weight_lb: number;
}

export interface CreatePoFromPartsBody {
  project_id: string;
  vendor: string;
  expected_date?: string;
  total_amount?: number;
  notes?: string;
}

export interface CreatePoFromPartsResult {
  purchase_order: Record<string, unknown> & { id: string; po_number: string };
  summary: {
    parts_ordered: number;
    line_items: number;
    total_pieces: number;
    total_weight_lb: number;
  };
}

// ---------------------------------------------------------------------------
// Procurement & Material Traceability — Phase 1
// ---------------------------------------------------------------------------

export interface MaterialLot {
  id: string;
  company_id: string;
  project_id: string | null;
  bundle_id: string | null;
  heat_number_id: string;
  lot_number: string;
  profile: string;
  grade: string;
  quantity: number;
  original_quantity: number;
  length: number | null;
  location: string | null;
  status: "available" | "reserved" | "released" | "consumed" | "scrapped";
  created_at: string;
  updated_at: string;
}

export interface AssignHeatBody {
  heat_number_id: string;
  project_id: string;
  profile: string;
  grade: string;
  length?: number;
  location?: string;
}

export interface AssignHeatResult {
  material_lot: MaterialLot;
}

export interface ExtractedMtrFields {
  heat_number: string | null;
  yield_strength: number | null;
  tensile_strength: number | null;
  chemistry: Record<string, number> | null;
  mill_name: string | null;
}

export interface ExtractMtrResult {
  mtr_document: Record<string, unknown> & { id: string; ocr_status: string };
  extracted: ExtractedMtrFields;
}

export const FabAPI = {
  // Generic CRUD
  list<T = unknown>(table: string, query?: Record<string, string | number | boolean | undefined>) {
    return call<T[]>(`/${table}`, "GET", { query });
  },
  /**
   * Paginated list. Use for any view that renders >25 rows or needs total /
   * has_more for "next page" buttons. The server caps per_page at 200; if
   * you ask for more it'll silently floor down.
   */
  async listPaged<T = unknown>(
    table: string,
    query?: Record<string, string | number | boolean | undefined>,
  ): Promise<PagedResult<T>> {
    const env = await callEnvelope<T[]>(`/${table}`, "GET", { query });
    const p = env.pagination;
    return {
      rows: env.data,
      total: p?.total ?? env.data.length,
      page: p?.page ?? 1,
      per_page: p?.per_page ?? env.data.length,
      has_more: p?.has_more ?? false,
    };
  },
  /**
   * Fetch EVERY row matching `query`, transparently paging past the server's
   * per-request cap (200). Use for small/medium reference tables that a view
   * needs in full for client-side filtering or aggregate counts (e.g. the
   * Drawing Log, which renders per-type tab totals from the complete set).
   *
   * Not for unbounded tables (parts, audit_log): a hard page ceiling caps the
   * walk at `maxPages × 200` rows so a runaway table can't fan out into an
   * unbounded request storm — it stops and returns what it has.
   *
   * @param query   Filters/sort (page/per_page are managed internally).
   * @param maxPages Safety ceiling on pages walked. Default 25 → up to 5 000 rows.
   */
  async listAll<T = unknown>(
    table: string,
    query?: Record<string, string | number | boolean | undefined>,
    maxPages = 25,
  ): Promise<T[]> {
    const perPage = 200; // server hard-caps here; asking for more is floored down.
    const rows: T[] = [];

    for (let page = 1; page <= maxPages; page++) {
      const result = await this.listPaged<T>(table, { ...query, page, per_page: perPage });
      rows.push(...result.rows);
      if (!result.has_more || result.rows.length === 0) break;
    }

    return rows;
  },
  get<T = unknown>(table: string, id: string) {
    return call<T>(`/${table}/${id}`, "GET");
  },
  create<T = unknown>(table: string, body: unknown) {
    return call<T>(`/${table}`, "POST", { body });
  },
  update<T = unknown>(table: string, id: string, body: unknown) {
    return call<T>(`/${table}/${id}`, "PATCH", { body });
  },
  /**
   * Bulk-update a list of ids on the same table. Per-row outcome — one row
   * failing doesn't fail the batch. Result includes `failures: [{ id, error }]`
   * so the UI can show "27 updated, 3 failed". Audit log + activity feed
   * are written server-side.
   */
  bulkUpdate(table: string, body: { ids: string[]; patch: Record<string, unknown> }) {
    return call<BulkUpdateResult>(`/${table}/bulk-update`, "POST", { body });
  },
  remove(table: string, id: string) {
    return call<{ deleted: boolean; id: string }>(`/${table}/${id}`, "DELETE");
  },

  /**
   * Preview the purchase order that would be built from a project's not_started
   * parts (aggregated by profile + grade). Read-only; safe to call as the modal
   * opens. Same aggregation the create path uses, so preview == result.
   */
  previewPoFromParts(project_id: string) {
    return call<PoFromPartsPreview>("/purchase-orders/preview-from-parts", "GET", { query: { project_id } });
  },
  /**
   * Create a draft PO from a project's not_started parts and flip those parts to
   * `ordered`. Atomic server-side pass — no per-row round-trips.
   */
  createPoFromParts(body: CreatePoFromPartsBody) {
    return call<CreatePoFromPartsResult>("/purchase-orders/from-parts", "POST", { body });
  },

  /**
   * Assign a heat number to a bundle. Creates the material_lot server-side
   * (bundle -> heat -> lot, one atomic RPC) and returns it.
   */
  assignHeatToBundle(bundleId: string, body: AssignHeatBody) {
    return call<AssignHeatResult>(`/bundles/${bundleId}/assign-heat`, "POST", { body });
  },
  /**
   * Best available lots for a profile/grade, closest-length-first then
   * oldest. Read-only — safe to call as a picker opens.
   */
  recommendLots(query: { profile: string; grade: string; min_length?: number; project_id?: string }) {
    return call<MaterialLot[]>("/material-lots/recommend", "GET", { query });
  },
  /**
   * Trigger OCR extraction on an MTR document that already has a file
   * attached. Advisory only — never sets ocr_status to 'verified'; a QC
   * user must review and verify separately.
   */
  extractMtrDocument(id: string) {
    return call<ExtractMtrResult>(`/mtr-documents/${id}/extract`, "POST");
  },

  // Specials
  dashboard() { return call<DashboardData>("/dashboard", "GET"); },
  getOrganization() { return call<Organization>("/organization", "GET"); },
  updateOrganization(body: Partial<Omit<Organization,
    "id" | "plan" | "aisc_cert" | "max_parts" | "max_projects" | "max_users" | "active">>) {
    return call<Organization>("/organization", "PATCH", { body });
  },
  importCsv(body: { project_id: string; rows: Record<string, string>[]; units?: "imperial" | "metric" | "auto" }) {
    return call("/import/csv", "POST", { body });
  },
  cutOptimize(body: {
    project_id?: string; profile: string; stock_length: number; kerf?: number;
    min_remnant?: number; cuts: { length: number; qty: number; mark?: string }[];
  }) { return call("/cut-optimize", "POST", { body }); },
  seedAisc(project_id: string) { return call("/seed-aisc", "POST", { body: { project_id } }); },
  inviteUser(body: { email: string; role: string; full_name?: string }) {
    return call("/invite-user", "POST", { body });
  },
  archiveProject(id: string) { return call(`/archive-project/${id}`, "POST"); },
  convertEstimate(body: { estimate_id: string; pm_id?: string; deadline?: string }) {
    return call("/convert-estimate", "POST", { body });
  },
  qcReport(project_id?: string) { return call("/qc-report", "GET", { query: project_id ? { project_id } : undefined }); },
  markAllNotificationsRead() { return call("/notifications/mark-all-read", "POST"); },

  // Files
  signUpload(body: { entity_type: string; entity_id: string; bucket: "drawings" | "mtrs" | "photos" | "billing"; filename: string; mime?: string; size?: number }) {
    return call<{ upload_url: string; token: string; storage_path: string; attachment_id: string; bucket: string }>(
      "/files/sign-upload", "POST", { body }
    );
  },
  signRead(attachmentId: string) {
    return call<{ url: string; mime_type: string | null; size_bytes: number | null; entity_type: string; entity_id: string; expires_in: number }>(
      `/files/sign-read/${attachmentId}`, "GET"
    );
  },
  listFiles(entity_type: string, entity_id: string) {
    return call<FileAttachment[]>("/files", "GET", { query: { entity_type, entity_id } });
  },
  // Clones an existing file_attachment to additional entities (same storage
  // object, multiple links). Used by the detailing-PDF importer to attach
  // one PDF to every part marked on the drawing in a single API round-trip.
  shareFile(body: { source_attachment_id: string; target_entity_type: string; target_entity_ids: string[] }) {
    return call<{ created: number; skipped: number; attachment_ids: string[] }>(
      "/files/share", "POST", { body, skipSanitize: true }
    );
  },
  deleteFile(id: string) { return call<{ deleted: boolean }>(`/files/${id}`, "DELETE"); },

  // AI Copilot
  copilot(body: { messages: { role: "user" | "assistant"; content: string }[]; project_id?: string }) {
    return call<{ reply: string; tokens_used?: number }>("/copilot", "POST", { body });
  },

  // Global search
  search(q: string) {
    return call<{ hits: SearchHit[]; q: string }>("/search", "GET", { query: { q } });
  },
};

export interface SearchHit {
  kind: "project" | "part" | "drawing" | "ncr" | "change_order" | "rfi";
  id: string;
  label: string;
  subtitle?: string;
  href: string;
}

export interface FileAttachment {
  id: string;
  storage_bucket: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
  uploaded_by: string | null;
}

// Helper that performs the full upload flow (sign → PUT → return attachment_id)
export async function uploadFile(opts: {
  file: File;
  entity_type: string;
  entity_id: string;
  bucket: "drawings" | "mtrs" | "photos" | "billing";
}): Promise<{ attachment_id: string; storage_path: string }> {
  const sign = await FabAPI.signUpload({
    entity_type: opts.entity_type,
    entity_id: opts.entity_id,
    bucket: opts.bucket,
    filename: opts.file.name,
    mime: opts.file.type,
    size: opts.file.size,
  });
  const put = await fetch(sign.upload_url, {
    method: "PUT",
    headers: { "content-type": opts.file.type || "application/octet-stream" },
    body: opts.file,
  });
  if (!put.ok) throw new FabApiError(`Upload failed: ${put.status}`, put.status, "upload_failed");
  return { attachment_id: sign.attachment_id, storage_path: sign.storage_path };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface Organization {
  id: string;
  name: string;
  legal_name: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  license_number: string | null;
  tax_id: string | null;
  logo_url: string | null;
  plan: string;
  aisc_cert: boolean;
  max_parts: number;
  max_projects: number;
  max_users: number;
  active: boolean;
  default_exclusions_qualifications?: string | null;
}

export interface DashboardData {
  parts_by_status: Record<string, number>;
  total_parts: number;
  total_weight: number;
  projects: Array<{
    id: string; name: string; number: string; gc_name: string | null;
    contract_value: number | null; deadline: string | null; status: string;
    color: string | null; pm_id: string | null;
    total_parts: number; completed: number; progress: number;
  }>;
  financial: { backlog: number; billed: number; retainage_held: number; collected: number; po_total: number } | null;
  cert_alerts: Array<{ id: string; cert_type: string; holder_name: string; expiry_date: string; alert_days: number }>;
  inventory_alerts: Array<{ id: string; profile: string; grade: string | null; quantity: number; reorder_point: number; status: string }>;
  activity: Array<{ id: string; user_name: string | null; action: string; entity_type: string; entity_label: string | null; created_at: string }>;
  open_ncrs: Array<{ id: string; ncr_number: string; description: string; status: string }>;
  open_change_orders: Array<{ id: string; co_number: string; amount: number; status: string }>;
  open_rfis: Array<{ id: string; rfi_number: string; question: string; status: string }>;
  recent_parts: Array<{ id: string; part_mark: string; profile: string; status: string; project_id: string | null; project_name: string | null }>;
  production_by_day: Array<{ date: string; parts_completed: number }>;
}
