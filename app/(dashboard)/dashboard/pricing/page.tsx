"use client";

import { PageWrapper } from "@/components/ui/PageWrapper";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: 149,
    period: "month",
    color: "#64748B",
    features: ["Up to 2 projects", "500 parts", "1 user", "Estimating, Parts, QC", "Email support"],
    highlight: false,
  },
  {
    id: "professional",
    name: "Professional",
    price: 349,
    period: "month",
    color: "#4F46E5",
    features: ["Up to 10 projects", "10,000 parts", "10 users", "All modules", "AIA G702 billing", "Tekla CSV import", "Priority support"],
    highlight: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: 0,
    period: "month",
    color: "#0D9488",
    features: ["Unlimited projects & parts", "Unlimited users", "All modules + API access", "Custom integrations", "Onboarding + training", "Dedicated CSM"],
    highlight: false,
  },
];

export default function PricingPage() {
  return (
    <PageWrapper title="Pricing">
      <div className="text-center mb-8">
        <h2 className="font-bold text-[24px] mb-2" style={{ color: "var(--text)" }}>Simple, Transparent Pricing</h2>
        <p className="text-[14px]" style={{ color: "var(--muted)" }}>No per-seat surprises. Everything you need to run a steel fabrication shop.</p>
      </div>

      <div className="grid-3" style={{ gap: 20 }}>
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className="card"
            style={{
              borderTop: `3px solid ${plan.color}`,
              boxShadow: plan.highlight ? "var(--shadow-lg)" : undefined,
              transform: plan.highlight ? "scale(1.02)" : undefined,
            }}
          >
            <div className="card-body">
              {plan.highlight && (
                <div className="text-center mb-3">
                  <span className="pill pill-active">Most Popular</span>
                </div>
              )}
              <div className="text-center mb-5">
                <div className="font-bold text-[18px] mb-1" style={{ color: plan.color }}>{plan.name}</div>
                {plan.price > 0 ? (
                  <>
                    <div className="font-bold text-[36px]" style={{ color: "var(--text)" }}>${plan.price}</div>
                    <div className="text-[12px]" style={{ color: "var(--muted)" }}>per {plan.period}</div>
                  </>
                ) : (
                  <div className="font-bold text-[28px]" style={{ color: "var(--text)" }}>Contact Us</div>
                )}
              </div>
              <ul className="flex flex-col gap-2 mb-5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-[13px]" style={{ color: "var(--text-2)" }}>
                    <span style={{ color: plan.color, flexShrink: 0 }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                className={`btn w-full justify-center ${plan.highlight ? "btn-primary" : ""}`}
                style={!plan.highlight ? { borderColor: plan.color, color: plan.color } : {}}
              >
                {plan.price === 0 ? "Talk to Sales" : "Get Started"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </PageWrapper>
  );
}
