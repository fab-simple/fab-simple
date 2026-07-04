# Prompt: E-Plan Pipeline — Tekla Upload to Field Crew Ground Station

## Context
FabSimple, a structural steel fabrication SaaS. This prompt covers the full path an erection plan (E-plan/GA drawing) takes: uploaded from a Tekla export into Drawing Log, linked into Erection Sequence steps and piece marks via a pointer architecture (no per-piece copies), and consumed in the field by a ground-crew station that scans, views, verifies, and either radios or prints current information up to the crew at height. Includes Spanish localization, since this tool will be used by mixed-language crews.

---

## Part 1 — Upload and Drawing Log integration

- Add `Erection Plan` as a distinct Drawing Type in Drawing Log, separate from Assembly and Part drawing types.
- Support upload as a Tekla export (preferred, carries structured grid/sequence data) or a flat PDF/CAD set (fallback for detailers not exporting from Tekla).
- Support multi-sheet sets under one revision umbrella (e.g., "Level 1 Erection Plan," "Level 2 Erection Plan," bolt list sheets) — sheets in the same set version together, not as independently drifting files.
- Erection Plans go through the same IFA → Approved → IFC revision lifecycle already specified for other drawing types. When a revision is issued, apply the same superseded-flag logic already built for shop drawings — but at the sheet/zone level, since an E-plan revision typically affects a specific grid area rather than the whole set.

---

## Part 2 — Auto-import of sequence and grid data from Tekla

- If the Tekla export carries phase/sequence numbering and grid/zone assignments (common when a detailer sequences the model for delivery planning), auto-populate:
  - Erection Sequence steps (Sequence #, Phase) — per the existing Erection Sequence spec
  - Each step's `Grid Location / Column Line` and `Sheet Reference` fields, pointing into the specific E-plan sheet and zone
- If no Tekla sequence data exists, fall back to manual step creation with manual sheet/grid reference assignment — don't block the feature on Tekla availability.

---

## Part 3 — Pointer architecture (core design constraint)

- An Erection Step stores a **reference** to a specific sheet and grid/zone within the project's E-plan set — it does not store or duplicate a copy of that sheet.
- A piece mark assigned to an Erection Step **inherits that step's reference** — it does not carry its own independent pointer or file.
- Any view, scan, or print action always resolves live against the current E-plan set and its current revision status — there is exactly one source document per sheet, referenced from many places, never copied.
- When an E-plan sheet's revision changes, every step and piece referencing that sheet/zone is automatically looking at the new revision with no manual update required anywhere downstream.

---

## Part 4 — Ground Station app: scan and view

Build this as a station-based tool (fixed device, not assumed to be handheld at height) used by ground crew/signalman/foreman.

- Scan a piece's QR/barcode tag.
- System resolves the piece → its Erection Step → the referenced E-plan sheet and grid/zone, and opens directly to that location.
- If the sheet is a structured/vector format, render a visual pin marker at the piece's exact grid location on open — don't require the user to search the sheet manually.
- Viewer controls: smooth pinch-zoom, rotate (to match physical orientation in the field), and a one-tap toggle between "pinned/zoomed view" and "full sheet view."

---

## Part 5 — Verify screen

Alongside the drawing view, show a compact, radio-friendly details panel:
- Current revision number and IFC status
- Piece weight and any available rigging/pick data
- Connection type (bolted/welded/mixed) and bolt list summary (size, grade, quantity) if applicable
- Heat number
- Phrase all labels in short, plain language suitable for reading aloud over a radio — not dense technical table formatting.

---

## Part 6 — Print, with enforced freshness

- One-tap "Print" action available directly from the verify screen.
- Print always re-fetches the current live revision/IFC status at the moment of printing — never a cached or previously-viewed copy.
- Every printed sheet carries a visible, prominent stamp: revision number, IFC status, and exact print date/time — sized to be read at a glance, not a small footer note.
- If the piece's referenced sheet is not currently IFC (e.g., under revision, on hold), block printing and show the reason clearly rather than printing a non-current sheet.
- If a sheet's revision changes **after** a print has already occurred for a piece referencing it, flag that piece at the Ground Station the next time it's scanned or its step is opened: a clear warning that a previously printed copy of this sheet may now be outdated and should be reprinted before further use in the field. The system cannot recall paper already at height, but must make the ground crew aware immediately.

---

## Part 7 — Offline support and pre-caching

- Ground Station should pre-cache the current day's scheduled steps and their referenced sheets each morning while connectivity is available (e.g., at the yard or in the truck before heading to a remote work area).
- Scan, view, and print actions must function fully offline against the pre-cached data; any status updates or logs queue locally and sync automatically once connectivity returns, with a simple, non-intrusive sync status indicator — no manual retry required.
- If a scanned piece's data isn't in the local cache and there's no connectivity, show a clear "not available offline — reconnect to load" message rather than failing silently or showing stale placeholder data.

---

## Part 8 — Spanish localization

- Language is a **per-user profile setting**, selected at login/badge-in — not a device-wide toggle. Multiple users with different language settings can use the same physical Ground Station device across a shift.
- Localize all interface language: labels, instructions, button text, status names, warnings.
- Do **not** translate or reformat technical identifiers: piece marks, heat numbers, grid references, material grades/specs (e.g., A992, W12x26), or standard designations (AWS, AISC, ASTM references). These remain exactly as issued regardless of interface language.
- For free-text fields (field RFI notes, NCR descriptions, foreman comments), provide an inline "translate" toggle using machine translation for day-to-day readability, but do not present machine-translated safety-critical content (OSHA warnings, hazard notices, formal NCR/compliance text) as authoritative — that content requires a professional/certified translation pass reviewed for accuracy before being published in the app, flagged separately from casual machine-translated user notes.
- Source Spanish translations for trade-specific UI terms from someone with actual US construction/ironworking background, not a general-purpose translation service — jobsite Spanish in this trade uses specific vocabulary and common English loanwords that a generic translation will get noticeably wrong.

---

## Part 9 — Hardware guidance (not app logic, but relevant to this build)

- Ground Station is intended as a fixed or vehicle-mounted setup (site trailer, weatherproof enclosure near the crane) paired with a durable printer — not a personal handheld device used by workers at height.
- Recommend a portable/battery-powered printer option for remote sites without trailer power.
- Any device used above ground level elsewhere in the platform (separate from this Ground Station scope) should be tethered per dropped-object safety practice — noted here for completeness, not part of this specific build.

---

## Acceptance criteria
- Erection Plan uploads are versioned and gated through the same IFA/IFC lifecycle as other drawing types, at the sheet/zone level.
- Tekla-sourced sequence and grid data auto-populates Erection Sequence steps where available; manual entry remains fully functional otherwise.
- Erection Steps and piece marks reference E-plan sheets/zones by pointer, never by duplicated copy — a revision change propagates automatically with zero manual updates downstream.
- Scanning a piece opens directly to its pinned grid location on the correct sheet, with working zoom and rotate.
- The verify screen shows revision status, weight, connection/bolt info, and heat number in plain, radio-ready language.
- Print always reflects the live current revision, is visibly stamped with revision/status/timestamp, and is blocked when the referenced sheet isn't currently IFC.
- A revision change after printing triggers a clear outdated-copy warning the next time that piece or step is accessed at the Ground Station.
- Ground Station functions fully offline against pre-cached daily data, syncing automatically once reconnected.
- Interface language is a per-user setting; technical identifiers are never translated; safety-critical content uses certified translation, not machine translation alone.