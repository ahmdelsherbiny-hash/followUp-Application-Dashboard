# Missing map reports

Add a small information button beside the last-data-update date in both desktop and mobile headers. It opens one non-modal floating panel with a close button, a total summary, and missing projects grouped alphabetically by Arabic country name. Each country shows its missing count out of all its expected projects. Long names wrap; the list scrolls inside the viewport. Support both themes, outside click, Escape, and keyboard focus return.

Read the existing spreadsheet's `new map data source04` tab, GID `1907104609`. Verified columns: A = BRANCH ID (entity ID), B = PROJECT ID, C = PROJECT NAME. Resolve country through Map Registry's entity ID, not an inferred country-code prefix. Deduplicate expected projects by project ID. Compare against valid parsed Main Questions project IDs before map registry joins or display filters. Missing means no Main Questions project record; it does not mean an old report or a missing Early Alert answer.

Only countries with missing projects appear. Their denominators include every expected project in that country. An unresolved entity stays visible under an unknown-country group. An empty source, all reports received, loading, and fetch/schema errors have distinct messages. Failure of the new source must not stop the map or present a false zero-missing result.

Keep the new data and panel logic in `missing_reports.js`, reuse existing map fetch/parsing/country helpers, and add only small initialization/data handoff hooks to the map script. Preserve the prior legend edit. Verify matching, duplicates, aliases, empty/error states, escaping, dismiss/focus behavior, and mobile/desktop containment with both themes.
