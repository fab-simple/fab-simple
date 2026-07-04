# Prompt: Heat Numbers Module — Final Spec (Automated Capture + Governed Manual Entry)

## Context
FabSimple, a structural steel fabrication SaaS, built for US structural steel fabricators generally — varying in size, certification level, and how much of the platform (Receiving, Worker View) they've adopted at any given time. Heat Numbers must primarily be a system-populated traceability ledger, not a manual form — but manual entry can't be removed outright, because real shops have legitimate cases where it's needed (a shop not yet using digital Receiving, a correction, historical/legacy data, field-added material). The right design keeps both paths, but makes them **visibly, structurally different** in trust level — never presenting a manually typed number with the same confidence as one captured through a verified barcode scan or CMTR cross-check.

---

## Part 1 — Data model: one ledger, multiple sources

Every heat number record carries a `Source` field and a `Verification Level` field. Do not build separate tables for automated vs. manual records — one ledger, tagged by how each entry got there.

**`Source` values:**
- `Receiving — Barcode Scan`
- `Receiving — Manual Dual-Entry`
- `Worker View — Cutting Transfer` (inherited, not newly entered — see Part 3)
- `Manual Entry` (direct entry into this module — see Part 4)
- `Legacy Import` (pre-existing data migrated in — see Part 5)

**`Verification Level` values, derived from Source:**
- `Verified` — Receiving via barcode scan with physical confirmation, or CMTR-matched dual-entry
- `Confirmed — Unverified Document` — dual-entry completed but no CMTR was cross-matched (e.g., document not yet available at time of receiving)
- `Manual — Unverified` — entered directly into this module or via legacy import, no CMTR match, no photo evidence
- Every heat number record displays its Verification Level prominently, with distinct visual treatment (e.g., a green "Verified" badge vs. an amber "Unverified" badge) everywhere it's referenced — this module, the piece Traveler, shipping tags, compliance exports.

---

## Part 2 — Primary path: Material Receiving (unchanged from existing spec)

- Restates the existing Receiving spec for continuity: vendor barcode scan (preferred) or manual dual-entry with mandatory photo, cross-checked against an uploaded CMTR.
- This is the intended default path for any shop using the Receiving module and should be promoted as such in-product (e.g., don't surface a prominent "Add Heat Number" button on the Heat Numbers screen itself — push users toward Receiving for new material).

---

## Part 3 — Automated path: Worker View Cutting stage

- When a piece is cut from a tagged raw material lot, the heat number transfers onto that piece mark's Traveler automatically (per the existing Cutting stage spec) — no re-entry, `Source = Worker View — Cutting Transfer`, inheriting the Verification Level of the parent lot it was cut from.

---

## Part 4 — Governed manual entry (new — this is what makes the module usable for every shop, not just fully digitized ones)

Manual entry remains available, but is deliberately friction-heavier than the automated paths and gated:

- **Role restriction:** only PM, Shop Foreman, or QC roles can create a manual heat number record — not open to every user.
- **Required reason code** on every manual entry: e.g., "Shop not using digital Receiving for this material," "Correction to existing record," "Field-added/customer-supplied material," "Other — explain." Free-text explanation required if "Other."
- **Same double-entry-plus-photo discipline as Receiving's manual path** — blind re-entry confirmation of the heat number, required photo of the physical stamp/marking, optional CMTR upload (if uploaded and matched, elevate Verification Level to `Confirmed — Unverified Document` rather than leaving it at `Manual — Unverified`).
- **Corrections to existing records** (rather than new entries) must be logged as a new audit entry showing old value → new value → who → when → reason — never a silent overwrite, regardless of who's making the correction.
- Manual entries are fully usable throughout the system (can be linked to piece marks, appear in traceability views, included in exports) — they are not second-class data, just clearly labeled as lower-verification data so nobody downstream mistakes a typed-in number for a scanned/CMTR-matched one.

---

## Part 5 — Legacy data migration

- If a company has existing heat number data from a prior manual-only system, import it with `Source = Legacy Import` and `Verification Level = Manual — Unverified` by default, regardless of how confident the original data entry felt at the time — the system has no way to verify it retroactively, and shouldn't imply otherwise.
- Provide an optional "Re-verify" action per legacy record: if a CMTR can be located and uploaded after the fact, allow upgrading that record's Verification Level to `Confirmed — Unverified Document` or `Verified` (if a matching physical re-check is also logged) — this lets a shop gradually clean up historical data without a forced bulk migration project.

---

## Part 6 — Forward and backward traceability views

- **Forward (heat number → pieces):** search or select a heat number, see source lot details (grade, shape, quantity, linked PO/vendor if applicable, CMTR/compliance docs, Verification Level, Source), and every piece mark it was consumed into across any project.
- **Backward (piece mark → heat):** one click from a piece's Traveler record into this module's detail view for its heat number.

---

## Part 7 — Compliance export

- One-click "Export Traceability Report," scoped by project or date range: lists every heat number used, its Source and Verification Level, CMTR/compliance doc references, and every piece mark it produced.
- Reports must clearly distinguish Verified vs. Confirmed vs. Manual-Unverified entries in the export itself — never present a blended list that hides which records have weaker evidence behind them. An auditor or GC reviewing this should be able to see exactly which pieces have full mill-to-piece documentation and which don't, at a glance.

---

## Part 8 — Discrepancy and correction visibility

- Any receiving-time CMTR mismatch flag, any manual correction, and any legacy re-verification action must remain permanently visible in that heat number's history — this module is the audit trail, not just the current-state to show.

---

## Acceptance criteria
- All heat number records live in one ledger with `Source` and `Verification Level` fields — no separate manual vs. automated tables.
- Receiving and Worker View Cutting remain the primary, encouraged paths; manual entry exists but requires elevated role permission, a reason code, and the same double-entry-plus-photo discipline as Receiving's manual path.
- Every record's Verification Level is visibly displayed everywhere that heat number is referenced across the platform, not just within this module.
- Corrections to existing records always create a visible audit trail entry (old value, new value, who, when, reason) — never a silent overwrite.
- Legacy imported data defaults to `Manual — Unverified` and supports an optional re-verification upgrade path.
- Forward and backward traceability views work identically regardless of a record's Source or Verification Level.
- Compliance exports clearly separate Verified, Confirmed, and Manual-Unverified records rather than presenting them uniformly.