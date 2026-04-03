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
} from "lucide-react";

export interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number | string }>;
  badge?: string;
  badgeClass?: string;
  section?: string;
  roles?: string[];
}

export const NAV_SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [
      { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { key: "live-activity", label: "Live Activity", href: "/dashboard/live-activity", icon: Activity },
    ],
  },
  {
    label: "Projects",
    items: [
      { key: "projects", label: "Projects", href: "/dashboard/projects", icon: FolderKanban },
      { key: "estimating", label: "Estimating", href: "/dashboard/estimating", icon: Calculator, roles: ["owner", "estimator", "pm", "accounting"] },
      { key: "change-orders", label: "Change Orders & RFI", href: "/dashboard/change-orders", icon: FileDiff },
      { key: "drawings", label: "Drawing Log", href: "/dashboard/drawings", icon: FileText },
    ],
  },
  {
    label: "Production",
    items: [
      { key: "parts", label: "Parts List", href: "/dashboard/parts", icon: ListChecks },
      { key: "assemblies", label: "Assemblies", href: "/dashboard/assemblies", icon: Layers },
      { key: "daily-log", label: "Daily Production Log", href: "/dashboard/daily-log", icon: ClipboardList },
      { key: "import", label: "Import / Tekla CSV", href: "/dashboard/import", icon: Upload },
    ],
  },
  {
    label: "Procurement",
    items: [
      { key: "purchase-orders", label: "Purchase Orders", href: "/dashboard/purchase-orders", icon: ShoppingCart },
      { key: "receiving", label: "Material Receiving", href: "/dashboard/receiving", icon: PackageCheck, badge: "1", badgeClass: "bg-amber-500 text-white" },
      { key: "inventory", label: "Inventory", href: "/dashboard/inventory", icon: Warehouse },
      { key: "heat-numbers", label: "Heat Numbers", href: "/dashboard/heat-numbers", icon: FlameKindling },
    ],
  },
  {
    label: "Quality & Compliance",
    items: [
      { key: "paint-inspection", label: "Paint Inspection", href: "/dashboard/paint-inspection", icon: PaintBucket },
      { key: "weld-log", label: "AWS Weld Log", href: "/dashboard/weld-log", icon: Hammer },
      { key: "aisc", label: "AISC 303 QC", href: "/dashboard/aisc", icon: ShieldCheck, badge: "2", badgeClass: "bg-red-600 text-white" },
      { key: "osha", label: "OSHA Checklist", href: "/dashboard/osha", icon: AlertTriangle, badge: "1", badgeClass: "bg-red-600 text-white" },
      { key: "certifications", label: "Certifications", href: "/dashboard/certifications", icon: Award, badge: "2", badgeClass: "bg-amber-500 text-white" },
    ],
  },
  {
    label: "Logistics",
    items: [
      { key: "erection", label: "Erection Sequence", href: "/dashboard/erection", icon: ArrowUpDown },
      { key: "shipping", label: "Shipping Tickets", href: "/dashboard/shipping", icon: Truck },
      { key: "qr-codes", label: "QR Codes", href: "/dashboard/qr-codes", icon: QrCode },
      { key: "gc-contacts", label: "GC Contacts", href: "/dashboard/gc-contacts", icon: Phone },
    ],
  },
  {
    label: "Finance",
    items: [
      { key: "job-cost", label: "Job Cost Tracker", href: "/dashboard/job-cost", icon: DollarSign, roles: ["owner", "estimator", "pm", "accounting"] },
      { key: "billing", label: "AIA G702 Billing", href: "/dashboard/billing", icon: CreditCard, roles: ["owner", "pm", "accounting"] },
    ],
  },
  {
    label: "Admin",
    items: [
      { key: "worker", label: "Worker View", href: "/dashboard/worker", icon: Smartphone },
      { key: "users", label: "Users & Roles", href: "/dashboard/users", icon: Users, roles: ["owner"] },
      { key: "integrations", label: "Integrations", href: "/dashboard/integrations", icon: Plug },
      { key: "pricing", label: "Pricing", href: "/dashboard/pricing", icon: Tag },
    ],
  },
];
