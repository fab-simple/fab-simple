// AI Copilot — server-side chat completion with project-aware system prompt.
// Calls OpenAI-compatible endpoint. If OPENAI_API_KEY is unset, returns a
// deterministic local response so the UI is functional in dev.

import type { Ctx } from "../lib/types.ts";
import { ok, err } from "../lib/response.ts";

interface ChatMessage { role: "user" | "assistant" | "system"; content: string; }

const SYSTEM_PROMPT = `You are FabSimple Copilot, an AI assistant embedded in a steel-fabrication management system.
You help foremen, PMs, estimators, and QC inspectors. Be concise, technical, and reference AISC 303, AWS D1.1,
and OSHA where relevant. When asked about specific data (NCRs, parts, projects), keep responses grounded in the
context block below and never invent numbers. If you don't have data, say so plainly.`;

async function buildContext(ctx: Ctx, projectId?: string): Promise<string> {
  const parts: string[] = [];
  // KPI snapshot
  const { count: totalParts } = await ctx.sb.from("parts").select("id", { count: "exact", head: true });
  const { count: openNcrs } = await ctx.sb.from("ncr_reports").select("id", { count: "exact", head: true }).eq("status", "open");
  parts.push(`Company totals: ${totalParts ?? 0} parts, ${openNcrs ?? 0} open NCRs.`);

  if (projectId) {
    const { data: proj } = await ctx.sb.from("projects").select("name, number, status, contract_value, est_tonnage, deadline").eq("id", projectId).maybeSingle();
    if (proj) {
      parts.push(`Active project: ${proj.name} (${proj.number}), ${proj.status}, contract $${proj.contract_value ?? 0}, ${proj.est_tonnage ?? 0} tons, deadline ${proj.deadline ?? "n/a"}.`);
    }
    const { data: ncrs } = await ctx.sb.from("ncr_reports").select("ncr_number, description").eq("project_id", projectId).eq("status", "open").limit(5);
    if (ncrs?.length) parts.push(`Open NCRs on project: ${ncrs.map((n) => n.ncr_number + " — " + n.description).join("; ")}`);
  }
  return parts.join("\n");
}

// SECURITY: workers cannot reach the Copilot. The system prompt pulls
// project contract values and NCR descriptions which they shouldn't see,
// and in production the same data is shipped to a third-party LLM.
const COPILOT_ROLES = new Set(["owner", "pm", "estimator", "foreman", "qc", "accounting"]);

export async function copilot(ctx: Ctx): Promise<Response> {
  if (!COPILOT_ROLES.has(ctx.user.role)) {
    return err("Forbidden", 403, "forbidden");
  }

  const body = await ctx.req.json().catch(() => ({}));
  const { messages, project_id } = body as { messages: ChatMessage[]; project_id?: string };
  if (!Array.isArray(messages) || messages.length === 0) {
    return err("messages required", 422, "validation");
  }

  const context = await buildContext(ctx, project_id);
  const apiKey = Deno.env.get("OPENAI_API_KEY");

  // Persist chat row for audit
  const last = messages[messages.length - 1];

  let reply: string;
  let tokensUsed: number | undefined;

  if (!apiKey) {
    reply = `[Demo mode — set OPENAI_API_KEY to enable real responses]\n\nYou asked: "${last.content}"\n\nContext snapshot:\n${context}`;
  } else {
    try {
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini",
          messages: [
            { role: "system", content: SYSTEM_PROMPT + "\n\nCONTEXT:\n" + context },
            ...messages,
          ],
          temperature: 0.3,
          max_tokens: 700,
        }),
      });
      const json = await resp.json();
      if (!resp.ok) return err(json.error?.message ?? "LLM error", 502, "llm_error");
      reply = json.choices?.[0]?.message?.content ?? "(no reply)";
      tokensUsed = json.usage?.total_tokens;
    } catch (e) {
      return err(e instanceof Error ? e.message : "LLM call failed", 502, "llm_error");
    }
  }

  // Persist to ai_chat_history
  await ctx.sbAdmin.from("ai_chat_history").insert({
    company_id: ctx.user.company_id,
    user_id: ctx.user.id,
    project_id: project_id ?? null,
    question: last.content,
    response: reply,
    tokens_used: tokensUsed ?? null,
  });

  return ok({ reply, tokens_used: tokensUsed });
}
