# Compulsory Project Selection — Implementation Plan

## Problem

Currently the project picker in the topbar defaults to "All Projects" and is easy to miss. Since almost all sidebar modules (Parts, Drawings, Change Orders, etc.) are project-scoped, users land on pages with unfiltered or empty data — a confusing experience.

## Goal

Make project selection **compulsory and intuitive**: guide the user to pick a project before interacting with project-scoped modules, while still allowing access to company-wide pages (Dashboard, Projects list, Inventory, etc.).

---

## Proposed Design

### 1. Move Project Picker into the Sidebar

Relocate the `ProjectPicker` from the **Topbar** into the **Sidebar**, positioned just below the logo header. This gives it a prominent, persistent presence — the user always sees what project they're working in.

**Visual**: A full-width button in the sidebar with the selected project name, project number, and a colored dot for project status. When no project is selected, it shows a pulsing "Select a Project" CTA.

### 2. Project Gate Overlay

When no project is selected and the user navigates to any **project-scoped** page, show a **full-screen overlay** (glassmorphism card) that:
- Shows a headline: "Select a Project to Continue"
- Lists available projects as clickable cards (name, number, status, tonnage)
- Has a search bar for quick filtering
- Blocks interaction with the underlying page

This overlay is a **`ProjectGate`** wrapper component inserted in the dashboard layout.

### 3. Categorize Nav Items

Split sidebar items into two categories:

| Category | Pages | Behavior |
|---|---|---|
| **Company-wide** (always accessible) | Dashboard, Projects, Live Activity, Inventory, Heat Numbers, OSHA, Certifications, GC Contacts, Audit Log, Users, Integrations, Pricing, Estimating, Worker View | No project required |
| **Project-scoped** (need a project) | Parts, Assemblies, Drawings, Change Orders, RFIs, POs, Receiving, Shipping, Daily Log, Cut List, Import, Paint Inspection, Weld Log, AISC 303, NCR, Erection, Erection Ops, Billing, Job Cost, QR Codes | Require `selectedProjectId` |

**Sidebar treatment**: When no project is selected, project-scoped nav items appear **dimmed** (50% opacity) with a small lock icon. Clicking them opens the project picker instead of navigating.

### 4. Remove "All Projects" Option

Remove the "All Projects" option and the clear (X) button from the picker. Once a project is selected, the user can switch to another project but can never go back to "no project selected" — they can navigate to company-wide pages like Dashboard or Projects list via the sidebar.

> **Breaking change**: The `clearProject()` Redux action and "All Projects" option will be removed. Pages that currently fall back to showing all data when no project is selected will now always have a project.

---

## Open Questions

> 1. **Should we keep the "All Projects" view on some pages?** For example, the Parts list currently shows all parts across projects when no project is selected. Should we preserve that cross-project view via a separate "View all" button, or fully eliminate it?
> 2. **First-time experience**: When a user logs in for the first time with zero projects, should the overlay show a "Create Your First Project" CTA instead?

---

## Proposed Changes

### Sidebar & Picker

#### [MODIFY] `components/layout/Sidebar.tsx`
- Insert the `ProjectPicker` component below the logo header
- Add `projectScoped` flag check for each nav item — dim + disable project-scoped items when `selectedProjectId` is null
- Pass an `onRequestProject` callback that opens the picker when a locked item is clicked

#### [MODIFY] `components/layout/ProjectPicker.tsx`
- Restyle as a full-width sidebar element (dark background to match sidebar theme)
- Remove the "All Projects" option and the clear (X) button
- Add a pulsing "Select a Project" CTA state for when nothing is selected
- Support an `openByDefault` prop so it can be triggered from sidebar nav items

#### [MODIFY] `components/layout/Topbar.tsx`
- Remove the `ProjectPicker` import and rendering (it's moved to the sidebar)
- Optionally show a small breadcrumb-style project indicator in the topbar for context

---

### Project Gate Component

#### [NEW] `components/layout/ProjectGate.tsx`
- New component that wraps project-scoped page content
- Shows a glassmorphism overlay with project cards when `selectedProjectId` is null
- Contains search, project cards with status colors, and a fade-in animation
- When a project is selected via a card, it dispatches `setGlobalProject` and dismisses the overlay

#### [MODIFY] `app/(dashboard)/layout.tsx`
- Wrap `{children}` with the `ProjectGate` component so the gate is applied at the layout level

---

### Nav Config & State

#### [MODIFY] `lib/nav-config.ts`
- Add a `projectScoped: boolean` field to the `NavItem` interface
- Tag each item as project-scoped or company-wide (based on the categorization table above)

#### [MODIFY] `store/projectSlice.ts`
- Remove the `clearGlobalProject` reducer (no more "All Projects")
- Keep `setGlobalProject` and `rehydrateProject` as-is

#### [MODIFY] `hooks/useGlobalProject.ts`
- Remove `clearProject` from the returned API

---

### CSS

#### [MODIFY] `app/globals.css`
- Add styles for the project gate overlay (glassmorphism backdrop, card grid, animations)
- Add styles for the sidebar picker (full-width, dark theme, pulse animation)
- Add disabled/locked nav item styles

---

## Verification Plan

### Manual Verification
1. Log in → verify the project gate overlay appears immediately
2. Select a project → verify overlay dismisses and sidebar shows the project
3. Navigate to project-scoped pages → verify data loads correctly
4. Navigate to company-wide pages (Projects, Dashboard) → verify they work without needing a project
5. Refresh the page → verify the project selection persists (localStorage)
6. With 0 projects → verify the gate shows appropriate messaging
7. Mobile responsive — verify the picker works on small screens
