"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Download, Send, Award, CheckCircle2, Upload } from "lucide-react";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { ResourceModal, Field } from "@/components/ui/ResourceModal";
import {
  useResource, useResourceList, useUpdate, useOrganization,
  useCreateVendorQuote, useAwardVendorQuote,
} from "@/hooks/useResource";
import { generateRfqPdf } from "@/lib/pdf";
import { parsePdfTableRows } from "@/lib/pdf-parse";
import { ACCEPT_EXT, ACCEPT_MIME, isExcelFile, parseSheetFile, autoDetectMapping, type MappableField } from "@/lib/sheet-import";

interface Rfq {
  id: string; rfq_number: string; status: string;
  delivery_requirement: string | null; notes: string | null; created_at: string;
}
interface RfqLine { id: string; rfq_id: string; material_requirement_id: string; quantity: number; }
interface MaterialRequirement { id: string; profile: string; name: string | null; grade: string | null; length: string | null; }
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

  // Total price per vendor = materials (unit price x qty, summed across
  // whatever lines they've priced) + freight — the single number that
  // actually decides an award, vs. scanning unit prices line by line.
  const totalByQuote = new Map<string, number>();
  for (const q of quotes.data ?? []) {
    let materialTotal = 0;
    for (const l of lines.data ?? []) {
      const price = priceByQuoteAndLine.get(`${q.id}:${l.id}`);
      if (price != null) materialTotal += price * l.quantity;
    }
    totalByQuote.set(q.id, materialTotal + (q.freight_cost != null ? Number(q.freight_cost) : 0));
  }
  const lowestTotal = totalByQuote.size > 0 ? Math.min(...totalByQuote.values()) : null;

  // Lowest unit price per line, so the cheaper vendor on any given line
  // stands out at a glance instead of requiring a manual scan across columns.
  const lowestPriceByLine = new Map<string, number>();
  for (const l of lines.data ?? []) {
    let min: number | null = null;
    for (const q of quotes.data ?? []) {
      const price = priceByQuoteAndLine.get(`${q.id}:${l.id}`);
      if (price != null && (min == null || price < min)) min = price;
    }
    if (min != null) lowestPriceByLine.set(l.id, min);
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
              <th className="text-left p-2">Profile Size</th>
              <th className="text-left p-2">Grade</th>
              <th className="text-left p-2">Name</th>
              <th className="text-left p-2">Length</th>
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
                  <td className="p-2">{mr?.profile ?? "—"}</td>
                  <td className="p-2">{mr?.grade ?? "—"}</td>
                  <td className="p-2">{mr?.name ?? "—"}</td>
                  <td className="p-2 font-mono">{mr?.length ?? "—"}</td>
                  <td className="text-right p-2 font-mono">{l.quantity}</td>
                  {(quotes.data ?? []).map((q) => {
                    const price = priceByQuoteAndLine.get(`${q.id}:${l.id}`);
                    const isLowest = price != null && (quotes.data ?? []).length > 1 && price === lowestPriceByLine.get(l.id);
                    return (
                      <td key={q.id} className="text-right p-2 font-mono" style={isLowest ? { color: "var(--green)", fontWeight: 600 } : undefined}>
                        {price != null ? `$${price.toFixed(2)}` : "—"}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <td className="p-2" style={{ color: "var(--muted)" }}>Lead time</td>
              <td className="p-2"></td>
              <td className="p-2"></td>
              <td className="p-2"></td>
              <td className="p-2"></td>
              {(quotes.data ?? []).map((q) => (
                <td key={q.id} className="text-right p-2 font-mono">{q.lead_time_days != null ? `${q.lead_time_days}d` : "—"}</td>
              ))}
            </tr>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <td className="p-2" style={{ color: "var(--muted)" }}>Freight</td>
              <td className="p-2"></td>
              <td className="p-2"></td>
              <td className="p-2"></td>
              <td className="p-2"></td>
              {(quotes.data ?? []).map((q) => (
                <td key={q.id} className="text-right p-2 font-mono">{q.freight_cost != null ? `$${Number(q.freight_cost).toLocaleString()}` : "—"}</td>
              ))}
            </tr>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <td className="p-2" style={{ color: "var(--muted)" }}>Valid until</td>
              <td className="p-2"></td>
              <td className="p-2"></td>
              <td className="p-2"></td>
              <td className="p-2"></td>
              {(quotes.data ?? []).map((q) => {
                const expired = q.validity_date != null && new Date(q.validity_date) < new Date();
                return (
                  <td key={q.id} className="text-right p-2 font-mono" style={expired ? { color: "#DC2626" } : undefined}>
                    {q.validity_date ? new Date(q.validity_date).toLocaleDateString() : "—"}{expired && " (expired)"}
                  </td>
                );
              })}
            </tr>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <td className="p-2" style={{ color: "var(--muted)" }}>On-time delivery</td>
              <td className="p-2"></td>
              <td className="p-2"></td>
              <td className="p-2"></td>
              <td className="p-2"></td>
              {(quotes.data ?? []).map((q) => {
                const perf = perfLookup.get(q.vendor_id);
                return (
                  <td key={q.id} className="text-right p-2 font-mono">
                    {perf?.on_time_pct != null ? `${Math.round(perf.on_time_pct)}%` : "—"}
                  </td>
                );
              })}
            </tr>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <td className="p-2" style={{ color: "var(--muted)" }}>Exceptions on file</td>
              <td className="p-2"></td>
              <td className="p-2"></td>
              <td className="p-2"></td>
              <td className="p-2"></td>
              {(quotes.data ?? []).map((q) => {
                const perf = perfLookup.get(q.vendor_id);
                return <td key={q.id} className="text-right p-2 font-mono">{perf ? perf.exception_count : "—"}</td>;
              })}
            </tr>
            <tr style={{ borderBottom: "2px solid var(--border)" }}>
              <td className="p-2 font-semibold" style={{ color: "var(--text)" }}>Total price</td>
              <td className="p-2"></td>
              <td className="p-2"></td>
              <td className="p-2"></td>
              <td className="p-2"></td>
              {(quotes.data ?? []).map((q) => {
                const total = totalByQuote.get(q.id) ?? 0;
                const isLowest = lowestTotal != null && total === lowestTotal && (quotes.data ?? []).length > 1;
                return (
                  <td key={q.id} className="text-right p-2 font-mono font-semibold" style={{ color: isLowest ? "var(--green)" : "var(--text)" }}>
                    ${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    {isLowest && (
                      <span className="pill" style={{ marginLeft: 6, fontSize: 9, background: "rgba(34,197,94,0.12)", color: "var(--green)" }}>
                        Lowest
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
            <tr>
              <td className="p-2"></td>
              <td className="p-2"></td>
              <td className="p-2"></td>
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

// Vendor price sheets typically carry profile/grade/length as the
// identifying columns and a per-unit price — the same shape RFQ lines are
// keyed by, so a mapped upload can be matched back to lines without asking
// the vendor to reference internal RFQ line IDs.
const QUOTE_PRICE_FIELDS: MappableField[] = [
  { key: "profile", label: "Profile / Section", required: true,
    aliases: ["profilesize", "profile size", "profile_size", "profile", "section", "shape", "size", "sectionsize", "section_size"] },
  { key: "grade", label: "Grade / Material",
    aliases: ["grade", "material", "material grade", "material_grade", "spec", "matl"] },
  { key: "length", label: "Length",
    aliases: ["length", "len", "cutlength", "cut_length", "length_mm", "length_in", "length_ft"] },
  { key: "unit_price", label: "Price per unit", required: true,
    aliases: ["unitprice", "unit price", "unit_price", "priceperunit", "price per unit", "price_per_unit",
      "unitcost", "unit cost", "unit_cost", "price", "cost", "rate"] },
];

const normKey = (s?: string | null) => (s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");

function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}
function fileKindLabel(file: File): string {
  if (isPdfFile(file)) return "PDF";
  return isExcelFile(file) ? "XLSX" : "CSV";
}

// Matches uploaded rows to RFQ lines by profile+grade+length; falls back to
// profile+grade when length isn't mapped/provided, but only when that's
// unambiguous (a single line shares that profile+grade).
function matchQuotePrices(
  rows: Record<string, string>[],
  mapping: Record<string, string>,
  lines: Array<RfqLine & { mr?: MaterialRequirement }>,
): { matched: Record<string, string>; matchedCount: number; unmatchedRowCount: number } {
  const byFullKey = new Map<string, string>();
  const byProfileGrade = new Map<string, string[]>();
  for (const l of lines) {
    const p = normKey(l.mr?.profile), g = normKey(l.mr?.grade), len = normKey(l.mr?.length);
    byFullKey.set(`${p}|${g}|${len}`, l.id);
    const pgKey = `${p}|${g}`;
    byProfileGrade.set(pgKey, [...(byProfileGrade.get(pgKey) ?? []), l.id]);
  }

  const matched: Record<string, string> = {};
  let unmatchedRowCount = 0;
  for (const row of rows) {
    const priceRaw = (mapping.unit_price ? row[mapping.unit_price] : "")?.replace(/[^0-9.-]/g, "") ?? "";
    if (!priceRaw || Number.isNaN(Number(priceRaw))) { unmatchedRowCount++; continue; }

    const p = normKey(mapping.profile ? row[mapping.profile] : "");
    const g = normKey(mapping.grade ? row[mapping.grade] : "");
    const len = normKey(mapping.length ? row[mapping.length] : "");
    let lineId = byFullKey.get(`${p}|${g}|${len}`);
    if (!lineId) {
      const candidates = byProfileGrade.get(`${p}|${g}`);
      if (candidates?.length === 1) lineId = candidates[0];
    }
    if (!lineId) { unmatchedRowCount++; continue; }
    matched[lineId] = String(Number(priceRaw));
  }
  return { matched, matchedCount: Object.keys(matched).length, unmatchedRowCount };
}

// Field (ResourceModal.tsx) wraps its children in a bare <label>, which
// works for a single control (clicking the caption focuses it) but is wrong
// here: this field holds many controls, including — once upload mode is on
// — a hidden file input. A <label> with no `for` implicitly binds to the
// first labelable descendant, so any click inside it would get forwarded to
// that file input and pop the OS file picker. Plain <div>, same look.
function FieldBlock({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] uppercase font-semibold tracking-wider" style={{ color: "var(--muted)" }}>
        {label}{required && <span style={{ color: "#DC2626" }}> *</span>}
      </span>
      {children}
    </div>
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
  const [uploadOpen, setUploadOpen] = useState(false);

  const allPriced = lines.length > 0 && lines.every((l) => prices[l.id] && Number(prices[l.id]) >= 0);
  const totalPrice = lines.reduce((sum, l) => sum + (Number(prices[l.id]) || 0) * l.quantity, 0);

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
      <FieldBlock label="Unit price per line" required>
        {uploadOpen ? (
          <UploadPricesPanel
            lines={lines}
            onApply={(matched) => { setPrices((prev) => ({ ...prev, ...matched })); setUploadOpen(false); }}
            onCancel={() => setUploadOpen(false)}
          />
        ) : (
          <>
            <div className="flex justify-end mb-1.5">
              <button type="button" className="btn btn-sm" onClick={() => setUploadOpen(true)}>
                <Upload size={12} /> Upload price sheet
              </button>
            </div>
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
              <div className="flex items-center gap-2 px-3 py-2 text-[12px] font-semibold" style={{ background: "var(--bg-muted)" }}>
                <span style={{ flex: 1 }}>Total</span>
                <span className="font-mono" style={{ width: 110, textAlign: "right" }}>
                  ${totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </>
        )}
      </FieldBlock>
      <div className="grid-3" style={{ gap: 12 }}>
        <Field label="Lead time (days)"><input className="input" type="number" min="0" value={leadTime} onChange={(e) => setLeadTime(e.target.value)} /></Field>
        <Field label="Freight cost ($)"><input className="input" type="number" min="0" step="0.01" value={freight} onChange={(e) => setFreight(e.target.value)} /></Field>
        <Field label="Valid until"><input className="input" type="date" value={validity} onChange={(e) => setValidity(e.target.value)} /></Field>
      </div>
      <Field label="Notes"><textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} style={{ height: "auto", padding: "8px 12px", resize: "vertical" }} /></Field>
    </ResourceModal>
  );
}

// Upload -> map columns -> match against RFQ lines -> apply. Applying only
// fills `prices` on the parent form (it doesn't submit anything itself), so
// the vendor/PM can still review or hand-correct any line before saving.
function UploadPricesPanel({ lines, onApply, onCancel }: {
  lines: Array<RfqLine & { mr?: MaterialRequirement }>;
  onApply: (matched: Record<string, string>) => void;
  onCancel: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});

  async function handleFileChange(f: File | null) {
    setFile(f);
    setParseError(null);
    setHeaders([]);
    setParsedRows([]);
    setMapping({});
    if (!f) return;

    setParsing(true);
    try {
      // PDF and spreadsheet uploads go through entirely separate extractors
      // (positional-text reconstruction vs. real cells) — only their output
      // shape (header-keyed rows) is shared, which is what the mapping /
      // matching UI below actually operates on.
      const rows = isPdfFile(f) ? await parsePdfTableRows(f) : await parseSheetFile(f);
      if (rows.length === 0) {
        throw new Error(isPdfFile(f)
          ? "Couldn't find a table in this PDF. It needs a row of column headers (e.g. Profile, Grade, Price) followed by data rows."
          : "No rows found in file. Check that the first row contains column headers.");
      }
      const hdrs = Object.keys(rows[0]);
      setParsedRows(rows);
      setHeaders(hdrs);
      setMapping(autoDetectMapping(hdrs, QUOTE_PRICE_FIELDS));
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Failed to read file");
    } finally {
      setParsing(false);
    }
  }

  const { matched, matchedCount, unmatchedRowCount } = useMemo(
    () => matchQuotePrices(parsedRows, mapping, lines),
    [parsedRows, mapping, lines],
  );
  const canApply = !!mapping.profile && !!mapping.unit_price && matchedCount > 0;

  return (
    <div className="rounded-lg border p-3" style={{ borderColor: "var(--border)", background: "var(--bg-muted)" }}>
      <div style={{ border: "2px dashed var(--border)", borderRadius: 8, padding: 16, textAlign: "center" }}>
        <input
          id="quote-price-sheet-input" type="file" accept={`.pdf,application/pdf,${ACCEPT_EXT},${ACCEPT_MIME}`}
          onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
          style={{ display: "none" }}
        />
        <label htmlFor="quote-price-sheet-input" className="btn btn-sm btn-primary" style={{ cursor: "pointer" }}>
          <Upload size={12} /> Choose file
        </label>
        <div className="text-[11px] mt-1.5" style={{ color: "var(--muted)" }}>
          Vendor quote as a <code>.pdf</code> letter, or a <code>.csv</code> / <code>.xlsx</code> price sheet
        </div>
        {file && (
          <div className="text-[11px] mt-1.5" style={{ color: "var(--text)" }}>
            Selected: <strong>{file.name}</strong>
            <span className="pill" style={{ marginLeft: 6, fontSize: 10 }}>{fileKindLabel(file)}</span>
          </div>
        )}
        {parsing && (
          <div className="text-[11px] mt-1.5" style={{ color: "var(--muted)" }}>
            <Loader2 size={11} className="animate-spin inline" /> Reading columns…
          </div>
        )}
        {parseError && <div className="text-[11px] mt-1.5" style={{ color: "#DC2626" }}>{parseError}</div>}
      </div>

      {headers.length > 0 && (
        <>
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] uppercase font-semibold tracking-wider" style={{ color: "var(--muted)" }}>
                Column mapping — {parsedRows.length} row{parsedRows.length === 1 ? "" : "s"} detected
              </span>
              <button type="button" className="btn btn-sm" onClick={() => setMapping(autoDetectMapping(headers, QUOTE_PRICE_FIELDS))}>
                Reset to auto-detected
              </button>
            </div>
            <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", background: "var(--bg-card)" }}>
              {QUOTE_PRICE_FIELDS.map((field, idx) => {
                const chosen = mapping[field.key] ?? "";
                const sample = chosen ? parsedRows[0]?.[chosen] : "";
                return (
                  <div key={field.key} className="flex items-center gap-3 px-3 py-2 text-[12px]"
                    style={{ borderTop: idx > 0 ? "1px solid var(--border)" : undefined }}>
                    <span style={{ width: 140 }}>
                      {field.label}{field.required && <span style={{ color: "#DC2626" }}> *</span>}
                    </span>
                    <select
                      className="input" style={{ height: 28, fontSize: 12, flex: 1 }}
                      value={chosen}
                      onChange={(e) => setMapping((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    >
                      <option value="">— not mapped —</option>
                      {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                    <span className="font-mono text-[11px]" style={{ width: 110, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {sample || "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-2 text-[11px]" style={{ color: "var(--muted)" }}>
            Matched <strong style={{ color: "var(--text)" }}>{matchedCount}</strong> of {lines.length} RFQ line{lines.length === 1 ? "" : "s"} by profile / grade / length
            {unmatchedRowCount > 0 && <span> · {unmatchedRowCount} file row{unmatchedRowCount === 1 ? "" : "s"} didn&apos;t match a line</span>}
          </div>
        </>
      )}

      <div className="flex justify-end gap-2 mt-3">
        <button type="button" className="btn btn-sm" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn btn-sm btn-primary" disabled={!canApply} onClick={() => onApply(matched)}>
          Apply {matchedCount || ""} price{matchedCount === 1 ? "" : "s"}
        </button>
      </div>
    </div>
  );
}
