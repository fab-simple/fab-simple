"use client";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { StatusPill } from "@/components/ui/StatusPill";
import { HEAT_NUMBERS } from "@/lib/mock-data";
import { AlertTriangle } from "lucide-react";

export default function HeatNumbersPage() {
  const quarantine = HEAT_NUMBERS.filter((h) => h.status === "Quarantine");
  return (
    <PageWrapper title="Heat Numbers & ASTM Traceability">
      {quarantine.length > 0 && (
        <div className="alert alert-danger mb-4">
          <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
          <div><strong>{quarantine.length} heat number(s) in QUARANTINE</strong> — MTR (Mill Test Report) not yet received. Parts with {quarantine.map((h) => h.heat_number).join(", ")} must not enter fabrication until released by QC.</div>
        </div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <div className="stat-card primary"><div className="stat-label">Total Heats</div><div className="stat-value">{HEAT_NUMBERS.length}</div></div>
        <div className="stat-card green"><div className="stat-label">Released</div><div className="stat-value">{HEAT_NUMBERS.filter(h => h.status === "Released").length}</div></div>
        <div className="stat-card red"><div className="stat-label">Quarantine</div><div className="stat-value">{quarantine.length}</div></div>
        <div className="stat-card amber"><div className="stat-label">MTR Awaiting</div><div className="stat-value">{HEAT_NUMBERS.filter(h => h.mtr_status === "Awaiting").length}</div></div>
      </div>
      <div className="card">
        <div className="card-header"><div className="card-title">Heat Number Traceability Log</div></div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr><th>Heat Number</th><th>ASTM Spec</th><th>Profile</th><th>Supplier</th><th>MTR Status</th><th>Parts Count</th><th>Receipt No.</th><th>Status</th></tr>
            </thead>
            <tbody>
              {HEAT_NUMBERS.map((h) => (
                <tr key={h.id} className={h.status === "Quarantine" ? "tr-danger" : "tr-ok"}>
                  <td className="td-mono">{h.heat_number}</td>
                  <td className="font-mono text-[11px]">{h.astm_spec}</td>
                  <td style={{ fontSize: 12 }}>{h.profile}</td>
                  <td style={{ fontSize: 12 }}>{h.supplier}</td>
                  <td><StatusPill status={h.mtr_status} /></td>
                  <td className="td-mono">{h.parts_count}</td>
                  <td className="td-mono" style={{ fontSize: 11 }}>{h.receipt_number}</td>
                  <td><StatusPill status={h.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageWrapper>
  );
}
