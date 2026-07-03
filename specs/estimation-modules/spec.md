# Prompt: Rebuild Estimating module + Award-to-Project flow

## Context
This is FabSimple, a structural steel fabrication SaaS. The current "New Estimate" modal only calculates `tons × $/ton × margin%`, which doesn't reflect how steel estimators actually price a job (material by shape, labor by connection complexity, freight, paint). Rebuild the modal into a real estimating tool, and wire the "Award" action so a won estimate becomes a Project with its own job number.

---

## Part 1 — Redesign the "New Estimate" modal

Keep the existing modal shell (header, Cancel/Save footer) but replace the body with the sections below, in this order. Use collapsible sections for anything past "Material & Labor" so the modal doesn't feel overwhelming on first load — Bid Info and Material & Labor open by default, the rest collapsed.

### Section: Bid Info
- `Project Name` (text, required) — existing field, keep
- `GC Name` (text) — existing field, keep
- `Architect / EOR` (text, optional)
- `Project Location` (text, optional)
- `Bid Due` (date) — existing field, keep
- `Bid Type` (select: Lump Sum / T&M / Negotiated / Design-Build)
- `Drawing Set Reference` (text or, if Drawing Log module exists, a picker linking to a drawing package + revision)

### Section: Material & Labor (replaces the current Structural Tons / $-per-Ton pair)
Repeating table, one row per shape category:
| Shape | Tons | $ / Ton |
|---|---|---|
| Wide Flange | | |
| HSS / Tube | | |
| Angle | | |
| Plate | | |
| Channel | | |
| Misc Metal | | |

- "Add row" button for custom shape categories
- Auto-sum `Total Tons` and blended `Total Material Cost` displayed read-only below the table
- `Unique Piece Marks` (number, required) — separate field below the table, not derived from tonnage
- `Connection Complexity` (select: Simple Shear / Moment Connections / Mixed / Heavy Misc) — this drives the labor hour suggestion below
- `Detailing Hours` (number, editable — if historical job data exists, pre-fill a suggested value based on tons + complexity and show it as a placeholder/ghost value the estimator can accept or override)
- `Fabrication Hours` (number, same pre-fill behavior)
- `Erection Hours` (number, same pre-fill behavior)
- `Labor Rate ($/hr)` (number, has a sensible shop default, editable)

### Section: Freight & Coatings
- `Freight — Mill to Shop` ($, optional)
- `Freight — Shop to Site` ($, optional)
- `Paint / Coating Required` (toggle) → if on, show `Coating Type` (select: Shop Primer / Full Paint / Galvanized) and `$ / Ton` or `Lump Sum` (radio to pick which)

### Section: Alternates
- Repeating table: `Description`, `Add/Deduct` (select), `Amount ($)`
- "Add alternate" button

### Section: Exclusions & Qualifications
- Multi-line text field, pre-filled from a saved company template (editable per bid)
- "Save as template" button so edits can update the default for future estimates

### Section: Pricing Summary (read-only, calculated)
- Material Total (sum of shape table)
- Labor Total (hours × rate, summed across detailing/fab/erection)
- Freight Total
- Coating Total
- Subtotal
- `Margin %` (number, existing field, keep — default 15)
- `Contingency %` (number, optional, default 0)
- `Total Bid Price` (calculated, large/bold)
- `Total Override ($)` — existing field, keep as-is, with existing helper text "leave blank to auto-calculate." When populated, this value wins over the calculated total but the calculated breakdown above should still display for reference (don't hide it).

### Section: Status & Notes
- `Status` (select) — existing field, keep, but expand options to: Draft / Submitted / Under Review / Won / Lost / Withdrawn
- `Notes` (textarea) — existing field, keep

### Optional but high-value: Comparable Jobs panel
If historical estimate/job data exists in the system, show a read-only side panel (or a bottom section) listing 3–5 past jobs with similar tonnage + connection complexity, showing their final actual cost per ton. Purely reference — no interaction required beyond display.

### Validation rules
- `Project Name` required to save as Draft; `Total Tons` (sum of shape table) and `Unique Piece Marks` required to move status out of Draft
- Won't block save on missing labor/freight fields — estimators may build the bid incrementally

---

## Part 2 — Award-to-Project flow

### Trigger
When `Status` is changed to **Won**, show an inline "Award Project" button (replacing or next to Save). This is a distinct action from just saving the status change.

### On "Award Project" click:
1. Create a new `Project` record.
2. Copy the following fields from the estimate into the new Project as its starting data — do not require re-entry:
   - Project Name, GC Name, Architect/EOR, Project Location
   - Total Tons, Unique Piece Marks
   - Material Total, Labor Total, Freight Total, Coating Total, Total Bid Price (or Total Override if set) — store this full breakdown as the Project's **baseline budget**, feeding directly into Job Cost Tracker later so actuals have something real to compare against, not a single lump number.
   - Drawing Set Reference (if provided)
   - Exclusions & Qualifications text
3. Leave `Job Number` **blank** on creation — do not auto-generate it.
4. Set the new Project's status to something like "Pending Job Number" or "Awarded — Setup."
5. Redirect or notify the PM (assigned or default PM role) that a new project needs a job number assigned.
6. On the Projects module, the PM opens the new project and manually enters/assigns the `Job Number` in a dedicated field — this is the one deliberate manual step in an otherwise automated handoff, since job numbering conventions (sequential, year-prefixed, etc.) vary by shop and shouldn't be guessed by the system.
7. Once `Job Number` is set, the Project moves to "Active" and becomes visible/queryable across all other modules (Drawing Log, Parts List, PO, etc.) by that Job Number.

### Data model note
Keep the estimate record intact and linked to the resulting Project (one-to-one), not deleted or overwritten — PMs and estimators will want to look back at what was originally bid versus what the job actually is scoped to include after change orders.

### Acceptance criteria
- Changing an estimate's status to Won does not silently create a project — it requires the explicit Award action.
- All copyable fields listed above populate on the new Project with zero manual retyping.
- Job Number field is empty until a PM sets it, and the project is not "Active" until it is set.
- The estimate remains viewable/linked from the Project record after award (e.g., a "View original estimate" link).