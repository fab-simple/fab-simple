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
const MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB hard cap

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
  if (typeof size === "number" && size > MAX_SIZE_BYTES) {
    return err(`File exceeds ${MAX_SIZE_BYTES / 1024 / 1024} MB`, 413, "file_too_large");
  }
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
