"use client";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { BILLING_APPLICATIONS } from "@/lib/mock-data";
import { formatCurrency } from "@/lib/utils";

export default function BillingPage() {
  const totalBilled = BILLING_APPLICATIONS.reduce((s, b) => s + b.amount_claimed, 0);
  const totalCertified = BILLING_APPLICATIONS.reduce((s, b) => s + (b.amount_certified || 0), 0);
  const totalRetainage = BILLING_APPLICATIONS.reduce((s, b) => s + b.retainage_withheld, 0);

  return (
    <PageWrapper title="AIA G702 Billing — Schedule of Values">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <div className="stat-card primary"><div className="stat-label">Total Claimed</div><div className="stat-value" style={{ fontSize: 18 }}>{formatCurrency(totalBilled)}</div></div>
        <div className="stat-card green"><div className="stat-label">Certified</div><div className="stat-value" style={{ fontSize: 18 }}>{formatCurrency(totalCertified)}</div></div>
        <div className="stat-card amber"><div className="stat-label">Retainage Held</div><div className="stat-value" style={{ fontSize: 18 }}>{formatCurrency(totalRetainage)}</div></div>
        <div className="stat-card blue"><div className="stat-label">Net Payable</div><div className="stat-value" style={{ fontSize: 18 }}>{formatCurrency(totalCertified - totalRetainage)}</div></div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">AIA G702 / G703 Application for Payment</div>
            <div className="card-sub">Dallas Skyline Tower · Turner Construction · Contract: $2,180,000</div>
          </div>
          <div className="flex gap-2">
            <button className="btn btn-sm">New Application</button>
          </div>
        </div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Application No.</th>
                <th>Period</th>
                <th>Project</th>
                <th>% Complete</th>
                <th>Amount Claimed</th>
                <th>Retainage %</th>
                <th>Retainage $</th>
                <th>Certified $</th>
                <th>Net Due</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {BILLING_APPLICATIONS.map((b) => (
                <tr key={b.id}>
                  <td className="td-mono">{b.app_number}</td>
                  <td style={{ fontSize: 12 }}>{b.period_to}</td>
                  <td style={{ fontSize: 12 }}>{b.project}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="pbar" style={{ width: 50 }}>
                        <div className="pbar-fill" style={{ width: `${b.pct_complete}%` }} />
                      </div>
                      <span className="font-mono text-[11px]">{b.pct_complete}%</span>
                    </div>
                  </td>
                  <td className="td-mono">{formatCurrency(b.amount_claimed)}</td>
                  <td className="td-mono">{b.retainage_pct}%</td>
                  <td className="td-mono" style={{ color: "#D97706" }}>{formatCurrency(b.retainage_withheld)}</td>
                  <td className="td-mono" style={{ color: "var(--green)" }}>{b.amount_certified ? formatCurrency(b.amount_certified) : "—"}</td>
                  <td className="td-mono font-bold" style={{ color: "var(--primary)" }}>
                    {b.amount_certified ? formatCurrency(b.amount_certified - b.retainage_withheld) : "—"}
                  </td>
                  <td>
                    <span className={`pill ${b.status === "Certified" ? "pill-done" : b.status === "Submitted" ? "pill-active" : "pill-idle"}`}>
                      {b.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageWrapper>
  );
}
