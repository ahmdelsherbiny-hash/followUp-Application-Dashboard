# Country Entity Pill Availability

## Goal

Keep the Branch and Company slicer pills visible, but disable either pill when the selected country has no latest project assigned to that entity type.

## Behavior

- Pill visibility is calculated from entity presence in the selected country registry.
- A registered type with one or more latest projects remains enabled and selected when the drawer opens.
- A registered type with zero latest projects remains visible but uses a muted visual treatment, native `disabled`, and `aria-disabled="true"`.
- A type with no registered entity in the country is omitted from the header.
- Muted pills remain labelled, do not show the interactive hover treatment, and cannot change the dashboard state.
- All existing KPI, project-list, donut, and radial-chart filtering behavior remains unchanged for enabled pills.

## Verification

- A country with Branch and Company projects enables both pills.
- A country with only Branch projects disables Company.
- A country with only Company projects disables Branch.
- An entity registered in a country without projects does not enable its pill.
