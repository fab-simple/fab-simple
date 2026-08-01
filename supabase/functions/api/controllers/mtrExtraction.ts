// MTR OCR extraction — Phase 1 (spec §6.8, decision D5). Reuses the
// OpenAI-compatible model already configured for the AI Copilot
// (OPENAI_API_KEY / OPENAI_MODEL, see controllers/copilot.ts) rather than
// adding a new OCR vendor dependency.
//
// Extraction is ADVISORY ONLY. This endpoint only ever writes
// ocr_status='extracted' — never 'verified'. Only a QC/owner PATCH to
// mtr_documents (ocr_status='verified', via the generic CRUD route, gated by
// permissions.ts + the mtr_docs_update RLS policy) lifts heat quarantine
// (fn_sync_heat_quarantine trigger). A bad OCR read can never release
// material into fabrication on its own.

import type { Ctx } from "../lib/types.ts";
import { ok, err } from "../lib/response.ts";
import { writeAudit, writeActivity } from "../services/audit.ts";

// Matches mtr_documents.insertable — foreman can attach a scan and trigger
// extraction, but (per RLS) cannot flip ocr_status to 'verified' themselves.
const ALLOWED_ROLES = ["owner", "qc", "foreman"];

interface ExtractedMtr {
  heat_number: string | null;
  yield_strength: number | null;
  tensile_strength: number | null;
  chemistry: Record<string, number> | null;
  mill_name: string | null;
}

function isExtractedMtr(v: unknown): v is ExtractedMtr {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  const numOrNull = (x: unknown) => x === null || typeof x === "number";
  const strOrNull = (x: unknown) => x === null || typeof x === "string";
  return (
    strOrNull(o.heat_number) &&
    numOrNull(o.yield_strength) &&
    numOrNull(o.tensile_strength) &&
    strOrNull(o.mill_name) &&
    (o.chemistry === null || (typeof o.chemistry === "object" && !Array.isArray(o.chemistry)))
  );
}

const EXTRACTION_PROMPT = `You are extracting structured data from a Mill Test Report (MTR) for structural steel.
Read the attached document image and respond with ONLY a single JSON object (no markdown fences, no commentary) of this exact shape:
{
  "heat_number": string | null,
  "yield_strength": number | null,
  "tensile_strength": number | null,
  "chemistry": { "C": number, "Mn": number, "P": number, "S": number, "Si": number } | null,
  "mill_name": string | null
}
Yield/tensile are in ksi. Chemistry values are weight percentages. Use null for any field you cannot read confidently — never guess.`;

/** POST /mtr-documents/:id/extract */
export async function extractMtrDocument(ctx: Ctx, id: string): Promise<Response> {
  if (!ALLOWED_ROLES.includes(ctx.user.role)) return err("Forbidden", 403, "forbidden");

  // RLS-scoped read: mtr_docs_select has no role restriction beyond
  // company_id, so this confirms the doc belongs to the caller's company.
  const { data: doc, error: docErr } = await ctx.sb
    .from("mtr_documents")
    .select("id, heat_number_id, file_attachment_id")
    .eq("id", id)
    .maybeSingle();
  if (docErr) return err(docErr.message, 400, "db_error");
  if (!doc) return err("MTR document not found", 404, "not_found");
  if (!doc.file_attachment_id) return err("No file attached to this MTR document yet", 422, "no_file");

  const { data: att, error: attErr } = await ctx.sbAdmin
    .from("file_attachments")
    .select("storage_bucket, storage_path")
    .eq("id", doc.file_attachment_id)
    .maybeSingle();
  if (attErr || !att) return err("Attached file not found", 404, "not_found");

  const { data: signed, error: signErr } = await ctx.sbAdmin.storage
    .from(att.storage_bucket as string)
    .createSignedUrl(att.storage_path as string, 300); // 5 min — only needed for this one call
  if (signErr) return err(signErr.message, 400, "storage_error");

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return err("MTR extraction is unavailable — OPENAI_API_KEY is not configured", 503, "extraction_unavailable");
  }
  const model = Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini";

  let completion: { choices?: Array<{ message?: { content?: string } }>; error?: { message?: string } };
  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: EXTRACTION_PROMPT },
              { type: "image_url", image_url: { url: signed.signedUrl } },
            ],
          },
        ],
        temperature: 0,
        max_tokens: 800,
      }),
    });
    completion = await resp.json();
    if (!resp.ok) return err(completion.error?.message ?? "LLM error", 502, "llm_error");
  } catch (e) {
    return err(e instanceof Error ? e.message : "LLM call failed", 502, "llm_error");
  }

  const content = completion.choices?.[0]?.message?.content ?? "";
  let parsed: unknown;
  try {
    const cleaned = content.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    parsed = JSON.parse(cleaned);
  } catch {
    return err("Model response was not valid JSON — left as pending for manual entry", 502, "extraction_parse_failed");
  }
  if (!isExtractedMtr(parsed)) {
    return err("Model response did not match the expected MTR shape", 502, "extraction_shape_invalid");
  }

  // Written via sbAdmin: the mtr_docs_update RLS policy restricts UPDATEs to
  // owner/qc, but extraction (ocr_status='extracted', never 'verified') is
  // explicitly allowed for foreman too — this endpoint's own role check
  // above is the authority here, not the generic-CRUD RLS policy meant for
  // the human "verify" action.
  const { data: updated, error: updErr } = await ctx.sbAdmin
    .from("mtr_documents")
    .update({
      yield_strength: parsed.yield_strength,
      tensile_strength: parsed.tensile_strength,
      chemistry: parsed.chemistry,
      mill_name: parsed.mill_name,
      ocr_status: "extracted",
      extracted_by: `ocr:${model}`,
    })
    .eq("id", id)
    .select()
    .single();
  if (updErr) return err(updErr.message, 400, "db_error");

  await writeAudit(ctx, { action: "update", table_name: "mtr_documents", record_id: id, new_values: updated });
  await writeActivity(ctx, {
    action: "extracted MTR data via OCR — pending QC verification",
    entity_type: "mtr_documents",
    entity_id: id,
    entity_label: parsed.heat_number,
  });

  return ok({ mtr_document: updated, extracted: parsed });
}
