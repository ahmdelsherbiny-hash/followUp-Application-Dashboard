# Country Entity Pill Availability

## Goal

Keep the Branch and Company slicer pills visible, but disable either pill when the selected country has no latest project assigned to that entity type.

## Behavior

- Availability is calculated from the selected country's latest project reports, not from entity presence in the Map Registry.
- A type with one or more projects remains enabled and selected when the drawer opens.
- A type with zero projects is excluded from the active filters and rendered with native `disabled` and `aria-disabled="true"` attributes.
- Disabled pills remain labelled, use a muted visual treatment, do not show the interactive hover treatment, and cannot change the dashboard state.
- All existing KPI, project-list, donut, and radial-chart filtering behavior remains unchanged for enabled pills.

## Verification

- A country with Branch and Company projects enables both pills.
- A country with only Branch projects disables Company.
- A country with only Company projects disables Branch.
- An entity registered in a country without projects does not enable its pill.
