"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Download, Send, Award, CheckCircle2 } from "lucide-react";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { ResourceModal, Field } from "@/components/ui/ResourceModal";
import {
  useResource, useResourceList, useUpdate, useOrganization,
  useCreateVendorQuote, useAwardVendorQuote,
} from "@/hooks/useResource";
import { generateRfqPdf } from "@/lib/pdf";

interface Rfq {
  id: string; rfq_number: string; status: string;
  delivery_requirement: string | null; notes: string | null; created_at: string;
}
interface RfqLine { id: string; rfq_id: string; material_requirement_id: string; quantity: number; }
interface MaterialRequirement { id: string; profile: string; grade: string | null; length: string | null; }
interface RfqVendorRow { id: string; rfq_id: string; vendor_id: string; }
interface Vendor { id: string; name: string; }
interface VendorPerformance { vendor_id: string; on_time_pct: number | null; exception_count: number; }
interface VendorQuote {
  id: string; rfq_id: string; vendor_id: string; status: string;
  lead_time_days: number | null; freight_cost: number | null; validity_date: string | null;
}
interface VendorQuoteLine { id: string; vendor_quote_id: string; rfq_line_id: string; unit_price: number; }
interface PO { id: string; po_number: string; rfq_id: string | null; }

export default function RfqDetailPage() {
  const params = useParams();
  const id = (params?.id as string) ?? "";

  const rfqQ = useResource<Rfq>("rfqs", id);
  const lines = useResourceList<RfqLine>("rfq_lines", { rfq_id: id, limit: "200" });
  const mrs = useResourceList<MaterialRequirement>("material_requirements", { limit: "500" });
  const rfqVendors = useResourceList<RfqVendorRow>("rfq_vendors", { rfq_id: id, limit: "200" });
  const vendors = useResourceList<Vendor>("vendors", { limit: "200" });
  const vendorPerf = useResourceList<VendorPerformance>("vendor_performance", { limit: "500" });
  const quotes = useResourceList<VendorQuote>("vendor_quotes", { rfq_id: id, limit: "200" });
  const quoteIds = (quotes.data ?? []).map((q) => q.id);
  const quoteLines = useResourceList<VendorQuoteLine>(
    "vendor_quote_lines",
    quoteIds.length > 0 ? { vendor_quote_id__in: quoteIds.join(","), limit: "1000" } : { limit: "1" },
    { enabled: quoteIds.length > 0 },
  );
  const awardedPo = useResourceList<PO>("purchase_orders", { rfq_id: id, limit: "1" });
  const org = useOrganization();

  const updateRfq = useUpdate<Rfq>("rfqs");
  const awardQuote = useAwardVendorQuote();
  const [quoteTarget, setQuoteTarget] = useState<Vendor | null>(null);
  const [awardingId, setAwardingId] = useState<string | null>(null);

  const rfq = rfqQ.data;
  const mrLookup = new Map((mrs.data ?? []).map((m) => [m.id, m]));
  const vendorLookup = new Map((vendors.data ?? []).map((v) => [v.id, v]));
  const perfLookup = new Map((vendorPerf.data ?? []).map((p) => [p.vendor_id, p]));
  const quoteByVendor = new Map((quotes.data ?? []).map((q) => [q.vendor_id, q]));
  const priceByQuoteAndLine = new Map<string, number>();
  for (const ql of quoteLines.data ?? []) {
    priceByQuoteAndLine.set(`${ql.vendor_quote_id}:${ql.rfq_line_id}`, Number(ql.unit_price));
  }

  if (rfqQ.isLoading || !rfq) {
    return (
      <PageWrapper title="RFQ">
        <div className="flex items-center gap-2 text-[12px]" style={{ color: "var(--muted)" }}>
          <Loader2 size={14} className="animate-spin" /> Loading…
        </div>
      </PageWrapper>
    );
  }

  function downloadPdf() {
    if (!rfq) return;
    const doc = generateRfqPdf({
      rfq_number: rfq.rfq_number,
      delivery_requirement: rfq.delivery_requirement,
      notes: rfq.notes,
      created_at: rfq.created_at,
      contractor_name: org.data?.name ?? "",
      lines: (lines.data ?? []).map((l) => {
        const mr = mrLookup.get(l.material_requirement_id);
        return { profile: mr?.profile ?? "—", grade: mr?.grade ?? null, quantity: l.quantity, length: mr?.length ?? null };
      }),
    });
    doc.save(`RFQ-${rfq.rfq_number}.pdf`);
  }

  const po = (awardedPo.data ?? [])[0];

  return (
    <PageWrapper title={`RFQ ${rfq.rfq_number}`}>
      <Link href="/dashboard/rfqs" className="flex items-center gap-1 text-[12px] mb-4" style={{ color: "var(--muted)" }}>
        <ArrowLeft size={12} /> Back to RFQs
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="text-[20px] font-bold font-mono" style={{ color: "var(--text)" }}>{rfq.rfq_number}</div>
            <StatusPill status={rfq.status} />
          </div>
          <div className="text-[12px]" style={{ color: "var(--muted)" }}>
            {rfq.delivery_requirement ?? "No delivery requirement specified"}
            {" · created "}{new Date(rfq.created_at).toLocaleDateString()}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {rfq.status === "draft" && (
            <button className="btn btn-sm" onClick={() => updateRfq.mutate({ id: rfq.id, body: { status: "sent" } })} disabled={updateRfq.isPending}>
              <Send size={12} /> Mark as sent
            </button>
          )}
          <button className="btn btn-sm" onClick={downloadPdf}><Download size={12} /> Download PDF</button>
        </div>
      </div>

      {po && (
        <div className="mb-4 p-3 rounded-lg border flex items-center gap-2"
          style={{ background: "rgba(34,197,94,0.08)", borderColor: "rgba(34,197,94,0.3)" }}>
          <CheckCircle2 size={14} style={{ color: "var(--green)" }} />
          <span className="text-[12px]" style={{ color: "var(--text)" }}>
            Awarded — draft <strong className="font-mono">{po.po_number}</strong> created.
          </span>
          <Link href="/dashboard/purchase-orders" className="text-[12px] ml-auto" style={{ color: "var(--primary)" }}>
            View purchase orders →
          </Link>
        </div>
      )}

      {/* Vendors invited */}
      <div className="text-[13px] font-semibold mb-2" style={{ color: "var(--text)" }}>Vendors</div>
      <div className="grid-3 mb-6" style={{ gap: 10 }}>
        {(rfqVendors.data ?? []).map((rv) => {
          const vendor = vendorLookup.get(rv.vendor_id);
          const quote = quoteByVendor.get(rv.vendor_id);
          const perf = perfLookup.get(rv.vendor_id);
          return (
            <div key={rv.id} className="info-cell">
              <div className="flex items-center justify-between">
                <strong className="text-[13px]">{vendor?.name ?? rv.vendor_id.slice(0, 8)}</strong>
                {quote ? <StatusPill status={quote.status} /> : <span className="pill pill-warn" style={{ padding: "2px 8px" }}>No quote yet</span>}
              </div>
              {perf && (
                <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                  {perf.on_time_pct != null ? `${Math.round(perf.on_time_pct)}% on-time` : "No history"} · {perf.exception_count} exceptions
                </div>
              )}
              {!quote && rfq.status !== "awarded" && (
                <button className="btn btn-sm mt-2" onClick={() => setQuoteTarget(vendor ?? { id: rv.vendor_id, name: rv.vendor_id.slice(0, 8) })}>
                  Enter quote
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Comparison table */}
      <div className="text-[13px] font-semibold mb-2" style={{ color: "var(--text)" }}>Quote comparison</div>
      <div style={{ overflowX: "auto" }}>
        <table className="w-full text-[12px]" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th className="text-left p-2">Material</th>
              <th className="text-right p-2" style={{ width: 70 }}>Qty</th>
              {(quotes.data ?? []).map((q) => (
                <th key={q.id} className="text-right p-2 font-mono">{vendorLookup.get(q.vendor_id)?.name ?? q.vendor_id.slice(0, 8)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(lines.data ?? []).map((l) => {
              const mr = mrLookup.get(l.material_requirement_id);
              return (
                <tr key={l.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="p-2">{mr?.profile ?? "—"} {mr?.grade ?? ""}</td>
                  <td className="text-right p-2 font-mono">{l.quantity}</td>
                  {(quotes.data ?? []).map((q) => {
                    const price = priceByQuoteAndLine.get(`${q.id}:${l.id}`);
                    return <td key={q.id} className="text-right p-2 font-mono">{price != null ? `$${price.toFixed(2)}` : "—"}</td>;
                  })}
                </tr>
              );
            })}
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <td className="p-2" style={{ color: "var(--muted)" }}>Lead time</td>
              <td className="p-2"></td>
              {(quotes.data ?? []).map((q) => (
                <td key={q.id} className="text-right p-2 font-mono">{q.lead_time_days != null ? `${q.lead_time_days}d` : "—"}</td>
              ))}
            </tr>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <td className="p-2" style={{ color: "var(--muted)" }}>Freight</td>
              <td className="p-2"></td>
              {(quotes.data ?? []).map((q) => (
                <td key={q.id} className="text-right p-2 font-mono">{q.freight_cost != null ? `$${Number(q.freight_cost).toLocaleString()}` : "—"}</td>
              ))}
            </tr>
            <tr>
              <td className="p-2"></td>
              <td className="p-2"></td>
              {(quotes.data ?? []).map((q) => (
                <td key={q.id} className="text-right p-2">
                  {rfq.status !== "awarded" && ["pending", "submitted"].includes(q.status) && (
                    <button
                      className="btn btn-sm btn-primary"
                      disabled={awardQuote.isPending && awardingId === q.id}
                      onClick={() => { setAwardingId(q.id); awardQuote.mutate(q.id, { onSettled: () => setAwardingId(null) }); }}
                    >
                      {awardQuote.isPending && awardingId === q.id ? <Loader2 size={12} className="animate-spin" /> : <Award size={12} />}
                      Award
                    </button>
                  )}
                  {q.status === "awarded" && <StatusPill status="awarded" />}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        {(quotes.data ?? []).length === 0 && (
          <div className="text-[12px] p-6 text-center" style={{ color: "var(--muted)" }}>No quotes entered yet.</div>
        )}
      </div>

      {quoteTarget && (
        <EnterQuoteModal
          rfqId={rfq.id}
          vendor={quoteTarget}
          lines={(lines.data ?? []).map((l) => ({ ...l, mr: mrLookup.get(l.material_requirement_id) }))}
          onClose={() => setQuoteTarget(null)}
        />
      )}
    </PageWrapper>
  );
}

function EnterQuoteModal({ rfqId, vendor, lines, onClose }: {
  rfqId: string;
  vendor: { id: string; name: string };
  lines: Array<RfqLine & { mr?: MaterialRequirement }>;
  onClose: () => void;
}) {
  const createQuote = useCreateVendorQuote();
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [leadTime, setLeadTime] = useState("");
  const [freight, setFreight] = useState("");
  const [validity, setValidity] = useState("");
  const [notes, setNotes] = useState("");

  const allPriced = lines.length > 0 && lines.every((l) => prices[l.id] && Number(prices[l.id]) >= 0);

  return (
    <ResourceModal
      title={`Enter quote — ${vendor.name}`}
      onClose={onClose}
      submitting={createQuote.isPending}
      error={createQuote.error?.message ?? null}
      submitDisabled={!allPriced}
      submitLabel="Save quote"
      width={560}
      onSubmit={(e) => {
        e.preventDefault();
        if (!allPriced) return;
        createQuote.mutate({
          rfq_id: rfqId,
          vendor_id: vendor.id,
          lead_time_days: leadTime ? Number(leadTime) : undefined,
          freight_cost: freight ? Number(freight) : undefined,
          validity_date: validity || undefined,
          notes: notes || undefined,
          lines: lines.map((l) => ({ rfq_line_id: l.id, unit_price: Number(prices[l.id]) })),
        }, { onSuccess: onClose });
      }}
    >
      <Field label="Unit price per line" required>
        <div className="rounded-lg border" style={{ borderColor: "var(--border)" }}>
          {lines.map((l) => (
            <div key={l.id} className="flex items-center gap-2 px-3 py-2 text-[12px]" style={{ borderBottom: "1px solid var(--border)" }}>
              <span style={{ flex: 1 }}>{l.mr?.profile ?? "—"} {l.mr?.grade ?? ""} · qty {l.quantity}</span>
              <input
                className="input" type="number" min="0" step="0.01" required
                style={{ width: 110, height: 28, fontSize: 12 }}
                placeholder="$/unit"
                value={prices[l.id] ?? ""}
                onChange={(e) => setPrices((prev) => ({ ...prev, [l.id]: e.target.value }))}
              />
            </div>
          ))}
        </div>
      </Field>
      <div className="grid-3" style={{ gap: 12 }}>
        <Field label="Lead time (days)"><input className="input" type="number" min="0" value={leadTime} onChange={(e) => setLeadTime(e.target.value)} /></Field>
        <Field label="Freight cost ($)"><input className="input" type="number" min="0" step="0.01" value={freight} onChange={(e) => setFreight(e.target.value)} /></Field>
        <Field label="Valid until"><input className="input" type="date" value={validity} onChange={(e) => setValidity(e.target.value)} /></Field>
      </div>
      <Field label="Notes"><textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} style={{ height: "auto", padding: "8px 12px", resize: "vertical" }} /></Field>
    </ResourceModal>
  );
}
