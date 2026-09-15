import {
  LayoutDashboard,
  FolderKanban,
  ListChecks,
  Layers,
  Calculator,
  FileDiff,
  FileText,
  ShoppingCart,
  PackageCheck,
  Warehouse,
  ClipboardList,
  PaintBucket,
  ShieldCheck,
  Hammer,
  FlameKindling,
  AlertTriangle,
  Award,
  ArrowUpDown,
  Truck,
  Phone,
  DollarSign,
  CreditCard,
  Smartphone,
  Activity,
  QrCode,
  Upload,
  Users,
  Plug,
  Tag,
  Compass,
  HardHat,
  Building2,
  Package,
  FileSpreadsheet,
  Send,
  GitBranch,
} from "lucide-react";

export interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number | string; color?: string }>;
  badge?: string;
  badgeClass?: string;
  section?: string;
  /** Roles allowed to see this nav item in the sidebar. Omit = visible to all
   * non-worker roles. (Workers are routed exclusively to /worker — they get
   * an empty sidebar by design.) */
  roles?: string[];
  /** When true, this page requires a project to be selected. The sidebar will
   * dim/lock the item and the ProjectGate will overlay the page content. */
  projectScoped?: boolean;
}

// --- Convenience role groups (lifted directly from the v5 spec matrix) -------

const ALL_NON_WORKER = ["owner", "estimator", "pm", "foreman", "qc", "accounting"] as const;
const OWNER_ONLY = ["owner"] as const;
const OWNER_PM = ["owner", "pm"] as const;
const OWNER_PM_FOREMAN = ["owner", "pm", "foreman"] as const;
const OWNER_PM_FOREMAN_QC = ["owner", "pm", "foreman", "qc"] as const;
const OWNER_PM_QC = ["owner", "pm", "qc"] as const;
const OWNER_PM_FOREMAN_QC_ACCT = ["owner", "pm", "foreman", "qc", "accounting"] as const;
const OWNER_PM_FOREMAN_ACCT = ["owner", "pm", "foreman", "accounting"] as const;
const OWNER_PM_ACCT = ["owner", "pm", "accounting"] as const;
const OWNER_ESTIMATOR_PM = ["owner", "estimator", "pm"] as const;
const OWNER_ESTIMATOR_PM_ACCT = ["owner", "estimator", "pm", "accounting"] as const;
const OWNER_ESTIMATOR_PM_FOREMAN_ACCT = ["owner", "estimator", "pm", "foreman", "accounting"] as const;

export const NAV_SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [
      // Spec: Dashboard visible to everyone except Worker.
      { key: "dashboard",     label: "Dashboard",     href: "/dashboard",                 icon: LayoutDashboard, roles: [...ALL_NON_WORKER] },
      { key: "live-activity", label: "Live Activity", href: "/dashboard/live-activity",   icon: Activity,        roles: [...ALL_NON_WORKER] },
    ],
  },
  {
    label: "Pre-Construction",
    items: [
      // Estimation: Owner Full · Estimator Full · PM View
      { key: "estimating",    label: "Estimation",    href: "/dashboard/estimating",      icon: Calculator,   roles: [...OWNER_ESTIMATOR_PM] },
    ],
  },
  {
    label: "Procurement",
    items: [
      // Procurement is company-wide, end to end (§16 of the spec) — none of
      // these pages are projectScoped. A PO's own project field, when set,
      // is purely informational for job-costing; material itself is never
      // locked to a project until someone explicitly reserves it from the
      // Inventory page.
      //
      // Vendors: company-wide master data, like GC Contacts. Readable by
      // everyone who touches procurement (matches permissions.ts vendors.readable).
      { key: "vendors",         label: "Vendors",            href: "/dashboard/vendors",         icon: Building2,       roles: [...ALL_NON_WORKER] },
      // Sourcing Workflow (§15) — Material Requirement -> RFQ -> Vendor
      // Quotes -> Award, which auto-creates the draft PO below. Material
      // Requirements are project-scoped (raised against a specific job);
      // RFQ is deliberately the one procurement page that ISN'T — it can
      // bundle requirements from several projects into one vendor ask.
      { key: "material-requirements", label: "Material Requirements", href: "/dashboard/material-requirements", icon: FileSpreadsheet, roles: [...OWNER_ESTIMATOR_PM_FOREMAN_ACCT] },
      { key: "rfqs",            label: "RFQs",                href: "/dashboard/rfqs",            icon: Send,            roles: [...OWNER_ESTIMATOR_PM_ACCT] },
      // Purchase Orders: Owner Full · PM Full · Foreman View · Accounting Full
      { key: "purchase-orders", label: "Purchase Orders",    href: "/dashboard/purchase-orders", icon: ShoppingCart,    roles: [...OWNER_PM_FOREMAN_ACCT] },
      // Inbound Shipments (vendor -> shop): Owner Full · PM Full · Foreman Full · Accounting Full
      { key: "inbound-shipments", label: "Inbound Shipments", href: "/dashboard/inbound-shipments", icon: Truck,       roles: [...OWNER_PM_FOREMAN_ACCT] },
      // Material Receiving: Owner Full · PM Full · Foreman Full · Accounting View
      { key: "receiving",       label: "Material Receiving", href: "/dashboard/receiving",       icon: PackageCheck,    roles: [...OWNER_PM_FOREMAN_ACCT] },
      // Bundles: Owner Full · PM Full · Foreman Full · QC View — bundle registration + heat assignment
      { key: "bundles",         label: "Bundles",            href: "/dashboard/bundles",         icon: Package,         roles: [...OWNER_PM_FOREMAN_QC] },
      // Inventory: Owner Full · Estimator View · PM Full · Foreman View · Accounting View
      // (Bulk Stock tab is company-wide; the Traceable Lots tab filters by
      // the Global Project Context internally — see spec §5/§13 D2.)
      { key: "inventory",       label: "Inventory",          href: "/dashboard/inventory",       icon: Warehouse,       roles: [...OWNER_ESTIMATOR_PM_FOREMAN_ACCT] },
      // Heat Numbers: Owner Full · PM View · QC Full · Foreman Full (widened, §13 D6)
      { key: "heat-numbers",    label: "Heat Numbers",       href: "/dashboard/heat-numbers",    icon: FlameKindling,   roles: [...OWNER_PM_FOREMAN_QC] },
      // Material Traceability: Full reverse chain (Part -> Heat -> Lot -> PO -> Vendor -> MTR)
      { key: "traceability",    label: "Material Traceability", href: "/dashboard/traceability", icon: GitBranch,      roles: [...OWNER_PM_FOREMAN_QC] },
    ],
  },
  {
    label: "Projects",
    items: [
      // Projects: Owner Full · Estimator View · PM Full · Foreman View · QC View · Accounting View
      { key: "projects",      label: "Projects",      href: "/dashboard/projects",        icon: FolderKanban, roles: [...ALL_NON_WORKER] },
      // Change Orders: Owner Full · PM Full · Accounting View
      { key: "change-orders", label: "Change Orders", href: "/dashboard/change-orders",   icon: FileDiff,     roles: [...OWNER_PM_ACCT], projectScoped: true },
      // RFIs: Owner Full · PM Full · Foreman View · QC View
      { key: "rfis",          label: "RFI Log",       href: "/dashboard/rfis",            icon: FileText,     roles: [...OWNER_PM_FOREMAN_QC], projectScoped: true },
      // Drawing Log: Owner Full · PM Full · Foreman View · QC View · Worker View
      { key: "drawings",      label: "Drawing Log",   href: "/dashboard/drawings",        icon: FileText,     roles: [...OWNER_PM_FOREMAN_QC], projectScoped: true },
    ],
  },
  {
    label: "Production",
    items: [
      // Parts List: Owner Full · PM Full · Foreman Full · QC View · Worker View
      { key: "parts",         label: "Parts List",            href: "/dashboard/parts",      icon: ListChecks,    roles: [...OWNER_PM_FOREMAN_QC], projectScoped: true },
      // Assemblies: Owner Full · PM Full · Foreman Full · QC View
      { key: "assemblies",    label: "Assemblies",            href: "/dashboard/assemblies", icon: Layers,        roles: [...OWNER_PM_FOREMAN_QC], projectScoped: true },
      // Cut List Optimizer: Owner Full · PM Full · Foreman Full
      { key: "cut-list",      label: "Cut List Optimizer",    href: "/dashboard/cut-list",   icon: Hammer,        roles: [...OWNER_PM_FOREMAN], projectScoped: true },
      // Tekla / SDS2 BOM import (CSV + XLSX): Owner + PM (treat as Parts-write).
      { key: "import",        label: "Import / Tekla BOM",    href: "/dashboard/import",     icon: Upload,        roles: [...OWNER_PM], projectScoped: true },
      // Daily Log: Owner Full · PM Full · Foreman Full
      { key: "daily-log",     label: "Daily Production Log",  href: "/dashboard/daily-log",  icon: ClipboardList, roles: [...OWNER_PM_FOREMAN], projectScoped: true },
    ],
  },
  {
    label: "Quality & Compliance",
    items: [
      // Paint Inspection: Owner Full · PM View · QC Full
      { key: "paint-inspection", label: "Paint Inspection", href: "/dashboard/paint-inspection", icon: PaintBucket,  roles: [...OWNER_PM_QC], projectScoped: true },
      // AWS Weld Log: Owner Full · PM View · QC Full
      { key: "weld-log",         label: "AWS Weld Log",     href: "/dashboard/weld-log",         icon: Hammer,       roles: [...OWNER_PM_QC], projectScoped: true },
      // AISC 303 Checklist: Owner Full · PM Full · Foreman View · QC Full
      { key: "aisc",             label: "AISC 303 QC",      href: "/dashboard/aisc",             icon: ShieldCheck,  roles: [...OWNER_PM_FOREMAN_QC], projectScoped: true },
      // OSHA Checklist: Owner Full · PM Full · Foreman Full · QC View
      { key: "osha",             label: "OSHA Checklist",   href: "/dashboard/osha",             icon: AlertTriangle, roles: [...OWNER_PM_FOREMAN_QC] },
      // Cert Tracker: Owner Full · PM View · QC Full
      { key: "certifications",   label: "Certifications",   href: "/dashboard/certifications",   icon: Award,        roles: [...OWNER_PM_QC] },
      // NCR Reports: Owner Full · PM View · Foreman View · QC Full
      { key: "ncr",              label: "NCR Reports",      href: "/dashboard/ncr",              icon: AlertTriangle, roles: [...OWNER_PM_FOREMAN_QC], projectScoped: true },
    ],
  },
  {
    label: "Logistics",
    items: [
      // Ground Station: Owner Full · PM Full · Foreman Full · Erection Subcontractor
      { key: "ground-station", label: "Ground Station (E-Plan)", href: "/ground-station", icon: Compass, roles: [...OWNER_PM_FOREMAN, "erection_subcontractor"], projectScoped: true },
      // Erection Operations: Owner Full · PM Full · Foreman Full · Erection Subcontractor
      { key: "erection-ops",   label: "Erection Operations", href: "/dashboard/erection-ops", icon: HardHat, roles: [...OWNER_PM_FOREMAN, "erection_subcontractor"], projectScoped: true },
      // Erection Sequence: Owner Full · PM Full · Foreman Full · Erection Subcontractor
      { key: "erection",       label: "Erection Sequence", href: "/dashboard/erection",   icon: ArrowUpDown, roles: [...OWNER_PM_FOREMAN, "erection_subcontractor"], projectScoped: true },
      // Shipping Tickets: Owner Full · PM Full · Foreman Create · Accounting View
      { key: "shipping",       label: "Shipping Tickets",  href: "/dashboard/shipping",   icon: Truck,       roles: [...OWNER_PM_FOREMAN_ACCT], projectScoped: true },
      // QR Codes: production tooling — Owner / PM / Foreman.
      { key: "qr-codes",       label: "QR Codes",          href: "/dashboard/qr-codes",   icon: QrCode,      roles: [...OWNER_PM_FOREMAN], projectScoped: true },
      // GC Contacts: Owner Full · Estimator Full · PM Full
      { key: "gc-contacts",    label: "GC Contacts",       href: "/dashboard/gc-contacts", icon: Phone,      roles: [...OWNER_ESTIMATOR_PM] },
    ],
  },
  {
    label: "Finance",
    items: [
      // Job Cost: Owner Full · Estimator View · PM Full · Accounting Full
      { key: "job-cost", label: "Job Cost Tracker", href: "/dashboard/job-cost", icon: DollarSign,  roles: [...OWNER_ESTIMATOR_PM_ACCT], projectScoped: true },
      // AIA G702 Billing: Owner Approve · PM View · Accounting Full
      { key: "billing",  label: "AIA G702 Billing", href: "/dashboard/billing",  icon: CreditCard,  roles: [...OWNER_PM_ACCT], projectScoped: true },
    ],
  },
  {
    label: "Admin",
    items: [
      // Worker view explainer (links to /worker). Visible to non-worker roles
      // for onboarding/training; workers themselves are auto-routed to /worker.
      { key: "worker",        label: "Worker View",   href: "/dashboard/worker",        icon: Smartphone, roles: [...ALL_NON_WORKER] },
      // Users & Roles: Owner only.
      { key: "users",         label: "Users & Roles", href: "/dashboard/users",         icon: Users,      roles: [...OWNER_ONLY] },
      // Audit Log: Owner / PM / Accounting.
      { key: "audit-log",     label: "Audit Log",     href: "/dashboard/audit-log",     icon: ShieldCheck, roles: [...OWNER_PM_ACCT] },
      // Integrations: Owner Full · PM View.
      { key: "integrations",  label: "Integrations",  href: "/dashboard/integrations",  icon: Plug,        roles: [...OWNER_PM] },
      // Pricing: Owner only.
      { key: "pricing",       label: "Pricing",       href: "/dashboard/pricing",       icon: Tag,         roles: [...OWNER_ONLY] },
    ],
  },
];

// ---------------------------------------------------------------------------
// Canonical route → allowed-roles map. Lives next to the nav so the sidebar,
// the Next.js middleware, and any future page guard all read the same source
// of truth. Keep in sync with the spec matrix.
// ---------------------------------------------------------------------------

export type Role = "owner" | "estimator" | "pm" | "foreman" | "qc" | "accounting" | "worker";

export const ROUTE_ACCESS: Array<{ prefix: string; roles: Role[] }> = [
  // Worker-only mobile surface.
  { prefix: "/worker",                       roles: ["worker"] },

  // Dashboard root + overview.
  { prefix: "/dashboard/live-activity",      roles: ["owner", "estimator", "pm", "foreman", "qc", "accounting"] },

  // Projects family.
  { prefix: "/dashboard/projects",           roles: ["owner", "estimator", "pm", "foreman", "qc", "accounting"] },
  { prefix: "/dashboard/estimating",         roles: ["owner", "estimator", "pm"] },
  { prefix: "/dashboard/change-orders",      roles: ["owner", "pm", "accounting"] },
  { prefix: "/dashboard/rfis",               roles: ["owner", "pm", "foreman", "qc"] },
  // Drawings: workers also need read access (QR scan deep link).
  { prefix: "/dashboard/drawings",           roles: ["owner", "pm", "foreman", "qc", "worker"] },

  // Production.
  // Parts: workers update via this route too (deep link from QR scan).
  { prefix: "/dashboard/parts",              roles: ["owner", "pm", "foreman", "qc", "worker"] },
  { prefix: "/dashboard/assemblies",         roles: ["owner", "pm", "foreman", "qc"] },
  { prefix: "/dashboard/daily-log",          roles: ["owner", "pm", "foreman"] },
  { prefix: "/dashboard/import",             roles: ["owner", "pm"] },
  { prefix: "/dashboard/cut-list",           roles: ["owner", "pm", "foreman"] },

  // Procurement.
  { prefix: "/dashboard/vendors",            roles: ["owner", "estimator", "pm", "foreman", "qc", "accounting"] },
  { prefix: "/dashboard/material-requirements", roles: ["owner", "estimator", "pm", "foreman", "accounting"] },
  { prefix: "/dashboard/rfqs",               roles: ["owner", "estimator", "pm", "accounting"] },
  { prefix: "/dashboard/purchase-orders",    roles: ["owner", "pm", "foreman", "accounting"] },
  { prefix: "/dashboard/inbound-shipments",  roles: ["owner", "pm", "foreman", "accounting"] },
  { prefix: "/dashboard/receiving",          roles: ["owner", "pm", "foreman", "accounting"] },
  { prefix: "/dashboard/bundles",            roles: ["owner", "pm", "foreman", "qc"] },
  { prefix: "/dashboard/inventory",          roles: ["owner", "estimator", "pm", "foreman", "accounting"] },
  { prefix: "/dashboard/heat-numbers",       roles: ["owner", "pm", "foreman", "qc"] },
  { prefix: "/dashboard/traceability",       roles: ["owner", "pm", "foreman", "qc"] },

  // Quality & Compliance.
  { prefix: "/dashboard/paint-inspection",   roles: ["owner", "pm", "qc"] },
  { prefix: "/dashboard/weld-log",           roles: ["owner", "pm", "qc"] },
  { prefix: "/dashboard/aisc",               roles: ["owner", "pm", "foreman", "qc"] },
  { prefix: "/dashboard/osha",               roles: ["owner", "pm", "foreman", "qc"] },
  { prefix: "/dashboard/certifications",     roles: ["owner", "pm", "qc"] },
  { prefix: "/dashboard/ncr",                roles: ["owner", "pm", "foreman", "qc"] },

  // Logistics.
  { prefix: "/dashboard/erection",           roles: ["owner", "pm", "foreman"] },
  { prefix: "/dashboard/shipping",           roles: ["owner", "pm", "foreman", "accounting"] },
  { prefix: "/dashboard/qr-codes",           roles: ["owner", "pm", "foreman"] },
  { prefix: "/dashboard/gc-contacts",        roles: ["owner", "estimator", "pm"] },

  // Finance.
  { prefix: "/dashboard/job-cost",           roles: ["owner", "estimator", "pm", "accounting"] },
  { prefix: "/dashboard/billing",            roles: ["owner", "pm", "accounting"] },

  // Admin.
  { prefix: "/dashboard/worker",             roles: ["owner", "estimator", "pm", "foreman", "qc", "accounting"] },
  { prefix: "/dashboard/users",              roles: ["owner"] },
  { prefix: "/dashboard/audit-log",          roles: ["owner", "pm", "accounting"] },
  { prefix: "/dashboard/integrations",       roles: ["owner", "pm"] },
  { prefix: "/dashboard/pricing",            roles: ["owner"] },

  // Dashboard root (everyone except worker — kept last so longer prefixes match first).
  { prefix: "/dashboard",                    roles: ["owner", "estimator", "pm", "foreman", "qc", "accounting"] },
];

/** Resolve which roles can visit a path. Longest matching prefix wins. */
export function rolesForPath(path: string): Role[] | null {
  let best: { len: number; roles: Role[] } | null = null;
  for (const entry of ROUTE_ACCESS) {
    if (path === entry.prefix || path.startsWith(entry.prefix + "/")) {
      if (!best || entry.prefix.length > best.len) {
        best = { len: entry.prefix.length, roles: entry.roles };
      }
    }
  }
  return best?.roles ?? null;
}

/** Landing page for a role when they hit a forbidden URL or sign in. */
export function homeForRole(role: string): string {
  return role === "worker" ? "/worker" : "/dashboard";
}
