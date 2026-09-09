// ─── Shipping Utilities ─────────────────────────────────────────────────────
// Pure functions for shipping calculations and business logic.
// No React dependencies — usable in both frontend and tests.

import type {
  LoadTotals,
  LoadReadiness,
  LoadCompleteness,
  ErectionPackageStatus,
  ShippingDashboardKPIs,
  ShippingLoad,
  ShippingLoadItem,
  ShippingAdditionalItem,
  EligibleAssembly,
} from "./shipping-types";

// ─── Load Totals ────────────────────────────────────────────────────────────

export function calculateLoadTotals(
  items: Array<{ weight_lbs: number; quantity: number }>,
  additionalItems: Array<{ weight_lbs: number; quantity: number }>,
  trailerCapacityLbs: number
): LoadTotals {
  const steelWeight = items.reduce((sum, it) => sum + it.weight_lbs * it.quantity, 0);
  const additionalWeight = additionalItems.reduce((sum, it) => sum + it.weight_lbs * it.quantity, 0);
  const netWeight = steelWeight + additionalWeight;
  const remaining = trailerCapacityLbs - netWeight;
  const utilization = trailerCapacityLbs > 0 ? (netWeight / trailerCapacityLbs) * 100 : 0;
  const totalPieces = items.reduce((sum, it) => sum + it.quantity, 0);

  return {
    total_pieces: totalPieces,
    steel_weight_lbs: steelWeight,
    additional_weight_lbs: additionalWeight,
    net_weight_lbs: netWeight,
    trailer_capacity_lbs: trailerCapacityLbs,
    remaining_capacity_lbs: Math.max(0, remaining),
    utilization_pct: Math.round(utilization * 10) / 10,
    is_overweight: netWeight > trailerCapacityLbs,
    is_warning: utilization >= 90 && utilization <= 100,
  };
}

// ─── Ready-to-Ship & KPI Logic ──────────────────────────────────────────────

const READY_STATUSES = ["complete", "shipped", "qc_passed", "painted", "staged"];

export function checkLoadReadiness(items: any[]): { isReady: boolean; warnings: string[] } {
  const warnings: string[] = [];
  if (!items || items.length === 0) {
    return { isReady: true, warnings: [] };
  }
  for (const item of items) {
    if (item.status && !["complete", "shipped", "staged", "loaded", "assigned", "qc_passed"].includes(item.status)) {
      warnings.push(`Item ${item.mark || item.assembly_mark || "part"} status is "${item.status}"`);
    }
  }
  return {
    isReady: warnings.length === 0,
    warnings,
  };
}

export function calculateShippingSummary(loads: ShippingLoad[] = []) {
  let totalWeightLbs = 0;
  let totalPieces = 0;
  let readyCount = 0;
  let readyWeightLbs = 0;
  let shippedCount = 0;
  let deliveredCount = 0;

  for (const load of loads || []) {
    const weight = load.net_weight_lbs || (load as any).total_weight_lbs || 0;
    const pieces = load.total_pieces || 0;

    totalWeightLbs += weight;
    totalPieces += pieces;

    if (load.status === "staged" || load.status === "loaded" || load.status === "assigned" || load.status === "draft") {
      readyCount += 1;
      readyWeightLbs += weight;
    } else if (load.status === "shipped" || load.status === "in_transit") {
      shippedCount += 1;
    } else if (load.status === "received" || load.status === "delivered") {
      deliveredCount += 1;
    }
  }

  return {
    totalWeightLbs,
    totalPieces,
    readyCount,
    readyWeightLbs,
    shippedCount,
    deliveredCount,
  };
}

export function checkReadyToShip(assembly: EligibleAssembly): LoadReadiness {
  const issues: string[] = [];

  const fabrication_complete = assembly.completed_parts >= assembly.total_parts && assembly.total_parts > 0;
  if (!fabrication_complete) issues.push(`Fabrication: ${assembly.completed_parts}/${assembly.total_parts} complete`);

  // For demo simplicity, QC/coating/release are inferred from assembly status
  const qc_complete = READY_STATUSES.includes(assembly.status) || fabrication_complete;
  if (!qc_complete) issues.push("QC not complete");

  const coating_complete = assembly.status !== "in_progress" || fabrication_complete;
  if (!coating_complete) issues.push("Coating not complete");

  const hardware_available = true; // assumed in demo
  const released_for_shipping = fabrication_complete && qc_complete;
  if (!released_for_shipping) issues.push("Not released for shipping");

  const all_ready = fabrication_complete && qc_complete && coating_complete && hardware_available && released_for_shipping;

  return {
    fabrication_complete,
    qc_complete,
    coating_complete,
    hardware_available,
    released_for_shipping,
    all_ready,
    issues,
  };
}

// ─── Load Completeness ──────────────────────────────────────────────────────

export function getLoadCompleteness(
  requiredItems: Array<{ assembly_mark: string; quantity: number; weight_lbs: number }>,
  loadItems: ShippingLoadItem[]
): LoadCompleteness {
  const assignedItems = loadItems.filter((i) => ["assigned", "loaded", "shipped", "received"].includes(i.status));
  const loadedItems = loadItems.filter((i) => ["loaded", "shipped", "received"].includes(i.status));

  const piecesRequired = requiredItems.reduce((s, i) => s + i.quantity, 0);
  const piecesAssigned = assignedItems.reduce((s, i) => s + i.quantity, 0);
  const piecesLoaded = loadedItems.reduce((s, i) => s + i.quantity, 0);

  const weightRequired = requiredItems.reduce((s, i) => s + i.weight_lbs, 0);
  const weightAssigned = assignedItems.reduce((s, i) => s + i.weight_lbs, 0);
  const weightLoaded = loadedItems.reduce((s, i) => s + i.weight_lbs, 0);

  const assignedMarks = new Set(assignedItems.map((i) => i.assembly_mark));
  const missingMarks = requiredItems
    .filter((i) => !assignedMarks.has(i.assembly_mark))
    .map((i) => i.assembly_mark);

  return {
    pieces_required: piecesRequired,
    pieces_assigned: piecesAssigned,
    pieces_loaded: piecesLoaded,
    pieces_remaining: Math.max(0, piecesRequired - piecesAssigned),
    weight_required: weightRequired,
    weight_assigned: weightAssigned,
    weight_loaded: weightLoaded,
    is_complete: piecesAssigned >= piecesRequired && piecesRequired > 0,
    missing_marks: missingMarks,
  };
}

// ─── Erection Package Status ────────────────────────────────────────────────

export function getErectionPackageStatus(
  items: ShippingLoadItem[],
  allLoadItems?: ShippingLoadItem[]
): ErectionPackageStatus {
  const areas = new Set(items.map((i) => i.area).filter(Boolean));
  const levels = new Set(items.map((i) => i.level).filter(Boolean));
  const grids = new Set(items.map((i) => i.grid).filter(Boolean));
  const sequences = new Set(items.map((i) => i.sequence).filter(Boolean));
  const workPackages = new Set(items.map((i) => i.work_package).filter(Boolean));

  const totalPieces = items.reduce((s, i) => s + i.quantity, 0);
  const shippedPieces = items.filter((i) =>
    ["shipped", "received"].includes(i.status)
  ).reduce((s, i) => s + i.quantity, 0);

  const completionPct = totalPieces > 0 ? Math.round((shippedPieces / totalPieces) * 100) : 0;

  const missingMarks = items
    .filter((i) => !["shipped", "received", "loaded"].includes(i.status))
    .map((i) => i.assembly_mark);

  return {
    package_id: null,
    area: areas.size > 1 ? "Multiple Areas" : Array.from(areas)[0] || "—",
    level: levels.size > 1 ? "Multiple Levels" : Array.from(levels)[0] || null,
    grid: grids.size > 1 ? "Multiple Grids" : Array.from(grids)[0] || null,
    sequences: sequences.size > 0 ? Array.from(sequences).sort().join("–") : "—",
    work_package: workPackages.size > 1 ? "Multiple" : Array.from(workPackages)[0] || null,
    total_pieces: totalPieces,
    shipped_pieces: shippedPieces,
    completion_pct: completionPct,
    missing_marks: missingMarks,
  };
}

// ─── Ticket Number Generation ───────────────────────────────────────────────

export function generateTicketNumber(
  existingTickets: string[],
  projectPrefix?: string
): string {
  const prefix = projectPrefix ? `${projectPrefix.toUpperCase().slice(0, 3)}-` : "L-";
  let maxNum = 0;

  existingTickets.forEach((t) => {
    const match = t.match(new RegExp(`^${prefix.replace("-", "\\-")}(\\d+)$`));
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > maxNum) maxNum = n;
    }
  });

  return `${prefix}${String(maxNum + 1).padStart(4, "0")}`;
}

export function generateLoadNumber(existingLoads: string[]): string {
  let maxNum = 0;
  existingLoads.forEach((l) => {
    const match = l.match(/^LOAD-(\d+)$/);
    if (match) {
      const n = parseInt(match[1], 10);
      if (n > maxNum) maxNum = n;
    }
  });
  return `LOAD-${String(maxNum + 1).padStart(2, "0")}`;
}

// ─── Dashboard KPIs ─────────────────────────────────────────────────────────

export function computeShippingKPIs(loads: ShippingLoad[]): ShippingDashboardKPIs {
  const today = new Date().toISOString().slice(0, 10);

  const shippedLoads = loads.filter((l) => l.status === "shipped" || l.status === "received");
  const shippedToday = loads.filter(
    (l) => (l.status === "shipped" || l.status === "received") && l.actual_ship_date?.slice(0, 10) === today
  );
  const receivedToday = loads.filter(
    (l) => l.status === "received" && l.actual_arrival_date?.slice(0, 10) === today
  );
  const readyToShip = loads.filter((l) => l.status === "loaded" || l.status === "assigned");

  const totalTons = shippedLoads.reduce((s, l) => s + l.net_weight_lbs, 0) / 2000;
  const totalPieces = shippedLoads.reduce((s, l) => s + l.total_pieces, 0);
  const avgUtil =
    loads.length > 0
      ? loads.reduce((s, l) => s + l.utilization_pct, 0) / loads.length
      : 0;

  return {
    total_loads: loads.length,
    ready_to_ship: readyToShip.length,
    shipped_today: shippedToday.length,
    received_today: receivedToday.length,
    loads_on_hold: loads.filter((l) => l.status === "on_hold").length,
    partial_loads: loads.filter((l) => l.status === "partial").length,
    total_tons_shipped: Math.round(totalTons * 100) / 100,
    total_pieces_shipped: totalPieces,
    avg_utilization_pct: Math.round(avgUtil * 10) / 10,
  };
}

// ─── Format Helpers ─────────────────────────────────────────────────────────

export function formatWeight(lbs: number): string {
  return lbs.toLocaleString("en-US");
}

export function formatTons(lbs: number): string {
  return (lbs / 2000).toFixed(2);
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

export function getUtilizationColor(pct: number): { bg: string; text: string; bar: string } {
  if (pct > 100) return { bg: "#FEF2F2", text: "#DC2626", bar: "#DC2626" };
  if (pct >= 90) return { bg: "#FFFBEB", text: "#D97706", bar: "#F59E0B" };
  if (pct >= 70) return { bg: "#F0FDF4", text: "#16A34A", bar: "#22C55E" };
  return { bg: "#F8FAFC", text: "#0284C7", bar: "#3B82F6" };
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: "Draft",
    assigned: "Assigned",
    loaded: "Loaded",
    shipped: "Shipped",
    received: "Received",
    on_hold: "On Hold",
    partial: "Partial",
    cancelled: "Cancelled",
    available: "Available",
    pending: "Pending",
    in_transit: "In Transit",
    delivered: "Delivered",
  };
  return labels[status] || status;
}
