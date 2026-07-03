# Prompt: Worker View — Final Addendum (shop-floor usability + UI feel)

## Context
This is the final addendum to the Worker View rebuild prompt. A 20+ year shop worker review flagged real adoption risks: glove-unfriendly touch targets, no offline handling, QC sign-off on every stage instead of real hold points, and password-based login that won't survive a shared tablet with grimy hands. If these aren't fixed, workers will stop logging in real time and start back-filling from memory at end of shift — which makes the data look trustworthy while actually being worse than paper. This addendum fixes the workflow issues and specifies the UI feel needed for workers to actually want to use this, not tolerate it.

---

## Part 1 — Scope QC sign-off to real hold points (critical)

- Remove mandatory separate Quality Control sign-off from **Cutting** and **Fit-Up** stages. These become **self-check by the worker who did the work** — the same person hits Completed, no second QC identity required.
- Keep full, separate Quality Control sign-off (distinct identity + timestamp) on **Weld** and **Final Inspection** only — these are the actual AWS D1.1 / AISC hold points a real shop enforces.
- Add a company-configurable setting: `QC Spot-Check %` for Cutting/Fit-Up — e.g., QC is prompted to review a random X% of pieces at these stages instead of every single one, so there's still an oversight mechanism without making QC a bottleneck on every part.

---

## Part 2 — Offline-first (critical)

- Every "Set" action (Completed, Quality Control, Hours) must work with **no network connection**: capture the action locally with a timestamp on the device the instant the button is pressed, and queue it for sync.
- Show a clear, unobtrusive sync status indicator (e.g., a small icon: synced / pending / offline) — workers shouldn't have to wonder if their entry "took."
- Auto-sync in the background the moment connectivity returns; no manual "retry" step required from the worker.
- If a device has a large backlog of unsynced entries, surface this to a supervisor/admin view, not to the worker mid-task.

---

## Part 3 — Login: badge/scan, not password (critical)

- Replace password-based login on shop-floor devices with **badge tap (NFC/RFID) or personal QR/barcode scan** to start a session.
- Session should auto-expire after a configurable idle period (e.g., 4 hours or shift-length) so a device doesn't stay logged in as one person all week.
- This is what makes the `By` auto-fill from earlier prompts actually trustworthy — if login is annoying, workers share a logged-in device and the audit trail becomes fiction.

---

## Part 4 — Touch targets and layout for gloved hands (critical)

- All primary action buttons (Set, Complete) must be **large touch targets** — minimum ~72x72px effective hit area, generously spaced apart so a gloved thumb can't miss or double-hit.
- Avoid small dropdowns, thin toggle switches, or tightly packed form fields on the primary action screen — anything requiring fine precision belongs in a supervisor/admin view, not the worker's main flow.
- High-contrast color scheme and large, bold typography — shop lighting varies (bright near a bay door, dim in a corner) and screens get glare from grinding dust; low-contrast UI becomes unreadable fast.
- Where possible, prefer **one big action per screen** for the current stage over a dense multi-stage form — a worker scanning a piece should land on exactly what they need to do next, not a full traveler view they have to scroll and hunt through.
- Support landscape and portrait without breaking layout — devices get mounted at different bay setups.

---

## Part 5 — Make completing a stage feel good (this is the retention layer)

The goal here is a worker finishing a stage and feeling a small, genuine "nice, done" — not a form submission.

- On tapping Set/Complete: immediate, satisfying visual confirmation — a clear checkmark animation and a brief color change (e.g., the stage card turns green), plus a short haptic buzz on devices that support it. Fast, not showy — under half a second, no popup the worker has to dismiss.
- Show a simple **piece-level progress indicator** (e.g., a short row of stage dots that fill in as work completes) so a worker can see their own piece moving along — it's their work, let them see it land.
- Avoid anything that reads as a personal performance scoreboard (no leaderboards, no "you're slower than average" messaging) — per the earlier audit note, if this data gets used to judge individuals, people will game it. Keep the positive feedback personal and immediate (this piece, right now, nice job) rather than comparative.
- End-of-shift or end-of-job micro-moment: when a worker completes the *last* stage they're responsible for on a piece or assembly (e.g., their weld closes out the assembly's kit), show a small distinct acknowledgment — different animation/sound than a routine stage completion — so finishing something feels like finishing something.
- Keep language on every screen plain and short — shop terms, not software terms. "Mark cut done" reads better on a shop floor than "Submit Cutting Completion Record."

---

## Part 6 — Fallback when the system is down

- Provide a simple printable fallback sheet per piece/job (mirrors the paper traveler a shop already knows) that can be filled by hand and batch-entered by a supervisor once the system/device is available again.
- This isn't the primary path — it's the safety net that keeps the shop moving on a bad day without workers quietly reverting to paper forever.

---

## Part 7 — Rugged, mounted stations where it makes sense

- Note for hardware planning (not app logic): recommend bay-mounted rugged tablets/scan stations at fixed points (saw, fit-up table, weld bay) over personal tablets carried through grinding dust and weld spatter, for stations with consistent foot traffic. Personal/handheld devices remain appropriate for mobile roles (QC walking the floor, site erectors).

---

## Acceptance criteria
- Cutting and Fit-Up require only a single self-check completion, no separate QC identity; Weld and Final Inspection retain full separate QC sign-off.
- Every Worker View action functions with zero connectivity and syncs automatically once reconnected, with a visible but non-intrusive sync status.
- Login uses badge/scan, not typed password, with automatic session expiry.
- All primary action buttons meet the minimum touch-target size and spacing specified, tested with a gloved hand on an actual device before sign-off.
- Completing a stage produces immediate visual (and haptic where supported) confirmation without a dismissible popup interrupting flow.
- No comparative/individual performance data is surfaced in the worker-facing UI.
- A printable fallback sheet exists for every piece/job as a manual backup path.