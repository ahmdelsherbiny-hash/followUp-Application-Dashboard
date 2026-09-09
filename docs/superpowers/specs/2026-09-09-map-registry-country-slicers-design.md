# Map Registry and Country Portfolio Slicers Design

## Goal

Replace the performance map's `dd_lst` dependency with a dedicated Map Registry tab, ensure project dots come only from current Main data, and add Branch/Company filtering to the country portfolio dialog.

## Data Contracts

### Main Questions (GID 1034068003)

- A: Entity Name
- B: Entity ID
- C: Project ID
- D: Country
- E: Last Update
- F: Project Name
- G: Project Google Maps Location
- H: Total Contract Value
- I: Executed Work Including Internal Certificate
- J: I/H execution ratio
- K: Approved Executed Work
- L: K/H ratio
- M: Paid Work
- N: M/K ratio
- O: Collected Liquidity
- P: O/K ratio
- Q: Payable Work
- R: Q/I ratio
- S: Unpayable Work
- T: S/K ratio
- U: Profitability
- V: U/K ratio
- W: Wages
- X: W/K ratio
- Y: Contract Start Date
- Z: Revised Contract End Date Including Extensions
- AA: Total Approved Duration
- AB: Elapsed Duration
- AC: Time Elapsed Percentage

Only rows with a Project ID and Project Name are project records.

### Early Alert (GID 310448800)

The existing A:N mapping remains unchanged. Early Alert records join Main records by Project ID, using the latest dated alert per project.

### Map Registry (GID 375973192)

- A: Entity Name
- B: Entity ID
- C: Entity Type, restricted to `BRANCH` or `COMPANY`
- D: Entity Google Maps Location
- E: Country

Entity ID is the stable join key between Main and Map Registry. Entity names are display values only.

## Data Ownership and Flow

1. Load Main, Early Alert, and Map Registry in parallel by GID.
2. Parse each tab by its fixed approved column IDs.
3. Index Map Registry by Entity ID and join every Main project to its entity.
4. Join the latest Early Alert record to each Main project by Project ID.
5. Build country presence and entity markers only from Map Registry.
6. Build project dots, project counts, KPIs, project lists, and charts only from the latest joined Main project records.

The map will make no request to `dd_lst` and will not derive project presence from it.

## Map Behavior

- A Map Registry entity makes its country present even when it has no projects.
- A country with registered entities and zero Main projects uses the existing yellow presence highlight.
- Project dots render only for actual Main project records. A project removed from Main cannot leave a dot behind through registry or dropdown data.
- Entity building markers render from valid registry locations.
- A missing or invalid entity location does not remove country presence, but no building marker is rendered for that entity.
- Entity building markers are informational and non-clickable. The old branch click flow that opened project and report-upload status is removed.

## Country Portfolio Header and Slicers

- Show the visible project count beside the country name.
- Place two pills on the opposite side of the same header alignment: Branch and Company.
- Both pills are active by default whenever the dialog opens.
- Clicking an active pill disables that entity type. The disabled pill becomes dim and struck through.
- Disabled entity types are removed from all country portfolio KPI totals, KPI project drill-down lists, the contract-value doughnut chart, and the progress radial chart.
- The visible project count updates after every filter change.
- If both pills are disabled, show zero-valued KPIs, empty project lists, and explicit empty chart states without closing the dialog.
- Pills are semantic buttons with `aria-pressed`, keyboard activation, visible focus, and persistent labels.

## Validation and Failure Handling

- Registry rows without Entity ID, Country, or a valid Entity Type are excluded and logged with a clear warning.
- Main rows with an Entity ID not found in Map Registry are excluded from country portfolio aggregation and logged. They must not silently fall back to name matching.
- Duplicate Entity IDs use the last valid registry row and emit a warning.
- Main rows without Project ID or Project Name are not project records.
- Network or schema failures keep the existing loader failure path and include the source-tab name in the console error.

## Verification

- Contract-test all three fixed tab mappings and both joins.
- Verify Branch-only, Company-only, both-active, and both-disabled slicer states.
- Verify slicers update KPIs, drill-down lists, both charts, and the visible project count from the same filtered project collection.
- Verify a registry-only country remains present and yellow.
- Verify a country absent from Main has no project dots.
- Verify a deleted Main project leaves no project dot.
- Verify valid entity markers render and do not open the removed branch detail flow.
- Verify invalid locations omit only the marker.
- Run JavaScript syntax checks, repository diff checks, and a browser smoke test in dark and light themes.

## Scope

Update only the map data-loading/parsing, country/entity indexes, entity marker interaction, country portfolio filtering, and the required dialog styles. Preserve unrelated map features and existing uncommitted work. Add no runtime dependency.
