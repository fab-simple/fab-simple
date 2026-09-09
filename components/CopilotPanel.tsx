"use client";

import { useState, useRef, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/hooks/useAppRedux";
import { closeCopilot, toggleCopilot } from "@/store/uiSlice";
import { FabAPI } from "@/lib/api";
import { Sparkles, X, Send, Loader2 } from "lucide-react";

interface Msg { role: "user" | "assistant"; content: string; }

const SUGGESTIONS = [
  "Show me parts that are blocking shipping this week",
  "Summarize open NCRs and their root causes",
  "Which projects are at risk of missing their deadline?",
  "What's the AWS weld inspection rate this month?",
];

export function CopilotPanel() {
  const dispatch = useAppDispatch();
  const open = useAppSelector((s) => s.ui.copilotOpen);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send(content: string) {
    if (!content.trim() || busy) return;
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setBusy(true);
    setError(null);
    try {
      const res = await FabAPI.copilot({ messages: next });
      setMessages([...next, { role: "assistant", content: res.reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Copilot error");
    } finally { setBusy(false); }
  }

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40"
      />
      <aside
        className="fixed right-0 top-0 bottom-0 z-50 flex flex-col"
        style={{
          width: 420, maxWidth: "92vw",
          background: "var(--bg-card)",
          borderLeft: "1px solid var(--border)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #4F46E5, #7C3AED)" }}>
              <Sparkles size={16} color="white" />
            </div>
            <div>
              <div className="font-bold text-[14px]" style={{ color: "var(--text)" }}>FabSimple Copilot</div>
              <div className="text-[10px]" style={{ color: "var(--muted)" }}>AISC · AWS · OSHA aware</div>
            </div>
          </div>
          <button onClick={() => dispatch(closeCopilot())} className="p-1.5 rounded-md" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--muted)" }}>
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4" style={{ background: "var(--bg)" }}>
          {messages.length === 0 ? (
            <div>
              <div className="text-[13px] font-semibold mb-3" style={{ color: "var(--text)" }}>Try asking…</div>
              <div className="flex flex-col gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-left p-3 rounded-md text-[12px]"
                    style={{
                      background: "var(--bg-card)",
                      border: "1px solid var(--border)",
                      color: "var(--text)",
                      cursor: "pointer",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {messages.map((m, i) => (
                <div key={i} className={`p-3 rounded-lg text-[13px] leading-relaxed`}
                  style={{
                    alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                    background: m.role === "user" ? "var(--primary)" : "var(--bg-card)",
                    color: m.role === "user" ? "white" : "var(--text)",
                    border: m.role === "user" ? "none" : "1px solid var(--border)",
                    maxWidth: "85%",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {m.content}
                </div>
              ))}
              {busy && (
                <div className="p-3 rounded-lg text-[13px]" style={{ alignSelf: "flex-start", background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--muted)" }}>
                  <Loader2 size={14} className="animate-spin inline" /> Thinking…
                </div>
              )}
              <div ref={endRef} />
            </div>
          )}
          {error && <div className="pill pill-red mt-3" style={{ padding: "8px 12px", fontSize: 12 }}>{error}</div>}
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="flex items-center gap-2 p-3"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <input
            className="input"
            placeholder="Ask anything about your shop…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={busy}
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn btn-primary" disabled={busy || !input.trim()} style={{ padding: "0 12px", height: 40 }}>
            <Send size={14} />
          </button>
        </form>
      </aside>
    </>
  );
}

export function CopilotLauncher() {
  const dispatch = useAppDispatch();
  return (
    <button
      onClick={() => dispatch(toggleCopilot())}
      title="Open Copilot"
      style={{
        position: "fixed", bottom: 20, right: 20, zIndex: 30,
        width: 52, height: 52, borderRadius: 26,
        background: "linear-gradient(135deg, #4F46E5, #7C3AED)",
        color: "white", border: "none", cursor: "pointer",
        boxShadow: "0 10px 25px rgba(79,70,229,0.35)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      <Sparkles size={22} />
    </button>
  );
}
