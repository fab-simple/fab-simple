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
    .select("id, part_mark, profile, status, assembly_mark, heat_number, finish, weight, project_id, cut_completed_by, cut_completed_at, cut_hours, cut_drop_length, fit_completed_by, fit_completed_at, fit_hours, fit_skipped, weld_completed_by, weld_completed_at, weld_qc_by, weld_qc_at, weld_hours, weld_skipped, finish_completed_by, finish_completed_at, finish_hours, insp_completed_by, insp_completed_at")
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

  // 3. Find all related assembly / sibling part IDs for this project
  const targetPartIds = new Set<string>([part.id]);

  if (part.project_id) {
    const asmMark = part.assembly_mark || part.part_mark;
    const baseAsmMatch = asmMark ? asmMark.match(/^([A-Za-z]?\d+)/) : null;
    const baseAsm = baseAsmMatch ? baseAsmMatch[1] : asmMark;

    const { data: siblingParts } = await supabaseAdmin
      .from("parts")
      .select("id, part_mark, assembly_mark")
      .eq("project_id", part.project_id);

    for (const p of siblingParts || []) {
      if (
        p.id === part.id ||
        (asmMark && (p.part_mark === asmMark || p.assembly_mark === asmMark)) ||
        (baseAsm && (p.part_mark === baseAsm || p.assembly_mark === baseAsm))
      ) {
        targetPartIds.add(p.id);
      }
    }
  }

  // 4. Fetch file attachments for all target part IDs
  const { data: attachments } = await supabaseAdmin
    .from("file_attachments")
    .select("id, storage_bucket, storage_path, mime_type, size_bytes, created_at")
    .eq("entity_type", "parts")
    .in("entity_id", Array.from(targetPartIds))
    .eq("storage_bucket", "drawings")
    .order("created_at", { ascending: false });

  // 5. Deduplicate attachments by storage_path (keep newest)
  const uniqueAttsMap = new Map<string, NonNullable<typeof attachments>[number]>();
  for (const att of attachments || []) {
    if (!uniqueAttsMap.has(att.storage_path)) {
      uniqueAttsMap.set(att.storage_path, att);
    }
  }
  const uniqueAttachments = Array.from(uniqueAttsMap.values());

  // 6. Create signed URLs for drawing PDFs
  const drawings = await Promise.all(
    uniqueAttachments.map(async (att) => {
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
