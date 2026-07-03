import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export function statusToClass(status: string): string {
  const map: Record<string, string> = {
    "Not Started": "pill-ns",
    Cutting: "pill-cut",
    Welding: "pill-weld",
    Painting: "pill-paint",
    Completed: "pill-done",
    Shipped: "pill-ship",
    Active: "pill-active",
    Planning: "pill-plan",
    "On Hold": "pill-hold",
    Open: "pill-open",
    Answered: "pill-done",
    Closed: "pill-ok",
    Current: "pill-done",
    Superseded: "pill-danger",
    Draft: "pill-ns",
    Pass: "pill-done",
    "Fail — Rework Required": "pill-danger",
    Done: "pill-done",
    Hold: "pill-danger",
    Overdue: "pill-danger",
    Valid: "pill-done",
    "Expiring Soon": "pill-warn",
    Expired: "pill-danger",
    In_Progress: "pill-info",
    Complete: "pill-done",
    Queued: "pill-ns",
    Delivered: "pill-teal",
    Scheduled: "pill-blue",
    Submitted: "pill-violet",
    Won: "pill-done",
    Lost: "pill-danger",
    Pending: "pill-warn",
    "Pending Approval": "pill-warn",
    Approved: "pill-done",
    "Approved — Billed": "pill-teal",
    Released: "pill-done",
    Quarantine: "pill-danger",
    "On File": "pill-done",
    Awaiting: "pill-warn",
    "Fully Received": "pill-done",
    "Partial": "pill-warn",
    "Not Received": "pill-ns",
    "under_review": "pill-warn",
    "withdrawn": "pill-danger",
    "awarded_setup": "pill-warn",
  };
  return map[status] || map[status.toLowerCase()] || map[status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()] || "pill-ns";
}

export function truncate(str: string, n: number): string {
  return str.length > n ? str.slice(0, n - 3) + "..." : str;
}
