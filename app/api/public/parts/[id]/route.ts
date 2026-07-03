import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json(
      { ok: false, error: { message: "Part ID required", code: "validation" } },
      { status: 400 }
    );
  }

  // 1. Fetch part
  const { data: part, error: partErr } = await supabaseAdmin
    .from("parts")
    .select("id, part_mark, profile, status, assembly_mark, heat_number, weight, project_id")
    .eq("id", id)
    .maybeSingle();

  if (partErr || !part) {
    return NextResponse.json(
      { ok: false, error: { message: "Part not found", code: "not_found" } },
      { status: 404 }
    );
  }

  // 2. Fetch project details
  let project_name: string | null = null;
  let project_number: string | null = null;
  if (part.project_id) {
    const { data: proj } = await supabaseAdmin
      .from("projects")
      .select("name, number")
      .eq("id", part.project_id)
      .maybeSingle();
    if (proj) {
      project_name = proj.name;
      project_number = proj.number;
    }
  }

  // 3. Fetch file attachments
  const { data: attachments } = await supabaseAdmin
    .from("file_attachments")
    .select("id, storage_bucket, storage_path, mime_type, size_bytes, created_at")
    .eq("entity_type", "parts")
    .eq("entity_id", part.id)
    .eq("storage_bucket", "drawings")
    .order("created_at", { ascending: false });

  // 4. Create signed URLs for drawing PDFs
  const drawings = await Promise.all(
    (attachments || []).map(async (att) => {
      const { data } = await supabaseAdmin.storage
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

  return NextResponse.json({
    ok: true,
    data: {
      part: {
        ...part,
        project_name,
        project_number,
      },
      drawings,
    },
  });
}
