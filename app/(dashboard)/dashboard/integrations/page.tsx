"use client";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { useState } from "react";

const INTEGRATIONS = [
  {
    id: "tekla",
    name: "Tekla Structures",
    category: "Design",
    description: "Import part lists directly from Tekla project files via CSV or API. Enables one-click synchronization of assemblies, part IDs, profiles, and weights.",
    logo: "🏗",
    status: "connected",
  },
  {
    id: "procore",
    name: "Procore",
    category: "Project Management",
    description: "Sync submittals, RFIs, and daily logs with your GC's Procore environment. Reduce duplicate data entry across teams.",
    logo: "📋",
    status: "disconnected",
  },
  {
    id: "quickbooks",
    name: "QuickBooks Online",
    category: "Finance",
    description: "Push AIA billing applications and PO payments directly to QuickBooks. Automate AP/AR reconciliation.",
    logo: "💰",
    status: "connected",
  },
  {
    id: "aws",
    name: "AWS S3 / Document Storage",
    category: "Storage",
    description: "Store and retrieve MTRs, shop drawings, inspection reports, and shipping BOLs in secure cloud storage.",
    logo: "☁",
    status: "connected",
  },
  {
    id: "twilio",
    name: "Twilio SMS Alerts",
    category: "Notifications",
    description: "Send SMS alerts to supervisors for AISC holds, missed QC milestones, and overdue certifications.",
    logo: "📱",
    status: "disconnected",
  },
  {
    id: "epicor",
    name: "Epicor Kinetic",
    category: "ERP",
    description: "Enterprise-level integration with Epicor manufacturing ERP for full shop workflow synchronization.",
    logo: "⚙",
    status: "disconnected",
  },
];

export default function IntegrationsPage() {
  const [statuses, setStatuses] = useState<Record<string, string>>(
    Object.fromEntries(INTEGRATIONS.map((i) => [i.id, i.status]))
  );

  const toggle = (id: string) => {
    setStatuses((prev) => ({ ...prev, [id]: prev[id] === "connected" ? "disconnected" : "connected" }));
  };

  return (
    <PageWrapper title="Integrations">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {INTEGRATIONS.map((intg) => {
          const connected = statuses[intg.id] === "connected";
          return (
            <div key={intg.id} className="card">
              <div className="card-body">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <div className="text-[28px]">{intg.logo}</div>
                    <div>
                      <div className="font-bold text-[14px]" style={{ color: "var(--text)" }}>{intg.name}</div>
                      <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>{intg.category}</div>
                    </div>
                  </div>
                  <button
                    className={`btn btn-sm ${connected ? "" : "btn-primary"}`}
                    style={connected ? { background: "var(--green-bg)", color: "var(--green)", borderColor: "var(--green-bd)" } : {}}
                    onClick={() => toggle(intg.id)}
                  >
                    {connected ? "✓ Connected" : "Connect"}
                  </button>
                </div>
                <p className="text-[12px]" style={{ color: "var(--text-2)" }}>{intg.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </PageWrapper>
  );
}
