"use client";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { Check } from "lucide-react";

const PLANS = [
  {
    name: "Starter", price: "$199", period: "/mo",
    perks: ["Up to 5 users", "1 project at a time", "5,000 parts", "QC modules", "Tekla CSV import", "Email support"],
    cta: "Start free trial", featured: false,
  },
  {
    name: "Professional", price: "$499", period: "/mo",
    perks: ["Up to 25 users", "10 active projects", "50,000 parts", "Everything in Starter", "AIA G702 Billing", "Realtime + AI insights", "Priority support"],
    cta: "Most popular", featured: true,
  },
  {
    name: "Enterprise", price: "Custom", period: "",
    perks: ["Unlimited users", "Unlimited projects", "Unlimited parts", "Procore + QBO sync", "Dedicated CSM", "SSO + audit log export", "99.9% SLA"],
    cta: "Contact sales", featured: false,
  },
];

export default function PricingPage() {
  return (
    <PageWrapper title="Pricing">
      <div className="text-center" style={{ marginBottom: 32 }}>
        <div className="text-[24px] font-bold" style={{ color: "var(--text)" }}>Plans built for steel shops</div>
        <div className="text-[13px]" style={{ color: "var(--muted)", marginTop: 6 }}>Cancel anytime · 14-day trial · No setup fees</div>
      </div>

      <div className="grid-3 gap-md">
        {PLANS.map((plan) => (
          <div key={plan.name} className="card" style={plan.featured ? { borderColor: "var(--primary)", borderWidth: 2 } : {}}>
            {plan.featured && (
              <div style={{ background: "var(--primary)", color: "white", padding: "6px 12px", textAlign: "center", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
                Recommended
              </div>
            )}
            <div className="card-body" style={{ padding: 28 }}>
              <div className="text-[18px] font-bold" style={{ color: "var(--text)" }}>{plan.name}</div>
              <div style={{ marginTop: 12, marginBottom: 24 }}>
                <span className="text-[36px] font-bold" style={{ color: "var(--text)" }}>{plan.price}</span>
                <span className="text-[13px]" style={{ color: "var(--muted)" }}>{plan.period}</span>
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, marginBottom: 24, display: "flex", flexDirection: "column", gap: 10 }}>
                {plan.perks.map((p) => (
                  <li key={p} className="flex items-center gap-2 text-[13px]" style={{ color: "var(--text)" }}>
                    <Check size={14} style={{ color: "#16A34A" }} /> {p}
                  </li>
                ))}
              </ul>
              <button className={plan.featured ? "btn btn-primary" : "btn"} style={{ width: "100%", justifyContent: "center", height: 40 }}>
                {plan.cta}
              </button>
            </div>
          </div>
        ))}
      </div>
    </PageWrapper>
  );
}
