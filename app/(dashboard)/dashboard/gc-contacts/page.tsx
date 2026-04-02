"use client";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { GC_CONTACTS } from "@/lib/mock-data";
import { Phone, Mail } from "lucide-react";

export default function GCContactsPage() {
  return (
    <PageWrapper title="GC Contacts">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {GC_CONTACTS.map((c) => (
          <div key={c.id} className="card">
            <div className="card-body">
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-bold text-white flex-shrink-0"
                  style={{ background: "var(--sidebar)" }}
                >
                  {c.name.slice(0, 1)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-[14px]" style={{ color: "var(--text)" }}>{c.name}</div>
                  <div className="text-[12px] font-semibold" style={{ color: "var(--primary)" }}>{c.company_name}</div>
                  <div className="text-[11px]" style={{ color: "var(--muted)" }}>{c.role_title}</div>
                  <div className="text-[11px] mt-0.5" style={{ color: "var(--faint)" }}>Project: {c.project}</div>
                </div>
              </div>
              <div className="mt-3 flex flex-col gap-1.5">
                <a href={`tel:${c.phone}`} className="flex items-center gap-2 text-[12px] hover:text-[var(--primary)]" style={{ color: "var(--text-2)" }}>
                  <Phone size={12} style={{ color: "var(--muted)" }} /> {c.phone}
                </a>
                <a href={`mailto:${c.email}`} className="flex items-center gap-2 text-[12px] hover:text-[var(--primary)]" style={{ color: "var(--text-2)" }}>
                  <Mail size={12} style={{ color: "var(--muted)" }} /> {c.email}
                </a>
              </div>
              <div className="mt-3 pt-3 text-[10px]" style={{ borderTop: "1px solid var(--border)", color: "var(--faint)" }}>
                Last contact: {c.last_contact}
              </div>
            </div>
          </div>
        ))}
      </div>
    </PageWrapper>
  );
}
