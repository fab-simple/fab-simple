"use client";

import Link from "next/link";
import { PageWrapper } from "@/components/ui/PageWrapper";
import { useAppSelector } from "@/hooks/useAppRedux";
import { useOrganization } from "@/hooks/useResource";
import { Check, ExternalLink, Sparkles } from "lucide-react";

// Single place where we centralize where each CTA goes. Once Stripe Checkout
// is wired up, point Starter / Professional CTAs at /api/billing/checkout
// instead of mailto: — until then we use mailto so customers actually hear
// back when they click.
const SALES_EMAIL = "sales@fabsimple.io";
const SUPPORT_EMAIL = "support@fabsimple.io";

interface Plan {
  id: "starter" | "professional" | "enterprise";
  name: string;
  price: string;
  period: string;
  perks: string[];
  featured: boolean;
  ctaLabel: string;
  ctaHref: string;
  external?: boolean;
}

function planList(currentPlan: string): Plan[] {
  return [
    {
      id: "starter",
      name: "Starter",
      price: "$199",
      period: "/mo",
      perks: ["Up to 5 users", "1 project at a time", "5,000 parts", "QC modules", "Tekla CSV import", "Email support"],
      featured: false,
      ctaLabel: currentPlan === "starter" ? "Current plan" : "Start free trial",
      ctaHref: currentPlan === "starter"
        ? "#"
        : `mailto:${SALES_EMAIL}?subject=${encodeURIComponent("FabSimple — Starter trial")}&body=${encodeURIComponent(
            "Hi FabSimple team,\n\nI'd like to start the 14-day Starter trial for my company.\n\nThanks!",
          )}`,
      external: true,
    },
    {
      id: "professional",
      name: "Professional",
      price: "$499",
      period: "/mo",
      perks: ["Up to 25 users", "10 active projects", "50,000 parts", "Everything in Starter", "AIA G702 Billing", "Realtime + AI insights", "Priority support"],
      featured: true,
      ctaLabel: currentPlan === "professional" ? "Current plan" : "Upgrade to Professional",
      ctaHref: currentPlan === "professional"
        ? "#"
        : `mailto:${SALES_EMAIL}?subject=${encodeURIComponent("FabSimple — Professional upgrade")}&body=${encodeURIComponent(
            "Hi FabSimple team,\n\nI'd like to upgrade my account to the Professional plan.\n\nCompany: \nNumber of seats: \n\nThanks!",
          )}`,
      external: true,
    },
    {
      id: "enterprise",
      name: "Enterprise",
      price: "Custom",
      period: "",
      perks: ["Unlimited users", "Unlimited projects", "Unlimited parts", "Procore + QBO sync", "Dedicated CSM", "SSO + audit log export", "99.9% SLA"],
      featured: false,
      ctaLabel: "Contact sales",
      ctaHref: `mailto:${SALES_EMAIL}?subject=${encodeURIComponent("FabSimple — Enterprise inquiry")}&body=${encodeURIComponent(
        "Hi FabSimple team,\n\nWe'd like to learn more about the Enterprise plan.\n\nCompany: \nAnnual revenue band: \nNumber of fab/erect crews: \nIntegrations needed (Procore / QBO / SDS2 / Tekla / SSO): \n\nThanks!",
      )}`,
      external: true,
    },
  ];
}

export default function PricingPage() {
  const org = useOrganization();
  const role = useAppSelector((s) => s.auth.role);
  // org.data?.plan is whatever subscription level we resolved server-side
  // (defaults to starter on signup). Showing "Current plan" badges anchors
  // the user and stops the "every button does nothing" confusion.
  const currentPlan = ((org.data as unknown as { plan?: string })?.plan ?? "").toLowerCase();
  const plans = planList(currentPlan);
  const canUpgrade = role === "owner" || role === "accounting";

  return (
    <PageWrapper title="Pricing">
      <div className="text-center" style={{ marginBottom: 32 }}>
        <div className="text-[24px] font-bold" style={{ color: "var(--text)" }}>Plans built for steel shops</div>
        <div className="text-[13px]" style={{ color: "var(--muted)", marginTop: 6 }}>
          Cancel anytime · 14-day trial · No setup fees
        </div>
        {!canUpgrade && (
          <div className="pill" style={{ marginTop: 14, fontSize: 11, padding: "6px 10px", display: "inline-flex", gap: 6 }}>
            Only owners and accounting can request plan changes — talk to yours, or
            <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: "var(--primary)", marginLeft: 4 }}>contact support</a>.
          </div>
        )}
      </div>

      <div className="grid-3 gap-md">
        {plans.map((plan) => {
          const isCurrent = currentPlan === plan.id;
          return (
            <div key={plan.id} className="card" style={plan.featured ? { borderColor: "var(--primary)", borderWidth: 2 } : {}}>
              {plan.featured && (
                <div style={{ background: "var(--primary)", color: "white", padding: "6px 12px", textAlign: "center", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
                  <Sparkles size={11} style={{ display: "inline", marginRight: 4, verticalAlign: -1 }} /> Most popular
                </div>
              )}
              <div className="card-body" style={{ padding: 28 }}>
                <div className="flex items-center justify-between">
                  <div className="text-[18px] font-bold" style={{ color: "var(--text)" }}>{plan.name}</div>
                  {isCurrent && (
                    <span className="pill pill-done" style={{ fontSize: 10, padding: "3px 8px" }}>Current</span>
                  )}
                </div>
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
                {isCurrent ? (
                  <button className="btn" disabled style={{ width: "100%", justifyContent: "center", height: 40, cursor: "default", opacity: 0.6 }}>
                    {plan.ctaLabel}
                  </button>
                ) : plan.external ? (
                  <a
                    href={plan.ctaHref}
                    className={plan.featured ? "btn btn-primary" : "btn"}
                    style={{ width: "100%", justifyContent: "center", height: 40, textDecoration: "none" }}
                  >
                    {plan.ctaLabel} <ExternalLink size={12} />
                  </a>
                ) : (
                  <Link href={plan.ctaHref} className={plan.featured ? "btn btn-primary" : "btn"} style={{ width: "100%", justifyContent: "center", height: 40 }}>
                    {plan.ctaLabel}
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-center" style={{ marginTop: 24, fontSize: 12, color: "var(--muted)" }}>
        Need a custom seat count, SSO, or volume pricing?{" "}
        <a href={`mailto:${SALES_EMAIL}`} style={{ color: "var(--primary)" }}>Talk to sales</a>.
      </div>
    </PageWrapper>
  );
}
