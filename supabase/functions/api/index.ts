// FabSimple v5.1 — Edge Function entry point.
// Router for 18+ endpoints. CORS + rate limit + JWT auth before any handler.

import { corsHeaders, ok, err, preflight } from "./lib/response.ts";
import { log, requestId } from "./lib/log.ts";
import { authenticate } from "./middleware/auth.ts";
import { rateLimit } from "./middleware/rateLimit.ts";
import { listOrGet, create, update, remove } from "./controllers/crud.ts";
import { bulkUpdate } from "./controllers/bulk.ts";
import { dashboard } from "./controllers/dashboard.ts";
import { importCsv } from "./controllers/import.ts";
import { cutOptimize } from "./controllers/cutOptimizer.ts";
import {
  seedAisc,
  inviteUser,
  archiveProject,
  convertEstimate,
  qcReport,
  markAllNotificationsRead,
} from "./controllers/admin.ts";
import { signUpload, signRead, listAttachments, deleteAttachment, shareAttachment } from "./controllers/files.ts";
import { copilot } from "./controllers/copilot.ts";
import { signupBootstrap } from "./controllers/signup.ts";
import { acceptInvite } from "./controllers/acceptInvite.ts";
import { search } from "./controllers/search.ts";
import { getOrganization, updateOrganization } from "./controllers/organization.ts";
import { getPublicPart } from "./controllers/publicPart.ts";
import { resolveEPlanPiece, logEPlanPrint } from "./controllers/ePlan.ts";
import { overrideSafetyGate, recordFieldBoltInspection, logErectionDelay } from "./controllers/erectionOps.ts";
import { previewPoFromParts, createPoFromParts } from "./controllers/purchaseOrder.ts";
import { assignHeatToBundle, recommendLots } from "./controllers/heatAssignment.ts";
import { extractMtrDocument } from "./controllers/mtrExtraction.ts";
import { reserveLot, releaseLotReservation } from "./controllers/lotReservation.ts";
import { createRfq, createVendorQuote, awardVendorQuote } from "./controllers/rfq.ts";
import { importMaterialRequirements } from "./controllers/materialRequirementImport.ts";

const TABLE_RE = /^\/api\/?([a-z_]+)(?:\/([0-9a-f-]{36}))?\/?$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return preflight();

  const rid = requestId();
  const start = Date.now();
  const url = new URL(req.url);

  // Rate limit by client IP
  const ip =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for") ??
    "unknown";
  const rl = await rateLimit(ip);
  if (!rl.ok) {
    return new Response(
      JSON.stringify({ ok: false, error: { message: "Rate limit exceeded", code: "rate_limited" } }),
      {
        status: 429,
        headers: {
          "content-type": "application/json",
          "X-RateLimit-Reset": String(rl.resetAt),
          ...corsHeaders,
        },
      }
    );
  }

  // Health check (no auth)
  if (url.pathname.endsWith("/health")) {
    return ok({ status: "healthy", ts: new Date().toISOString() });
  }

  // Public: signup bootstrap (no JWT yet — uses one-shot auth_id verification)
  if (url.pathname.endsWith("/signup-bootstrap") && req.method === "POST") {
    return signupBootstrap(req);
  }

  // Public: accept-invite (no JWT yet — the invitee doesn't have one until
  // they consume the invitation token and sign in for the first time).
  if (url.pathname.endsWith("/accept-invite") && req.method === "POST") {
    return acceptInvite(req);
  }

  // Public: QR scan part viewer (no JWT required)
  if (url.pathname.includes("/public/parts/") && req.method === "GET") {
    const publicPartMatch = url.pathname.match(/\/public\/parts\/([0-9a-f-]{36})/i);
    if (publicPartMatch) return getPublicPart(publicPartMatch[1]);
  }

  // Public/Field: E-Plan resolution endpoint (no JWT required for QR scan at Ground Station)
  if (url.pathname.includes("/e-plan/resolve/") && req.method === "GET") {
    const pieceMatch = url.pathname.split("/e-plan/resolve/")[1];
    if (pieceMatch) return resolveEPlanPiece(decodeURIComponent(pieceMatch));
  }

  // Public/Field: E-Plan print log auditor
  if (url.pathname.endsWith("/e-plan/print-log") && req.method === "POST") {
    return logEPlanPrint(req);
  }

  // Public/Field: Erection Operations Endpoints
  if (url.pathname.endsWith("/erection-ops/safety-gate-override") && req.method === "POST") {
    return overrideSafetyGate(req);
  }
  if (url.pathname.endsWith("/erection-ops/field-bolt-inspection") && req.method === "POST") {
    return recordFieldBoltInspection(req);
  }
  if (url.pathname.endsWith("/erection-ops/delay") && req.method === "POST") {
    return logErectionDelay(req);
  }

  // Authenticate
  const ctxOrResponse = await authenticate(req, url);
  if (ctxOrResponse instanceof Response) return ctxOrResponse;
  const ctx = ctxOrResponse;

  // Update last_login (fire-and-forget)
  ctx.sbAdmin.from("users").update({ last_login: new Date().toISOString() }).eq("id", ctx.user.id).then(() => {});

  // Route
  try {
    const path = url.pathname.replace(/^\/api(?:\/?$)?/, "") || "/";
    const method = req.method;

    // Specials first
    if (path === "/dashboard" && method === "GET") return dashboard(ctx);
    if (path === "/organization" && method === "GET") return getOrganization(ctx);
    if (path === "/organization" && method === "PATCH") return updateOrganization(ctx);
    if (path === "/import/csv" && method === "POST") return importCsv(ctx);
    if (path === "/cut-optimize" && method === "POST") return cutOptimize(ctx);
    if (path === "/seed-aisc" && method === "POST") return seedAisc(ctx);
    if (path === "/invite-user" && method === "POST") return inviteUser(ctx);
    if (path === "/convert-estimate" && method === "POST") return convertEstimate(ctx);
    if (path === "/qc-report" && method === "GET") return qcReport(ctx);
    if (path === "/notifications/mark-all-read" && method === "POST") return markAllNotificationsRead(ctx);
    // Purchase order from not-started parts (declared before generic CRUD so the
    // hyphenated sub-paths aren't misread as a table/id).
    if (path === "/purchase-orders/preview-from-parts" && method === "GET") return previewPoFromParts(ctx);
    if (path === "/purchase-orders/from-parts" && method === "POST") return createPoFromParts(ctx);
    const archMatch = path.match(/^\/archive-project\/([0-9a-f-]{36})$/i);
    if (archMatch && method === "POST") return archiveProject(ctx, archMatch[1]);

    // Procurement & Material Traceability (declared before generic CRUD so
    // these hyphenated sub-paths aren't misread as a table/id).
    if (path === "/material-lots/recommend" && method === "GET") return recommendLots(ctx);
    const assignHeatMatch = path.match(/^\/bundles\/([0-9a-f-]{36})\/assign-heat$/i);
    if (assignHeatMatch && method === "POST") return assignHeatToBundle(ctx, assignHeatMatch[1]);
    const extractMtrMatch = path.match(/^\/mtr-documents\/([0-9a-f-]{36})\/extract$/i);
    if (extractMtrMatch && method === "POST") return extractMtrDocument(ctx, extractMtrMatch[1]);
    const reserveLotMatch = path.match(/^\/material-lots\/([0-9a-f-]{36})\/reserve$/i);
    if (reserveLotMatch && method === "POST") return reserveLot(ctx, reserveLotMatch[1]);
    const releaseResMatch = path.match(/^\/lot-reservations\/([0-9a-f-]{36})\/release$/i);
    if (releaseResMatch && method === "POST") return releaseLotReservation(ctx, releaseResMatch[1]);

    // Sourcing Workflow (Phase 2, §15) — compound creates go through
    // RPC-backed endpoints, not the generic /rfqs, /vendor_quotes POST route.
    if (path === "/rfqs" && method === "POST") return createRfq(ctx);
    if (path === "/vendor-quotes" && method === "POST") return createVendorQuote(ctx);
    const awardMatch = path.match(/^\/vendor-quotes\/([0-9a-f-]{36})\/award$/i);
    if (awardMatch && method === "POST") return awardVendorQuote(ctx, awardMatch[1]);
    if (path === "/material-requirements/import" && method === "POST") return importMaterialRequirements(ctx);

    // Files
    if (path === "/files/sign-upload" && method === "POST") return signUpload(ctx);
    if (path === "/files/share" && method === "POST") return shareAttachment(ctx);
    if (path === "/files" && method === "GET") return listAttachments(ctx);
    const signReadMatch = path.match(/^\/files\/sign-read\/([0-9a-f-]{36})$/i);
    if (signReadMatch && method === "GET") return signRead(ctx, signReadMatch[1]);
    const delFileMatch = path.match(/^\/files\/([0-9a-f-]{36})$/i);
    if (delFileMatch && method === "DELETE") return deleteAttachment(ctx, delFileMatch[1]);

    // AI Copilot
    if (path === "/copilot" && method === "POST") return copilot(ctx);

    // Global search
    if (path === "/search" && method === "GET") return search(ctx);

    // Bulk update on a table: /{table}/bulk-update
    // Matches *before* the generic /{table}/{id} route so "bulk-update" isn't
    // interpreted as a UUID.
    const bulkMatch = path.match(/^\/([a-z_]+)\/bulk-update$/i);
    if (bulkMatch && method === "POST") {
      return bulkUpdate(ctx, bulkMatch[1]);
    }

    // Generic CRUD: /{table} or /{table}/{id}
    const match = url.pathname.match(TABLE_RE);
    if (match) {
      const [, table, id] = match;
      if (id) {
        if (method === "GET") return listOrGet(ctx, table, id);
        if (method === "PATCH") return update(ctx, table, id);
        if (method === "DELETE") return remove(ctx, table, id);
      } else {
        if (method === "GET") return listOrGet(ctx, table);
        if (method === "POST") return create(ctx, table);
      }
    }

    log.warn("route_not_found", { request_id: rid, route: url.pathname, method: req.method });
    return err("Not found", 404, "no_route");
  } catch (e) {
    log.error("unhandled_exception", {
      request_id: rid,
      route: url.pathname,
      method: req.method,
      error_code: "internal",
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack?.split("\n").slice(0, 6).join(" | ") : undefined,
      duration_ms: Date.now() - start,
      user_id: ctx.user.id,
      company_id: ctx.user.company_id,
    });
    return err(e instanceof Error ? e.message : "Internal error", 500, "internal");
  } finally {
    log.info("request_completed", {
      request_id: rid,
      route: url.pathname,
      method: req.method,
      duration_ms: Date.now() - start,
      user_id: ctx.user.id,
      company_id: ctx.user.company_id,
    });
  }
});
