# Nested Vertical FAB Design

## Goal

Replace the current map control-center panel with a compact two-level floating action menu while preserving the FAB's existing bottom-left position and every existing map-control behavior.

## Interaction Model

- The main 54px FAB remains at its current bottom-left position.
- Clicking the main FAB opens or closes a vertical stack of three primary buttons above it: Map, Ticker, and Settings.
- Primary buttons enter with a staggered spring-like rise and scale animation. Closing reverses the sequence.
- Clicking a primary button that owns controls opens a second vertical column immediately to the right of the primary stack.
- Only one secondary column may be open at a time. Clicking the active primary button closes its secondary column.
- Clicking outside the menu or pressing Escape closes both levels.
- The main trigger maintains `aria-expanded`; primary buttons maintain submenu expansion state; toggle actions maintain `aria-pressed`.

## Menu Contents

### Map

- Projects toggle
- Branches toggle
- Business Analysis toggle
- Early Warning toggle

Business Analysis and Early Warning remain mutually exclusive, matching current behavior.

### Ticker

- Three criterion buttons: project count, project health score, and average progress
- Two direction buttons: descending and ascending

### Settings

- Two theme buttons: dark and light
- One completion slicer toggle button

The completion slicer remains UI-only because that is its current behavior.

## Visual Design

- Primary and secondary controls use circular 46-48px buttons with clear icons. Existing selects and switches are represented as discrete buttons so the interaction stays consistent.
- Short tooltips identify controls without permanently consuming map space.
- Active toggles retain their individual semantic glow colors.
- The active primary category receives an accent ring and a directional cue toward its secondary column.
- Dark and light theme variants reuse the project's existing palette.
- On narrow screens, the submenu remains inside the viewport and may tighten spacing or reduce button size without changing the two-column model.
- Reduced-motion users receive immediate state changes without stagger or spring movement.

## Implementation Boundaries

- Update only the FAB-related markup and CSS in `performance_map.html`.
- Update only menu open/close, category selection, and UI synchronization logic in `performance_map.js`.
- Reuse the existing map, ticker, theme, persistence, analysis, and early-warning functions.
- Do not add React, Framer Motion, Tailwind, or new runtime dependencies; reproduce the approved motion with CSS and the existing vanilla JavaScript architecture.
- Preserve unrelated uncommitted work in both target files.

## State and Data Flow

1. The main trigger toggles the root `is-open` state.
2. A primary category sets the active submenu key and updates `aria-expanded`.
3. Existing control handlers update map state and persistence.
4. The existing synchronization function updates active button styles and ARIA states.
5. Closing the root menu clears only transient submenu UI state; it does not alter map settings.

## Failure Handling

- Event handlers return safely when expected DOM nodes are absent.
- Invalid category, sort, or theme values are ignored by the existing validation paths.
- Viewport-aware CSS prevents the secondary column from rendering off-screen at supported mobile widths.

## Verification

- Verify initial position is unchanged in desktop dark and light themes.
- Verify opening and closing order, submenu switching, outside click, and Escape.
- Verify all four map toggles and their restored states.
- Verify ticker sort controls, theme selection, and completion switch.
- Verify Business Analysis and Early Warning remain mutually exclusive.
- Verify keyboard focus indicators, ARIA states, mobile containment, and reduced motion.
- Run any existing project checks and perform a browser smoke test of `performance_map.html`.
