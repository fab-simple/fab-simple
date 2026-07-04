# Prompt: Erection Operations — Crane/Rigging, Safety Gates, Crew Tracking, Field Tools

## Context
FabSimple, a structural steel fabrication SaaS. Everything built so far treats the erection crew as a recipient of information (scan a tag, see a drawing). A 20+ year erection PM audit found this misses the actual operational and safety-critical decisions an erection team makes every day. This prompt adds that layer, building on top of the existing Erection Sequence and E-plan modules — it does not replace them.

One item in this prompt (Part 8, Erector Portal) is flagged as a bigger architectural decision rather than a straightforward build — read that section's note before implementing it.

---

## Part 1 — Crane and rigging planning

Add to each Erection Step (extends the existing Erection Sequence spec):
- `Crane Assigned` (text/picker if an equipment list exists)
- `Capacity at Radius Required` (number) — the actual lift requirement at the working radius for this pick, not just the piece's raw weight
- `Pick Type` (select: Single / Tandem)
- `Ground Bearing / Mat Requirement` (text/toggle — flag if outrigger mats or ground prep are required at this pick location)
- `Critical Lift` (toggle) — if enabled, require an attached **Engineered Lift Plan** document before this step can be marked ready to execute. Define "critical lift" as configurable per company policy (e.g., over a % of rated capacity, near a hazard, multi-crane pick) rather than hardcoding a single threshold.
- Piece weight and any rigging/pick-point notes continue to pull from Tekla data where available (per the existing Erection Sequence spec) — this section adds the lift-planning layer on top of that existing weight data, it doesn't duplicate it.

---

## Part 2 — OSHA Subpart R hard gates

These function as blocking hold points, the same pattern as the Final Inspection gate in Worker View — a step cannot move to "in progress" without them cleared.

- **Concrete cure certification:** for any step involving column erection onto a concrete foundation, require a logged written certification (per Subpart R's controlling contractor notification requirement) confirming adequate cure strength before the step can start. Block the step otherwise, with a clear message stating why.
- **Perimeter safety cable timing:** track and flag whether perimeter cabling requirements are satisfied relative to erection progress on that level/zone — surface as a warning on any step in an area not yet compliant.
- **Multiple lift rigging documentation:** if a pick is flagged as a multiple lift (per Subpart R's specific rigging requirements), require the applicable rigging documentation attached before that step is marked ready.
- These gates should be configurable in scope (which project types/steps they apply to) but not skippable without an explicit, logged override by an authorized role — same audit-trail principle used elsewhere in this system (no silent bypass).

---

## Part 3 — Site readiness checklist

- Per zone or per step, a simple checklist the Site Super completes before erection can begin in that area:
  - Foundation survey completed and acceptable
  - Anchor bolt layout verified against the erection plan
  - Erection zone clear of other trades/obstructions
- This checklist gates the zone's steps the same way Part 2's safety items gate individual picks — incomplete checklist, step stays blocked, with the specific unmet item visible.

---

## Part 4 — Weather and delay log

- Log entries: `Type` (Wind Hold / Lightning Hold / Other Weather / Other Delay), `Start Time`, `End Time` (or ongoing), `Steps/Zone Affected`, `Notes`
- Auto-calculate delay duration and roll it into the Schedule Health section of the Project Module (per the existing Projects prompt) — a weather hold should visibly push at-risk/late flags rather than silently eating into schedule buffer unnoticed.
- This log is the record a PM needs to support a schedule-impact or delay claim discussion with the GC — make it exportable by date range/project.

---

## Part 5 — Field bolt-up inspection (RCSC)

- Distinct from the shop's AISC 303 QC (which covers fabrication, not field connections). Add a field connection inspection record per slip-critical connection:
  - `Inspection Method` (select: Turn-of-Nut / Calibrated Wrench / Direct Tension Indicator / Other)
  - `Result` (Pass / Fail / Needs Rework)
  - `Inspector` (identity + timestamp, same auto-fill-from-session pattern as Worker View)
- Tie this record to the specific connection/piece mark, not just a generic "bolted" status flag — this is the erection-side equivalent of the shop's Weld QC sign-off, and should appear in that piece's Traveler record alongside its shop-side history.

---

## Part 6 — Crew tracking

- Add a `Crew` entity: crew name/number, foreman, list of members, assigned equipment.
- Daily production should be loggable **by crew**, not just by individual scan — e.g., "Crew 2 erected 14 pieces on [date]." This can be an aggregation of individual site-QR install scans grouped under whichever crew was active, rather than a separate manual entry, if scans already capture who's logged in.
- This crew-level daily total feeds into progress billing support and schedule tracking — an erection PM needs this number daily, not reconstructed later from individual scan logs.

---

## Part 7 — Field lift replanning tools

- Give the Site Super/Foreman a working view of today's/this week's planned steps with the ability to reorder or reassign them directly (crane repositioning, a piece not ready, access changes) — not just deviate from a fixed plan and log a reason after the fact.
- Any reordering should still log what changed and why (extends the existing override-logging concept), but the primary experience should be "let me adjust my plan," not "let me explain why I broke the plan."

---

## Part 8 — Closeout punch list

- Punch list entity per project: `Description`, `Location` (tied to a grid reference/piece mark where applicable), `Responsible Party`, `Status` (Open/Complete), `Photo`.
- Should be reviewable and exportable as part of project closeout documentation, alongside the as-built E-plan set and full heat-traceability export already specified elsewhere.

---

## Part 9 — Erector Portal (architectural decision — read before building)

**Note before implementing:** many erection crews are independent subcontractors working across multiple different fabricators, not employees of the fabricator running this software. A full solution to that reality is a bigger product decision (potentially a separate erector-facing experience usable across multiple fabricator accounts) than a single screen. Scope this part as a **single-tenant solution for v1** — do not attempt cross-fabricator identity or data-sharing in this pass.

- Add a scoped external login role: `Erection Subcontractor`.
- This role sees only: assigned erection steps/sequence, E-plan sheets and grid references relevant to their scope, piece weight/rigging data, the ability to submit field RFIs, and their assigned punch list items.
- This role must **not** see: cost data, procurement/PO information, vendor pricing, internal job costing, or any other project's data outside their assigned scope.
- Flag for later product discussion (not part of this build): whether a longer-term version should let one erection company maintain a consistent portal experience across multiple different fabricators who each use this platform, versus each fabricator relationship requiring a separate login. Do not build this now — just don't architect Part 9 in a way that makes that later possible only through what code with a full rewrite of this system.

---

## Acceptance criteria
- Critical lifts cannot proceed without an attached engineered lift plan; the critical-lift threshold is configurable, not hardcoded.
- Column erection onto concrete cannot start without a logged cure certification; override requires an authorized role and is logged, never silent.
- Site readiness checklist items block zone erection until complete, with the specific unmet item visible to the user.
- Weather/delay entries automatically affect the Project Module's Schedule Health status and are exportable by date range.
- Field bolt-up inspections are recorded per connection with method, result, and inspector identity, and appear on the piece's Traveler record alongside shop-side QC history.
- Daily crew production totals are available without manual reconstruction from individual scans.
- Site Super/Foreman can proactively reorder planned steps, with changes logged automatically.
- A punch list exists per project, tied to location where applicable, and is exportable at closeout.
- Erector Portal role sees only its scoped operational data and never sees cost, procurement, or other-project information; this part is explicitly scoped to single-tenant use for this build.