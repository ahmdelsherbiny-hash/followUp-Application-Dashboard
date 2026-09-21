# Handoff — performance map missing reports

## Resume here

The user asked to stop preview work and write this handoff because their usage limit was nearly exhausted. The feature is implemented locally and its automated validation was completed later on 2026-09-16. It has not been visually previewed, committed, or deployed. Resume from the current files; do not recreate the feature from scratch.

Workspace:

```text
D:\Ahmed Elsherbiny\AI PROJECTS\APPs PROJECTS\FOLLOW-UP APPLICATION OVERSEAS ONLINE DASHBOARD
```

The older content in `agent_handoff.md` describes a previous dashboard session and is not the current work state.

## User request

On `performance_map.html`, add a small information icon (`i`) immediately beside the last-data-update date in the header. Clicking it opens a floating list of projects whose report is missing:

- Group projects under their country names.
- Show each country's missing count against its total expected projects, e.g. 4 missing reports out of 10 projects.
- Show actual missing project names below each country.
- Keep the panel usable on mobile, with wrapping and internal scrolling instead of overflowing the screen.
- Use the new complete-project roster, not the existing report list, to determine which projects are expected.

The user also previously requested a legend change, already present in the working tree:

```text
فروع أعمالها شارفت على الانتهاء
(نسبة إنجاز أكبر من 95%)
```

Keep that change in the Business Analysis legend. It adds `<br>` and `<bdi dir="ltr">95%</bdi>` in `updateFloatingMapLegend()`.

## Verified live data contracts

Spreadsheet:

https://docs.google.com/spreadsheets/d/1eRp9k1JWjvyFO8IymyEUAu7Sd6woqgu4Oe0D26xY5k4/edit?gid=1907104609#gid=1907104609

Spreadsheet ID: `1eRp9k1JWjvyFO8IymyEUAu7Sd6woqgu4Oe0D26xY5k4`.

### New complete-project roster

- User's tab name: `new map data source04` / “New Map Data Source 4”.
- GID: `1907104609`.
- A: `BRANCH ID` — actually the entity identifier used in Map Registry, e.g. `SA00`, `OM01`. Do not infer ISO country codes from its prefix.
- B: `PROJECT ID` — numeric IDs in the live sheet.
- C: `PROJECT NAME`.
- E contains entity display names, but it is not needed for the join and has no column label.
- Google GViz currently returns many empty trailing columns. Only A:C are used.
- 150 valid projects observed on 2026-09-16.

### Existing map sources

- Main Questions GID `1034068003`: entity ID in B, project ID in C, country in D, report date in E, project name in F; financial/schedule fields continue through AC.
- Map Registry GID `375973192`: A entity name, B entity ID, C BRANCH/COMPANY, D Maps URL, E country.
- Early Alert GID `310448800`: already used by the map; not involved in deciding whether a main report exists.

The agreed implementation assumption was stated to the user: a report is missing when the expected project ID has no valid Main Questions record. This is an existence comparison, not a monthly/date freshness check or an Early Alert completeness check.

Country comes from the Map Registry entity-ID join. Compare against Main Questions before registry joins or completion/display filters, so filtering the map cannot falsely create missing reports. Main rows need project ID and project name to count as reports. Compare raw cell IDs rather than formatted numbers, which can introduce commas.

The live snapshot contained 102 Main Questions records and 48 missing projects out of 150 expected projects. Examples: Libya 11/14 missing, Saudi Arabia 1/7, Cameroon 3/9, Equatorial Guinea 7/29, Uganda 6/8. Counts may change as the sheet changes; no snapshot values are hardcoded in production.

An optional local data snapshot of these three tables was saved to:

```powershell
Join-Path $env:TEMP 'map-missing-reports-tables.json'
```

It is not part of the repository. Anonymous GViz reads worked through PowerShell `Invoke-WebRequest` with approved network escalation. Normal sandbox networking failed. The web tool could not open the sheet, but the direct GViz read succeeded.

## Current changes

### `missing_reports.js` — new

Contains:

- `parseExpectedMapProjects(table)`: validates the source shape and A:C headers (column labels or first-row headers), skips blank/header rows, deduplicates by project ID (last row wins).
- `missingReportCountry(entityId, registryIndex)`: resolves country aliases through existing `findCountryGeo`; unresolved entities remain under `دولة غير محددة`.
- `summarizeMissingMapReports(projects, mainTable, registryIndex)`: compares raw project IDs with valid Main rows, groups by canonical country, retains denominators for all expected country projects, and returns only countries with missing projects in Arabic alphabetical order.
- Rendering uses `escapeHtml()` and `<bdi>` for safe mixed-language names.
- Distinct loading, empty-roster, all-received, and failure messages.
- `loadMissingMapReports(mainTable, registryIndex)`: independently fetches GID `1907104609` after core map sources have loaded; failure reports an explicit panel error without failing the map.
- One floating non-modal dialog shared by desktop/mobile information buttons.
- Close button, Escape, outside click, focus leaving, focus return after explicit close, and resize dismissal.
- Panel width is capped at 420px and viewport width minus 24px. Position and maximum height are clamped to the viewport.

The script depends on existing global map helpers at call time. It is loaded before `performance_map.js`, and initialized from the map's DOMContentLoaded handler.

### `performance_map.html`

- Added one information button beside each existing date: desktop and the mobile-under-logo variant. CSS decides which header is visible.
- Added one shared panel with title, summary, close button, and scrollable country/project list.
- Added scoped `missing-reports-*` styles for both themes, keyboard focus, name wrapping, and touch scrolling.
- Added `missing_reports.js?v=1.0` before the map script.
- Bumped map script reference to `performance_map.js?v=9.08`.

### `performance_map.js`

- Preserved earlier Business Analysis legend edit.
- Calls `loadMissingMapReports(mainTable, registryIndex)` after the core tables are validated and the registry index is built.
- Reports core-data loading failure in the new panel.
- Calls `initMissingReportsPanel()` in DOMContentLoaded.

### Other new files

- `docs/superpowers/specs/2026-09-16-missing-map-reports-design.md`: feature design/data rules.
- `tests/missing_reports.test.cjs`: Node built-in test runner + already-installed jsdom; six tests covering matching/deduplication/aliases, header validation, safe rendering/counts, loading/empty/success/error states, both trigger/dismissal flows, and viewport positioning calculations.

## Verification status — important

- Final syntax checks passed for `missing_reports.js`, `performance_map.js`, and `tests/missing_reports.test.cjs`.
- `git diff --check` passed. Its only output was the repository's existing LF-to-CRLF warnings.
- `node --test tests/missing_reports.test.cjs` passed all 6 tests: 6 passed, 0 failed, 0 skipped. The final run completed in about 1.3 seconds.
- The first complete test run exposed an incorrect test expectation: the existing country helper canonically returns `المملكة العربية السعودية`, not the shorter alias `السعودية`. The test was corrected to match the project-wide helper contract and strengthened to assert last-row-wins deduplication and clearer group existence failures. Production behavior was not changed.
- The saved real-data snapshot was evaluated through the actual project parsers and helpers. It confirmed 150 expected projects, 102 Main Questions rows, and 48 missing projects across 14 countries. The example counts in this handoff matched, including Libya 11/14, Saudi Arabia 1/7, Cameroon 3/9, Equatorial Guinea 7/29, and Uganda 6/8.
- Clean-code and test-quality guard passes completed with no production-code findings left open. The test correction above was the only code change made during final validation.
- No rendered visual/mobile/theme verification was completed.
- Browser preview was blocked when attempting to open the local file URL in a separate Chrome tab. The browser tool explicitly prohibited workarounds/alternate surfaces for that blocked action. Do not circumvent that restriction. No local preview server was launched. The user explicitly asked to stop preview work.
- jsdom viewport tests validate positioning arithmetic and DOM behavior, not actual browser layout or touch scrolling. Do not claim they prove visual fidelity.
- No commit or deployment was performed.

## Next steps when the user resumes

1. Inspect the current diff and status before any new edit, including untracked files.
2. If the user resumes visual verification, manually check both themes and desktop/mobile layout without bypassing the recorded browser restriction.
3. Refresh the spreadsheet snapshot only if current live counts are required; the saved snapshot is from 2026-09-16 and production values are not hardcoded.
4. Do not commit, publish, or claim the live site is updated without authorization and a real deployment.

Suggested commands:

```powershell
node --check missing_reports.js
node --check performance_map.js
node --test tests/missing_reports.test.cjs
git diff --check
git status --short
```

## Preserve unrelated changes and preferences

- `chair man map assets/suggestion 01.xlsx` was already modified by the user before this work. Do not revert or overwrite it.
- No commits or deployments were made in this session.
- The app is vanilla HTML/CSS/JavaScript, Leaflet, Chart.js, and GViz JSONP. No new dependencies were added; package.json already contains jsdom.
- Respond in Arabic when appropriate. Wrap every Arabic-majority paragraph in U+202B / U+202C and embedded LTR tokens in U+2066 / U+2069. Do not show HTML direction tags in chat.
- Prefer user-owned skills under `C:\Users\ahmed\.agents\skills`.
- User prefers action without repeated confirmations. Their specified design and authorization should carry forward.

## Suggested continuation prompt

```text
Read HANDOFF-2026-09-16-missing-reports.md and the current diff. Continue the missing-reports information panel beside the performance-map last-update date. Preserve existing edits and the user's workbook. The implementation exists but tests and final review are unfinished. Complete verification and any necessary fixes. Preview was stopped and a local-file browser security block must not be bypassed. Do not deploy unless I ask.
```
