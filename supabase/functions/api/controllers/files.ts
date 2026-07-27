// File handling: signed upload URLs + signed read URLs + attachment registration.
// Storage buckets: drawings, mtrs, photos, billing (all private).
//
// Flow:
//   1. Client → POST /files/sign-upload { entity_type, entity_id, bucket, filename, mime, size }
//      → server validates RBAC, returns { upload_url, storage_path, attachment_id (pre-issued) }
//   2. Client → PUT to upload_url with raw bytes
//   3. Client → POST /files/register { attachment_id } (or it's auto-confirmed via webhook)
//   4. Anyone with read access → GET /files/sign-read/:id → { url, expires_in }

import type { Ctx } from "../lib/types.ts";
import { ok, err } from "../lib/response.ts";
import { writeAudit, writeActivity } from "../services/audit.ts";

const ALLOWED_BUCKETS = new Set(["drawings", "mtrs", "photos", "billing"]);

// Map entity → required role(s) to upload to it
const UPLOAD_RBAC: Record<string, string[]> = {
  drawings:           ["owner", "pm", "estimator"],
  ncr_reports:        ["owner", "pm", "qc"],
  paint_inspections:  ["owner", "pm", "qc"],
  weld_inspections:   ["owner", "pm", "qc"],
  receiving_logs:     ["owner", "pm", "foreman"],
  shipping_tickets:   ["owner", "pm", "foreman"],
  billing_applications:["owner", "pm", "accounting"],
  daily_production_log:["owner", "pm", "foreman", "worker"],
  parts:              ["owner", "pm", "foreman", "worker"],
  // Procurement & Material Traceability — Phase 1 (mirrors permissions.ts)
  inbound_shipments: ["owner", "pm", "foreman", "accounting"],
  receivings:        ["owner", "pm", "foreman"],
  mtr_documents:     ["owner", "qc", "foreman"],
};

// Map entity → required role(s) to READ attachments on it. Mirrors the
// SELECT permissions in supabase/functions/api/lib/permissions.ts so a
// worker can't drain billing PDFs via /files/sign-read.
const READ_RBAC: Record<string, string[]> = {
  drawings:             ["owner", "pm", "estimator", "foreman", "qc", "worker"],
  ncr_reports:          ["owner", "pm", "foreman", "qc"],
  paint_inspections:    ["owner", "pm", "qc"],
  weld_inspections:     ["owner", "pm", "qc"],
  receiving_logs:       ["owner", "pm", "foreman", "accounting"],
  shipping_tickets:     ["owner", "pm", "foreman", "accounting"],
  billing_applications: ["owner", "pm", "accounting"],
  daily_production_log: ["owner", "pm", "foreman"],
  parts:                ["owner", "pm", "estimator", "foreman", "qc", "accounting", "worker"],
  // Procurement & Material Traceability — Phase 1 (mirrors permissions.ts)
  inbound_shipments: ["owner", "pm", "foreman", "accounting"],
  receivings:        ["owner", "pm", "foreman", "accounting"],
  mtr_documents:     ["owner", "pm", "qc", "foreman"],
};

function allowedReadRoles(entityType: string): string[] {
  // Default closed — unknown entity types require owner approval.
  return READ_RBAC[entityType] ?? ["owner"];
}

export async function signUpload(ctx: Ctx): Promise<Response> {
  const body = await ctx.req.json().catch(() => ({}));
  const { entity_type, entity_id, bucket, filename, mime, size } = body;

  if (!entity_type || !entity_id || !bucket || !filename) {
    return err("entity_type, entity_id, bucket, filename required", 422, "validation");
  }
  if (!ALLOWED_BUCKETS.has(bucket)) return err("Invalid bucket", 422, "validation");
  // No file-size cap — fabrication drawing sets can be very large multi-page PDFs.
  const allowedRoles = UPLOAD_RBAC[entity_type] ?? ["owner"];
  if (!allowedRoles.includes(ctx.user.role)) return err("Forbidden", 403, "forbidden");

  const safeName = String(filename).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  const storage_path =
    `${ctx.user.company_id}/${entity_type}/${entity_id}/${crypto.randomUUID()}-${safeName}`;

  const { data, error } = await ctx.sbAdmin.storage.from(bucket).createSignedUploadUrl(storage_path);
  if (error) return err(error.message, 400, "storage_error");

  // Pre-register the attachment as pending — UI calls /files/confirm after PUT
  const { data: att, error: insErr } = await ctx.sbAdmin.from("file_attachments").insert({
    company_id: ctx.user.company_id,
    entity_type,
    entity_id,
    storage_bucket: bucket,
    storage_path,
    mime_type: mime ?? null,
    size_bytes: size ?? null,
    uploaded_by: ctx.user.id,
  }).select("id").single();
  if (insErr) return err(insErr.message, 400, "db_error");

  return ok({
    upload_url: data.signedUrl,
    token: data.token,
    storage_path,
    attachment_id: att.id,
    bucket,
  });
}

export async function signRead(ctx: Ctx, id: string): Promise<Response> {
  // Use sbAdmin to look up the attachment so we can run the role check
  // ourselves; relying on RLS would 404 first for entities the caller
  // *could* read otherwise and hide the real reason.
  const { data: att, error } = await ctx.sbAdmin.from("file_attachments")
    .select("storage_bucket, storage_path, mime_type, size_bytes, entity_type, entity_id, company_id, created_at")
    .eq("id", id).maybeSingle();
  if (error || !att) return err("File not found", 404, "not_found");
  if (att.company_id !== ctx.user.company_id) return err("File not found", 404, "not_found");

  const entityType = String(att.entity_type);
  if (!allowedReadRoles(entityType).includes(ctx.user.role)) {
    return err("Forbidden", 403, "forbidden");
  }

  const { data, error: sErr } = await ctx.sbAdmin.storage
    .from(att.storage_bucket as string)
    .createSignedUrl(att.storage_path as string, 60 * 60); // 1 hour
  if (sErr) return err(sErr.message, 400, "storage_error");

  return ok({
    url: data.signedUrl,
    mime_type: att.mime_type,
    size_bytes: att.size_bytes,
    entity_type: att.entity_type,
    entity_id: att.entity_id,
    expires_in: 3600,
  });
}

export async function listAttachments(ctx: Ctx): Promise<Response> {
  const entityType = ctx.url.searchParams.get("entity_type");
  const entityId = ctx.url.searchParams.get("entity_id");
  if (!entityType || !entityId) return err("entity_type and entity_id required", 422, "validation");

  // Entity-type level RBAC: a worker should never be able to enumerate
  // billing_applications attachments, etc.
  if (!allowedReadRoles(entityType).includes(ctx.user.role)) {
    return err("Forbidden", 403, "forbidden");
  }

  const { data, error } = await ctx.sb.from("file_attachments")
    .select("id, storage_bucket, storage_path, mime_type, size_bytes, created_at, uploaded_by")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false });
  if (error) return err(error.message, 400, "db_error");
  return ok(data ?? []);
}

// Attach an existing storage object to additional entities. Used by the
// detailing PDF importer: one shop-drawing PDF often belongs to several
// parts (e.g. 1001AB1, 1001AB2, 1001AB3 are all detailed on assembly
// 1001's drawing). Instead of re-uploading the file N times, we upload
// once and then create N sibling file_attachments rows that point to the
// same storage_path. Storage stays single-copy; the parts list shows the
// PDF on every linked part.
export async function shareAttachment(ctx: Ctx): Promise<Response> {
  const body = await ctx.req.json().catch(() => ({}));
  const { source_attachment_id, target_entity_type, target_entity_ids } = body as {
    source_attachment_id?: string;
    target_entity_type?: string;
    target_entity_ids?: string[];
  };

  if (!source_attachment_id || !target_entity_type || !Array.isArray(target_entity_ids)) {
    return err("source_attachment_id, target_entity_type, target_entity_ids required", 422, "validation");
  }

  const uploadRoles = UPLOAD_RBAC[target_entity_type] ?? ["owner"];
  if (!uploadRoles.includes(ctx.user.role)) return err("Forbidden", 403, "forbidden");

  // Source row must belong to caller's company. Look it up via sbAdmin so
  // we can return a precise 404/403 rather than rely on RLS surfacing it.
  const { data: src, error: srcErr } = await ctx.sbAdmin.from("file_attachments")
    .select("company_id, storage_bucket, storage_path, mime_type, size_bytes")
    .eq("id", source_attachment_id)
    .maybeSingle();
  if (srcErr || !src) return err("Source attachment not found", 404, "not_found");
  if (src.company_id !== ctx.user.company_id) return err("Source attachment not found", 404, "not_found");

  // Skip targets that already have an attachment pointing at this exact
  // storage_path so re-running the importer is idempotent.
  const uniqueTargets = Array.from(new Set(target_entity_ids));
  const { data: existing } = await ctx.sbAdmin.from("file_attachments")
    .select("entity_id")
    .eq("company_id", ctx.user.company_id)
    .eq("storage_path", src.storage_path as string)
    .in("entity_id", uniqueTargets);
  const dedupe = new Set((existing ?? []).map((r) => r.entity_id as string));

  const toInsert = uniqueTargets
    .filter((id) => !dedupe.has(id))
    .map((entity_id) => ({
      company_id: ctx.user.company_id,
      entity_type: target_entity_type,
      entity_id,
      storage_bucket: src.storage_bucket,
      storage_path: src.storage_path,
      mime_type: src.mime_type,
      size_bytes: src.size_bytes,
      uploaded_by: ctx.user.id,
    }));

  if (toInsert.length === 0) {
    return ok({ created: 0, skipped: uniqueTargets.length, attachment_ids: [] });
  }

  const { data: created, error: insErr } = await ctx.sbAdmin
    .from("file_attachments")
    .insert(toInsert)
    .select("id, entity_id");
  if (insErr) return err(insErr.message, 400, "db_error");

  await writeAudit(ctx, {
    action: "share",
    table_name: "file_attachments",
    record_id: source_attachment_id,
    new_values: {
      target_entity_type,
      created: created?.length ?? 0,
      skipped: uniqueTargets.length - (created?.length ?? 0),
    },
  });
  await writeActivity(ctx, {
    action: `attached drawing to ${created?.length ?? 0} ${target_entity_type}`,
    entity_type: target_entity_type,
    entity_id: source_attachment_id,
    entity_label: (src.storage_path as string).split("/").pop() ?? null,
  });

  return ok({
    created: created?.length ?? 0,
    skipped: uniqueTargets.length - (created?.length ?? 0),
    attachment_ids: (created ?? []).map((r) => r.id as string),
  });
}

export async function deleteAttachment(ctx: Ctx, id: string): Promise<Response> {
  const { data: att, error } = await ctx.sbAdmin.from("file_attachments")
    .select("storage_bucket, storage_path, entity_type, entity_id, company_id, uploaded_by")
    .eq("id", id).maybeSingle();
  if (error || !att) return err("File not found", 404, "not_found");
  if (att.company_id !== ctx.user.company_id) return err("Forbidden", 403, "forbidden");

  // Only owner/pm or the uploader can delete
  if (att.uploaded_by !== ctx.user.id && !["owner", "pm"].includes(ctx.user.role)) {
    return err("Forbidden", 403, "forbidden");
  }

  await ctx.sbAdmin.storage.from(att.storage_bucket as string).remove([att.storage_path as string]);
  const { error: dErr } = await ctx.sbAdmin.from("file_attachments").delete().eq("id", id);
  if (dErr) return err(dErr.message, 400, "db_error");

  await writeAudit(ctx, { action: "delete", table_name: "file_attachments", record_id: id });
  await writeActivity(ctx, {
    action: "deleted attachment",
    entity_type: att.entity_type as string,
    entity_id: att.entity_id as string,
    entity_label: (att.storage_path as string).split("/").pop() ?? null,
  });
  return ok({ deleted: true });
}
