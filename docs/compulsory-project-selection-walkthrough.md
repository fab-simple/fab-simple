# Walkthrough — Compulsory Project Selection

## Summary

Implemented a mandatory project selection flow across the FabSimple dashboard. Users must now select a project before accessing project-scoped modules. The project picker was moved from the topbar into the sidebar for permanent visibility.

## Changes Made

### 1. Nav Config — `projectScoped` flag
**File**: `lib/nav-config.ts`
- Added `projectScoped?: boolean` to `NavItem` interface
- Tagged 22 nav items as project-scoped (Parts, Drawings, Change Orders, POs, etc.)
- 12 items remain company-wide (Dashboard, Projects, Inventory, OSHA, Certs, etc.)

---

### 2. Sidebar — Integrated Project Picker + Locked Items
**File**: `components/layout/Sidebar.tsx`
- Integrated `ProjectPicker` directly below the logo
- Project-scoped nav items render as **locked** (dimmed, 38% opacity, lock icon) when no project is selected
- Clicking a locked item opens the project picker dropdown
- Uses `forcePickerOpen` state to coordinate with the picker

---

### 3. Project Picker — Sidebar Dark Theme
**File**: `components/layout/ProjectPicker.tsx`
- Full-width button styled for the dark sidebar
- **Pulsing blue CTA** ("Select a Project") when nothing is selected
- Removed the "All Projects" option and clear (X) button
- Added `forceOpen` + `onForceOpenHandled` props for external trigger
- Dropdown uses the light theme (matches existing card style)

---

### 4. Project Gate — Overlay Component
**File**: `components/layout/ProjectGate.tsx` (NEW)
- Wraps dashboard page content
- Checks if current route is `projectScoped` and no project is selected
- Shows a premium card overlay with:
  - Icon + headline: "Select a Project to Continue"
  - Search bar (when >3 projects)
  - Project cards with status dots, name, number, tonnage
  - Hover effects with sliding arrow
  - Empty state for zero projects
- Renders children normally when project is selected or page is company-wide

---

### 5. Topbar — Cleaned Up
**File**: `components/layout/Topbar.tsx`
- Removed `ProjectPicker` component (moved to sidebar)
- Added a subtle text breadcrumb showing the selected project name/number

---

### 6. State Management
- **`hooks/useGlobalProject.ts`**: Removed `clearProject` from the hook API
- **`store/projectSlice.ts`**: `clearGlobalProject` action remains in the slice but is no longer consumed

---

### 7. Dashboard Layout
**File**: `app/(dashboard)/layout.tsx`
- Wrapped `{children}` with `<ProjectGate>` component

---

### 8. CSS
**File**: `app/globals.css`
- ~380 lines of new CSS for:
  - Sidebar picker (dark theme button, pulse animation, dropdown)
  - Locked nav items (dimmed, lock icon)
  - Project gate overlay (card, header gradient, project cards, hover effects, spinner)

## Validation
- ✅ Dev server compiles without errors (Next.js 16.2.2 + Turbopack)
- ✅ Dashboard page loads (200 OK)
- ✅ No remaining references to removed `clearProject`
