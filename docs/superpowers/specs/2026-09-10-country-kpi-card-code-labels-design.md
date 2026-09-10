# Country KPI Card Code Labels Design

## Goal

Make the calculation behind each of the ten country portfolio KPI cards visible at a glance. Display the agreed source code and ratio formula in red, retain the explicit Google Sheet field bindings, and make each visible percentage follow its approved formula. The final duration card reads Main Questions column AC only after a project is selected.

## Card Mapping

| Card code | Card title | Bound field | Displayed ratio | Percentage calculation |
| --- | --- | --- | --- | --- |
| A | إجمالي القيمة التعاقدية | `contractValue` | 100% in the country aggregate view | For a selected project, divide project A by country-total A. Return 0% when country-total A is zero. |
| B | منفذ شامل مستخلص داخلي | `executedWorkTotal` | B/A | Divide B by A. |
| C | منفذ معتمد | `executedWorkApproved` | C/A | Divide C by A. |
| D | أعمال مسددة | `paidWork` | D/C | Divide D by C. |
| F | سيولة محصلة | `collectedLiquidity` | F/C | Divide F by C. |
| H | الأعمال القابلة للصرف | `dueDebt` | H/B | Divide H by B. |
| G | غير قابلة للصرف | `uncollectibleWork` | G/C | Divide G by C. |
| I | الربحية | `profitLoss` | I/C | Divide I by C. |
| J | الأجور | `wagesCost` | J/C | Divide J by C. |
| COLUMN AC | نسبة انقضاء المدة الزمنية | `timeElapsedPercent` | No aggregate ratio | Keep the value blank until a project is selected, then show that project's AC percentage. |

## Presentation

- Match the supplied reference image: show each single-letter card code near the card heading and each ratio formula in the lower metadata row.
- Render codes and formulas in the existing dark red accent used by the reference.
- Show `COLUMN AC` prominently inside the final duration card instead of a single-letter code and ratio formula.
- Keep all codes permanently visible; do not hide them behind hover, focus, tooltips, or expansion.
- Use the approved card titles listed in the mapping table; do not restore the older titles currently found in the implementation.
- Keep current currency and percentage formatting, responsive behavior, themes, focus behavior, and project drill-down interaction.

## Data and Calculation Boundaries

- Codes A through J are explanatory labels only. They must not be used to select spreadsheet columns; use the explicit bound fields in the mapping table.
- The visible percentage beside each formula must be calculated from the bound metrics represented by its numerator and denominator. A zero denominator returns 0%.
- D must display `D/C`, regardless of the earlier reference image showing a different denominator.
- A is not a decorative hardcoded percentage: the aggregate country view is 100% when total contract value is nonzero; a selected project uses its contract value divided by the country total.
- The duration card is the sole exception to the display-only rule: its value comes from the already parsed Main Questions AC field, `timeElapsedPercent`.
- Do not aggregate column AC across country projects. The duration-card value remains blank in the country aggregate view.
- When a project is selected, show only that selected project's `timeElapsedPercent`; clear the value again when the selection is reset.

## Verification

- Open a country and confirm all ten cards display the agreed red code or formula.
- Confirm D displays `D/C`.
- Confirm A displays 100% for a nonzero country aggregate and the project share after selecting a project.
- Confirm zero totals never produce `NaN` or `Infinity`.
- Confirm the duration card reads `timeElapsedPercent` sourced from Main Questions column AC.
- Confirm the duration-card value is blank before project selection and after resetting the selection.
- Confirm selecting a project shows that project's AC percentage and does not aggregate other projects.
- Confirm every visible percentage matches its displayed formula and bound metrics.
- Confirm all card titles match the approved mapping table.
- Smoke-test desktop and mobile layouts in dark and light themes.

## Scope

Update only the country portfolio KPI-card configuration, markup, and the minimum required styles. Do not change unrelated map behavior, sheet parsing, or existing uncommitted work.
