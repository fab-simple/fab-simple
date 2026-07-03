// Public part viewer controller for QR code scanning.
// Allows unauthenticated mobile/tablet devices to view part details + signed drawing PDF URLs.

import { adminClient } from "../lib/supabase.ts";
import { ok, err } from "../lib/response.ts";

export async function getPublicPart(partId: string): Promise<Response> {
  const sbAdmin = adminClient();

  // 1. Fetch part
  const { data: part, error: partErr } = await sbAdmin
    .from("parts")
    .select("id, part_mark, profile, status, assembly_mark, heat_number, finish, weight, project_id")
    .eq("id", partId)
    .maybeSingle();

  if (partErr || !part) return err("Part not found", 404, "not_found");

  // 2. Fetch project
  let project_name: string | null = null;
  let project_number: string | null = null;
  if (part.project_id) {
    const { data: proj } = await sbAdmin
      .from("projects")
      .select("name, number")
      .eq("id", part.project_id)
      .maybeSingle();
    if (proj) {
      project_name = proj.name;
      project_number = proj.number;
    }
  }

  // 3. Fetch drawing attachments
  const { data: attachments } = await sbAdmin
    .from("file_attachments")
    .select("id, storage_bucket, storage_path, mime_type, size_bytes, created_at")
    .eq("entity_type", "parts")
    .eq("entity_id", part.id)
    .eq("storage_bucket", "drawings")
    .order("created_at", { ascending: false });

  // 4. Generate signed read URLs
  const drawings = await Promise.all(
    (attachments || []).map(async (att) => {
      const { data } = await sbAdmin.storage
        .from(att.storage_bucket)
        .createSignedUrl(att.storage_path, 86400);

      const filename = (att.storage_path.split("/").pop() ?? "drawing.pdf")
        .replace(/^[0-9a-f-]{36}-/i, "");

      return {
        id: att.id,
        filename,
        storage_path: att.storage_path,
        mime_type: att.mime_type,
        size_bytes: att.size_bytes,
        created_at: att.created_at,
        url: data?.signedUrl ?? null,
      };
    })
  );

  return ok({
    part: {
      ...part,
      project_name,
      project_number,
    },
    drawings,
  });
}
