"use client";

import { PageWrapper } from "@/components/ui/PageWrapper";
import { Modal } from "@/components/ui/Modal";
import { useState } from "react";
import { Plus, Edit2, Trash2 } from "lucide-react";

const ROLES = [
  { id: "owner", label: "Owner", description: "Full access to all modules including Finance", count: 1 },
  { id: "pm", label: "Project Manager", description: "All modules except company settings", count: 2 },
  { id: "estimator", label: "Estimator", description: "Estimating, Projects, Change Orders, Finance read-only", count: 1 },
  { id: "foreman", label: "Shop Foreman", description: "Production, QC, Procurement modules", count: 2 },
  { id: "worker", label: "Shop Worker", description: "Worker view only — scan QR, update part status", count: 4 },
  { id: "accounting", label: "Accounting", description: "Finance modules only", count: 1 },
];

const USERS = [
  { id: "u1", name: "Jake Rivera", email: "jake@txsteelfab.com", role: "Owner", last_login: "Today 08:32", status: "Active", color: "#4F46E5" },
  { id: "u2", name: "Carla M.", email: "carla@txsteelfab.com", role: "Project Manager", last_login: "Today 07:55", status: "Active", color: "#0891B2" },
  { id: "u3", name: "D. Nguyen", email: "dnguyen@txsteelfab.com", role: "Shop Foreman", last_login: "Today 06:44", status: "Active", color: "#16A34A" },
  { id: "u4", name: "R. Torres", email: "rtorres@txsteelfab.com", role: "Shop Worker", last_login: "Today 07:01", status: "Active", color: "#D97706" },
  { id: "u5", name: "Sarah K.", email: "sarahk@txsteelfab.com", role: "Estimator", last_login: "Yesterday", status: "Active", color: "#7C3AED" },
  { id: "u6", name: "Bob H.", email: "bobh@txsteelfab.com", role: "Accounting", last_login: "2026-03-20", status: "Active", color: "#64748B" },
];

export default function UsersPage() {
  const [showModal, setShowModal] = useState(false);
  return (
    <PageWrapper title="Users & Roles">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        <div className="lg:col-span-2">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-[14px]" style={{ color: "var(--text)" }}>Team Members</h3>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={14} /> Invite User</button>
          </div>
          <div className="card">
            <div className="tbl-wrap">
              <table>
                <thead>
                  <tr><th>Name</th><th>Email</th><th>Role</th><th>Last Login</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {USERS.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold text-white" style={{ background: u.color }}>{u.name.slice(0, 1)}</div>
                          <span className="font-semibold text-[13px]" style={{ color: "var(--text)" }}>{u.name}</span>
                        </div>
                      </td>
                      <td style={{ fontSize: 12 }}>{u.email}</td>
                      <td><span className="pill pill-info">{u.role}</span></td>
                      <td style={{ fontSize: 12 }}>{u.last_login}</td>
                      <td><span className="pill pill-done">Active</span></td>
                      <td>
                        <div className="flex gap-1">
                          <button className="btn btn-sm"><Edit2 size={11} /></button>
                          <button className="btn btn-sm" style={{ color: "var(--red)" }}><Trash2 size={11} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div>
          <h3 className="font-bold text-[14px] mb-3" style={{ color: "var(--text)" }}>Role Definitions</h3>
          <div className="flex flex-col gap-2">
            {ROLES.map((r) => (
              <div key={r.id} className="card">
                <div className="card-body">
                  <div className="flex justify-between mb-1">
                    <span className="font-bold text-[13px]" style={{ color: "var(--text)" }}>{r.label}</span>
                    <span className="font-mono text-[11px]" style={{ color: "var(--muted)" }}>{r.count} user{r.count !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="text-[11px]" style={{ color: "var(--muted)" }}>{r.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Invite Team Member" size="sm">
        <div className="flex flex-col gap-3">
          <div className="fld"><label>Email Address *</label><input type="email" placeholder="worker@txsteelfab.com" /></div>
          <div className="fld"><label>Role *</label>
            <select>
              {ROLES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary">Send Invite</button>
        </div>
      </Modal>
    </PageWrapper>
  );
}
