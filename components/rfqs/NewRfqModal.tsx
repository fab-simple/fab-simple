"use client";

import { useState, useEffect, useMemo } from "react";
import { ResourceModal, Field } from "@/components/ui/ResourceModal";
import { useResourceList, useCreateRfq, useFulfillMrFromInventory } from "@/hooks/useResource";
import { PackageCheck, CheckCircle2, Building2, ChevronDown, ChevronUp, Layers } from "lucide-react";

interface MaterialRequirement {
  id: string;
  mr_number: string;
  profile: string;
  name: string | null;
  grade: string | null;
  quantity: number;
  length: string | null;
  project_id: string;
  status: string;
  notes?: string | null;
}

interface Inv {
  id: string;
  profile: string;
  grade: string | null;
  length: string | null;
  quantity: number;
  status: string;
}

interface InvReservation {
  id: string;
  inventory_id: string;
  quantity: number;
  status: string;
}

interface Vendor {
  id: string;
  name: string;
  status: string;
}

interface Project {
  id: string;
  name: string;
  number?: string;
}

// Normalise matching key for grouping open MRs across projects by profile, grade, length
export function mrClubKey(profile: string, grade: string | null | undefined, length: string | null | undefined): string {
  return [
    (profile ?? "").trim().toLowerCase(),
    (grade ?? "").trim().toLowerCase(),
    (length ?? "").trim().toLowerCase(),
  ].join("::");
}

// Key for looking up bulk inventory matching profile + length
function invKey(profile: string, length: string | null | undefined): string {
  return [(profile ?? "").trim().toLowerCase(), (length ?? "").trim().toLowerCase()].join("::");
}

/**
 * Apportions a discrete whole-number entered quantity across constituent MRs.
 * Ensures each created line has a positive integer quantity and the total sum
 * matches the user's entered discrete quantity.
 */
export function apportionClubbedQuantity(
  constituentMrs: { id: string; quantity: number }[],
  totalEnteredQty: number,
): { material_requirement_id: string; quantity: number }[] {
  const enteredQty = Math.round(totalEnteredQty);
  if (enteredQty <= 0 || constituentMrs.length === 0) return [];

  const totalReq = constituentMrs.reduce((acc, m) => acc + (Number(m.quantity) || 0), 0);
  let remaining = enteredQty;
  const lines: { material_requirement_id: string; quantity: number }[] = [];

  constituentMrs.forEach((mr, idx) => {
    if (idx === constituentMrs.length - 1) {
      const q = Math.max(0, remaining);
      if (q > 0) {
        lines.push({ material_requirement_id: mr.id, quantity: q });
      }
    } else {
      const ratio = totalReq > 0 ? mr.quantity / totalReq : 1 / constituentMrs.length;
      const q = Math.min(remaining, Math.max(0, Math.round(enteredQty * ratio)));
      remaining -= q;
      if (q > 0) {
        lines.push({ material_requirement_id: mr.id, quantity: q });
      }
    }
  });

  return lines;
}

export interface ClubbedMrGroup {
  key: string;
  profile: string;
  grade: string | null;
  length: string | null;
  name: string | null;
  totalQuantity: number;
  stockCovered: number;
  defaultNetQuantity: number;
  mrs: MaterialRequirement[];
}

export interface NewRfqModalProps {
  initialSelectedMrIds?: string[];
  onClose: () => void;
  onSuccess: (rfqId: string) => void;
}

export function NewRfqModal({
  initialSelectedMrIds,
  onClose,
  onSuccess,
}: NewRfqModalProps) {
  const createRfq = useCreateRfq();
  const fulfill = useFulfillMrFromInventory();

  // Company-wide open material requirements across all active projects
  const mrs = useResourceList<MaterialRequirement>("material_requirements", {
    status: "open",
    order_by: "created_at",
    dir: "desc",
    per_page: 200,
  });

  const vendors = useResourceList<Vendor>("vendors", {
    status: "active",
    order_by: "name",
    dir: "asc",
    limit: "200",
  });

  const projects = useResourceList<Project>("projects", { limit: "200" });
  const inventory = useResourceList<Inv>("inventory", { per_page: 200 });
  const invReservations = useResourceList<InvReservation>("inventory_reservations", {
    status: "active",
    per_page: 500,
  });

  const projectLookup = useMemo(
    () => new Map((projects.data ?? []).map((p) => [p.id, p])),
    [projects.data],
  );

  // Map: inventory_id → total qty reserved by other active RFQs
  const reservedByInvId = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of invReservations.data ?? []) {
      map.set(r.inventory_id, (map.get(r.inventory_id) ?? 0) + Number(r.quantity));
    }
    return map;
  }, [invReservations.data]);

  // Lookup available stock by profile + length
  const inventoryLookup = useMemo(() => {
    const map = new Map<string, { available: number; inventoryId: string }>();
    for (const inv of inventory.data ?? []) {
      const reserved = reservedByInvId.get(inv.id) ?? 0;
      const available = Math.max(0, Number(inv.quantity) - reserved);
      if (available <= 0) continue;
      const k = invKey(inv.profile, inv.length);
      const existing = map.get(k);
      if (!existing || available > existing.available) {
        map.set(k, { available, inventoryId: inv.id });
      }
    }
    return map;
  }, [inventory.data, reservedByInvId]);

  // Club open MRs across projects based on profile, grade, and length
  const clubbedGroups = useMemo(() => {
    const openMrs = mrs.data ?? [];
    const map = new Map<string, MaterialRequirement[]>();

    for (const mr of openMrs) {
      const k = mrClubKey(mr.profile, mr.grade, mr.length);
      const list = map.get(k);
      if (list) list.push(mr);
      else map.set(k, [mr]);
    }

    const result: ClubbedMrGroup[] = [];
    for (const [key, groupMrs] of map.entries()) {
      const first = groupMrs[0];
      const totalQty = Math.round(groupMrs.reduce((acc, m) => acc + Number(m.quantity || 0), 0));
      const iKey = invKey(first.profile, first.length);
      const availableStock = Math.round(inventoryLookup.get(iKey)?.available ?? 0);
      const stockCovered = Math.min(totalQty, availableStock);
      const defaultNet = Math.max(0, totalQty - stockCovered);
      const firstName = groupMrs.find((m) => m.name?.trim())?.name ?? null;

      result.push({
        key,
        profile: first.profile,
        grade: first.grade || null,
        length: first.length || null,
        name: firstName,
        totalQuantity: totalQty,
        stockCovered,
        defaultNetQuantity: defaultNet,
        mrs: groupMrs,
      });
    }

    return result.sort((a, b) =>
      a.profile.localeCompare(b.profile) ||
      (a.grade ?? "").localeCompare(b.grade ?? "") ||
      (a.length ?? "").localeCompare(b.length ?? ""),
    );
  }, [mrs.data, inventoryLookup]);

  // State: selected group keys and entered quantities
  const [selectedGroupKeys, setSelectedGroupKeys] = useState<Set<string>>(new Set());
  const [groupQuantities, setGroupQuantities] = useState<Record<string, string>>({});
  const [selectedVendors, setSelectedVendors] = useState<Set<string>>(new Set());
  const [fulfillQueue, setFulfillQueue] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const [deliveryRequirement, setDeliveryRequirement] = useState("");
  const [notes, setNotes] = useState("");

  // Pre-select initial groups or all open groups once data loads
  useEffect(() => {
    if (clubbedGroups.length > 0 && Object.keys(groupQuantities).length === 0) {
      const newSelected = new Set<string>();
      const newQtys: Record<string, string> = {};

      for (const group of clubbedGroups) {
        const isTargeted =
          !initialSelectedMrIds ||
          initialSelectedMrIds.length === 0 ||
          group.mrs.some((m) => initialSelectedMrIds.includes(m.id));

        if (isTargeted) {
          newSelected.add(group.key);
        }
        newQtys[group.key] = String(Math.round(group.defaultNetQuantity));
      }

      setSelectedGroupKeys(newSelected);
      setGroupQuantities(newQtys);
    }
  }, [clubbedGroups, initialSelectedMrIds]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleGroup(key: string) {
    setSelectedGroupKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setFulfillQueue((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  function toggleExpand(key: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleFulfillQueue(group: ClubbedMrGroup) {
    setFulfillQueue((prev) => {
      const next = new Set(prev);
      if (next.has(group.key)) next.delete(group.key);
      else next.add(group.key);
      return next;
    });
    setSelectedGroupKeys((prev) => {
      const next = new Set(prev);
      next.delete(group.key);
      return next;
    });
  }

  function toggleVendor(id: string) {
    setSelectedVendors((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allGroupsSelected =
    clubbedGroups.length > 0 &&
    clubbedGroups.every((g) => selectedGroupKeys.has(g.key));

  function toggleAllGroups() {
    if (allGroupsSelected) {
      setSelectedGroupKeys(new Set());
    } else {
      const allKeys = new Set(clubbedGroups.map((g) => g.key));
      setSelectedGroupKeys(allKeys);
      setGroupQuantities((prev) => {
        const next = { ...prev };
        for (const g of clubbedGroups) {
          if (!(g.key in next)) next[g.key] = String(Math.round(g.defaultNetQuantity));
        }
        return next;
      });
    }
  }

  // Count total constituent MRs included in selected clubbed groups
  const totalConstituentMrsCount = useMemo(() => {
    let count = 0;
    for (const key of selectedGroupKeys) {
      const g = clubbedGroups.find((x) => x.key === key);
      if (g) count += g.mrs.length;
    }
    return count;
  }, [selectedGroupKeys, clubbedGroups]);

  const fulfillQueueCount = fulfillQueue.size;
  const hasValidQuantity = useMemo(() => {
    return Array.from(selectedGroupKeys).some((k) => {
      const qty = parseInt(groupQuantities[k] || "0", 10);
      return !isNaN(qty) && qty > 0;
    });
  }, [selectedGroupKeys, groupQuantities]);

  const rfqInvalid =
    (selectedGroupKeys.size === 0 && fulfillQueueCount === 0) ||
    (selectedGroupKeys.size > 0 && selectedVendors.size === 0) ||
    (selectedGroupKeys.size > 0 && !hasValidQuantity);
  const submitting = createRfq.isPending;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rfqInvalid) return;

    // Apportion group entered quantity proportionately across each constituent MR
    const linesToCreate: { material_requirement_id: string; quantity: number }[] = [];

    for (const groupKey of selectedGroupKeys) {
      const group = clubbedGroups.find((g) => g.key === groupKey);
      if (!group) continue;

      const enteredQty = parseInt(groupQuantities[groupKey] || "0", 10);
      if (isNaN(enteredQty) || enteredQty <= 0) continue;

      const lines = apportionClubbedQuantity(group.mrs, enteredQty);
      linesToCreate.push(...lines);
    }

    createRfq.mutate(
      {
        delivery_requirement: deliveryRequirement || undefined,
        notes: notes || undefined,
        lines: linesToCreate,
        vendor_ids: Array.from(selectedVendors),
      },
      {
        onSuccess: async (res) => {
          // Process any items queued for direct stock fulfillment
          const fulfillPromises = Array.from(fulfillQueue).flatMap((groupKey) => {
            const group = clubbedGroups.find((g) => g.key === groupKey);
            if (!group) return [];
            const inv = inventoryLookup.get(invKey(group.profile, group.length));
            if (!inv) return [];
            return group.mrs.map((mr) =>
              fulfill.mutateAsync({
                mrId: mr.id,
                inventoryId: inv.inventoryId,
                quantity: mr.quantity,
                projectId: mr.project_id,
              }),
            );
          });

          if (fulfillPromises.length > 0) {
            await Promise.allSettled(fulfillPromises);
          }

          onSuccess(res.rfq.id);
        },
      },
    );
  }

  return (
    <ResourceModal
      title="New RFQ"
      onClose={onClose}
      submitting={submitting}
      error={createRfq.error?.message ?? null}
      submitDisabled={rfqInvalid}
      submitLabel={
        fulfillQueueCount > 0
          ? `Save RFQ + Fulfill ${fulfillQueueCount} Stock Items`
          : `Save RFQ (${linesToCreateCount(selectedGroupKeys, clubbedGroups, groupQuantities)} lines)`
      }
      width={680}
      onSubmit={handleSubmit}
    >
      <Field
        label={`Material Requirements (${selectedGroupKeys.size} clubbed item${selectedGroupKeys.size === 1 ? "" : "s"} · ${totalConstituentMrsCount} MRs across projects${fulfillQueueCount > 0 ? ` · ${fulfillQueueCount} fulfill from stock` : ""})`}
        required
      >
        <div className="rounded-lg border" style={{ borderColor: "var(--border)", maxHeight: 360, overflowY: "auto" }}>
          {clubbedGroups.length === 0 && (
            <div className="text-[12px] p-3" style={{ color: "var(--muted)" }}>
              No open material requirements. Upload parts for an active project to auto-generate requirements.
            </div>
          )}

          {clubbedGroups.length > 0 && (
            <div
              className="flex items-center justify-between px-3 py-2 text-[12px] font-medium"
              style={{ borderBottom: "1px solid var(--border)", background: "var(--bg-subtle, rgba(0,0,0,0.03))" }}
            >
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" checked={allGroupsSelected} onChange={toggleAllGroups} />
                <span>Select all requirements</span>
              </label>
              <span className="text-[11px]" style={{ color: "var(--muted)" }}>
                Clubbed across projects by profile + grade + length
              </span>
            </div>
          )}

          {clubbedGroups.map((group) => {
            const covered = group.stockCovered;
            const fullyCovered = covered > 0 && group.defaultNetQuantity === 0;
            const partiallyCovered = covered > 0 && group.defaultNetQuantity > 0;
            const isSelected = selectedGroupKeys.has(group.key);
            const isQueued = fulfillQueue.has(group.key);
            const isExpanded = expandedGroups.has(group.key);
            const hasMultipleProjects = group.mrs.length > 1;

            const Wrapper = fullyCovered && !isSelected ? "div" : "label";

            return (
              <div
                key={group.key}
                style={{
                  borderBottom: "1px solid var(--border)",
                  background: isQueued
                    ? "rgba(79,70,229,0.06)"
                    : fullyCovered
                      ? "rgba(16,185,129,0.04)"
                      : undefined,
                }}
              >
                <Wrapper
                  className="flex items-start gap-2.5 px-3 py-2.5 text-[12px]"
                  style={{
                    cursor: fullyCovered && !isSelected ? "default" : "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleGroup(group.key)}
                    style={{ marginTop: 3, flexShrink: 0 }}
                  />

                  <div className="flex-1 min-w-0">
                    {/* Header: Profile, Grade, Length, Description */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-[13px]" style={{ color: "var(--text)" }}>
                        {group.profile}
                      </span>
                      {group.grade && (
                        <span className="pill font-semibold" style={{ padding: "0 6px", fontSize: 10 }}>
                          {group.grade}
                        </span>
                      )}
                      {group.length && (
                        <span className="font-mono text-[12px]" style={{ color: "var(--text)" }}>
                          · {group.length}
                        </span>
                      )}
                      {group.name && (
                        <span className="text-[12px]" style={{ color: "var(--muted)" }}>
                          ({group.name})
                        </span>
                      )}
                    </div>

                    {/* Contributing Projects Breakdown */}
                    <div className="mt-1 flex items-center gap-1.5 flex-wrap text-[11.5px]">
                      <span className="font-semibold" style={{ color: "var(--primary)" }}>
                        {hasMultipleProjects ? `${group.mrs.length} Projects Clubbed:` : "Project:"}
                      </span>
                      {group.mrs.map((mr) => {
                        const p = projectLookup.get(mr.project_id);
                        const pName = p?.name ?? mr.project_id.slice(0, 8);
                        return (
                          <span
                            key={mr.id}
                            className="pill inline-flex items-center gap-1"
                            style={{
                              fontSize: 11,
                              padding: "1px 6px",
                              background: "var(--bg-muted)",
                              border: "1px solid var(--border)",
                            }}
                          >
                            <Building2 size={10} style={{ color: "var(--muted)" }} />
                            <span>{pName}</span>
                            <strong className="font-mono" style={{ color: "var(--text)" }}>({mr.quantity})</strong>
                          </span>
                        );
                      })}
                      <span className="text-[11px] font-medium" style={{ color: "var(--muted)" }}>
                        · Total: <strong style={{ color: "var(--text)" }}>{group.totalQuantity} required</strong>
                      </span>

                      {hasMultipleProjects && (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          style={{ padding: "0 4px", height: 18, fontSize: 10, color: "var(--primary)" }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleExpand(group.key);
                          }}
                        >
                          {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                          <span>{isExpanded ? "Hide marks" : "View MR marks"}</span>
                        </button>
                      )}
                    </div>

                    {/* Stock netting indicators */}
                    {isQueued && (
                      <div className="flex items-center gap-1 text-[11px] mt-1 font-medium" style={{ color: "var(--primary)" }}>
                        <PackageCheck size={11} />
                        Will be fulfilled from inventory stock when RFQ is saved
                      </div>
                    )}
                    {!isQueued && fullyCovered && (
                      <div className="text-[11px] mt-1 font-medium" style={{ color: "#10B981" }}>
                        ✓ Fully covered by stock ({covered} in inventory)
                        {isSelected ? " — uncheck to skip RFQ" : ""}
                      </div>
                    )}
                    {partiallyCovered && !isQueued && (
                      <div className="text-[11px] mt-1 font-medium" style={{ color: "#F59E0B" }}>
                        ⚡ {covered} in inventory · shopping net {group.defaultNetQuantity} of {group.totalQuantity} required
                      </div>
                    )}
                  </div>

                  {/* Right side: Apportioned / Total Order Qty Input or Fulfill Button */}
                  <div className="flex flex-col items-end gap-1" style={{ flexShrink: 0 }}>
                    {isSelected && (
                      <>
                        <input
                          className="input font-mono"
                          type="number"
                          min="1"
                          step="1"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          placeholder="0"
                          style={{ width: 84, height: 26, fontSize: 11, textAlign: "right" }}
                          value={groupQuantities[group.key] ?? ""}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === "." || e.key === "," || e.key === "e" || e.key === "E" || e.key === "-" || e.key === "+") {
                              e.preventDefault();
                            }
                          }}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, "");
                            setGroupQuantities((prev) => ({ ...prev, [group.key]: val }));
                          }}
                        />
                        <span className="text-[10px]" style={{ color: "var(--muted)" }}>
                          of {group.totalQuantity} req.
                        </span>
                      </>
                    )}

                    {fullyCovered && !isSelected && (
                      <button
                        type="button"
                        className={`btn btn-sm${isQueued ? " btn-primary" : ""}`}
                        style={{ fontSize: 10, height: 24, padding: "0 8px", whiteSpace: "nowrap" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFulfillQueue(group);
                        }}
                        title={
                          isQueued
                            ? "Click to remove from fulfillment queue"
                            : "Mark to fulfill from existing inventory stock when RFQ is saved"
                        }
                      >
                        {isQueued ? (
                          <>
                            <CheckCircle2 size={10} /> Queued
                          </>
                        ) : (
                          <>
                            <PackageCheck size={10} /> Fulfill from Stock
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </Wrapper>

                {/* Expanded details: Individual constituent MR numbers and part marks */}
                {isExpanded && (
                  <div
                    className="px-4 py-2 border-t text-[11.5px]"
                    style={{ background: "var(--bg-muted)", borderColor: "var(--border)" }}
                  >
                    <div className="font-semibold text-[11px] uppercase tracking-wider mb-1" style={{ color: "var(--muted)" }}>
                      Constituent Requirements Breakdown
                    </div>
                    <div className="space-y-1">
                      {group.mrs.map((mr) => {
                        const p = projectLookup.get(mr.project_id);
                        return (
                          <div key={mr.id} className="flex items-center justify-between gap-2 py-0.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-semibold">{mr.mr_number}</span>
                              <span style={{ color: "var(--muted)" }}>—</span>
                              <span>{p?.name ?? mr.project_id.slice(0, 8)}</span>
                              {mr.notes && (
                                <span className="text-[11px]" style={{ color: "var(--muted)" }}>
                                  ({mr.notes})
                                </span>
                              )}
                            </div>
                            <span className="font-mono font-medium">{mr.quantity} units</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {(inventory.isLoading || invReservations.isLoading) && (
          <div className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
            ⏳ Loading inventory for stock netting…
          </div>
        )}

        {fulfillQueueCount > 0 && (
          <div className="text-[11px] mt-1.5 flex items-center gap-1" style={{ color: "var(--primary)" }}>
            <PackageCheck size={11} />
            {fulfillQueueCount} clubbed item{fulfillQueueCount > 1 ? "s" : ""} will be fulfilled directly from inventory
          </div>
        )}
      </Field>

      <Field label={`Vendors to invite (${selectedVendors.size} selected)`} required>
        <div className="rounded-lg border" style={{ borderColor: "var(--border)", maxHeight: 150, overflowY: "auto" }}>
          {(vendors.data ?? []).map((v) => (
            <label key={v.id} className="flex items-center gap-2 px-3 py-2 text-[12px]" style={{ borderBottom: "1px solid var(--border)" }}>
              <input type="checkbox" checked={selectedVendors.has(v.id)} onChange={() => toggleVendor(v.id)} />
              {v.name}
            </label>
          ))}
        </div>
      </Field>

      <Field label="Delivery requirement">
        <input
          className="input"
          value={deliveryRequirement}
          onChange={(e) => setDeliveryRequirement(e.target.value)}
          placeholder="FOB shop, 4 weeks ARO"
        />
      </Field>

      <Field label="Notes">
        <textarea
          className="input"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          style={{ height: "auto", padding: "8px 12px", resize: "vertical" }}
        />
      </Field>
    </ResourceModal>
  );
}

function linesToCreateCount(
  selectedGroupKeys: Set<string>,
  clubbedGroups: ClubbedMrGroup[],
  groupQuantities: Record<string, string>,
): number {
  let count = 0;
  for (const k of selectedGroupKeys) {
    const g = clubbedGroups.find((x) => x.key === k);
    const qty = parseInt(groupQuantities[k] || "0", 10);
    if (g && !isNaN(qty) && qty > 0) {
      const lines = apportionClubbedQuantity(g.mrs, qty);
      count += lines.length;
    }
  }
  return count;
}
