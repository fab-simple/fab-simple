"use client";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { CERTIFICATIONS } from "@/lib/mock-data";
import { useState } from "react";
import { AlertTriangle } from "lucide-react";

export default function CertificationsPage() {
  const [filter, setFilter] = useState("All");
  const expired = CERTIFICATIONS.filter((c) => c.status === "Expired");
  const expiring = CERTIFICATIONS.filter((c) => c.status === "Expiring Soon");

  const filtered = filter === "All" ? CERTIFICATIONS : CERTIFICATIONS.filter((c) => c.status === filter);

  return (
    <PageWrapper title="Certifications & Qualifications">
      {(expired.length > 0 || expiring.length > 0) && (
        <div className={`alert ${expired.length > 0 ? "alert-danger" : "alert-warn"} mb-4`}>
          <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
          <div>
            {expired.length > 0 && <><strong>EXPIRED:</strong> {expired.map((c) => `${c.person_company} (${c.cert_number})`).join(", ")}. </>}
            {expiring.length > 0 && <><strong>EXPIRING SOON:</strong> {expiring.map((c) => `${c.person_company} — ${c.days_until}d`).join(", ")}.</>}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {["All", "Valid", "Expiring Soon", "Expired"].map((s) => (
          <button key={s} className={`btn btn-sm ${filter === s ? "btn-primary" : ""}`} onClick={() => setFilter(s)}>{s}</button>
        ))}
      </div>

      <div className="card">
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr><th>Person / Company</th><th>Role</th><th>Cert Type</th><th>Cert Number</th><th>Issue Date</th><th>Expiry Date</th><th>Days Until Expiry</th><th>Status</th></tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className={c.status === "Expired" ? "tr-danger" : c.status === "Expiring Soon" ? "tr-warn" : ""}>
                  <td className="font-semibold" style={{ color: "var(--text)" }}>{c.person_company}</td>
                  <td style={{ fontSize: 12 }}>{c.role_title}</td>
                  <td style={{ fontSize: 12 }}>{c.cert_type}</td>
                  <td className="td-mono">{c.cert_number}</td>
                  <td style={{ fontSize: 12 }}>{c.issue_date}</td>
                  <td style={{ fontSize: 12 }}>{c.expiry_date}</td>
                  <td className="td-mono font-bold" style={{ color: c.days_until < 0 ? "var(--red)" : c.days_until < 30 ? "#D97706" : "var(--green)" }}>
                    {c.days_until < 0 ? `${Math.abs(c.days_until)}d AGO` : `${c.days_until}d`}
                  </td>
                  <td>
                    <span className={`pill ${c.status === "Expired" ? "pill-danger" : c.status === "Expiring Soon" ? "pill-warn" : "pill-done"}`}>
                      {c.status}
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
