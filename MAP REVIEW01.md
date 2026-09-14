 ### Must fix

  1. Pill visibility contradicts its own goal
      - Claim: both Branch and Company pills remain visible.
      - Reality: an entity type not registered in the country is omitted entirely.
      - Evidence: pill spec (D:/Ahmed Elsherbiny/AI PROJECTS/APPs PROJECTS/FOLLOW-UP APPLICATION OVERSEAS ONLINE DASHBOARD/docs/superpowers/
        specs/2026-09-09-country-entity-pill-availability-design.md:5), implementation (D:/Ahmed Elsherbiny/AI PROJECTS/APPs PROJECTS/FOLLOW-UP
        APPLICATION OVERSEAS ONLINE DASHBOARD/performance_map.js:2651).

      - Fix: say registered types remain visible; unregistered types are omitted.

  2. The Branch-only and Company-only verification cases are incomplete
      - Claim: a Branch-only country disables Company, and vice versa.
      - Reality: the unavailable pill is disabled only if that entity type is registered; otherwise it is omitted.
      - Evidence: verification cases (D:/Ahmed Elsherbiny/AI PROJECTS/APPs PROJECTS/FOLLOW-UP APPLICATION OVERSEAS ONLINE DASHBOARD/docs/
        superpowers/specs/2026-09-09-country-entity-pill-availability-design.md:18).

      - Fix: split each scenario into “registered without projects” and “not registered.”

  3. The older slicer spec has drifted
      - Claim: both pills are active whenever the dialog opens.
      - Reality: only entity types with projects are active; registered types without projects are disabled.
      - Evidence: older spec (D:/Ahmed Elsherbiny/AI PROJECTS/APPs PROJECTS/FOLLOW-UP APPLICATION OVERSEAS ONLINE DASHBOARD/docs/superpowers/
        specs/2026-09-09-map-registry-country-slicers-design.md:81), implementation (D:/Ahmed Elsherbiny/AI PROJECTS/APPs PROJECTS/FOLLOW-UP
        APPLICATION OVERSEAS ONLINE DASHBOARD/performance_map.js:2645).

      - Fix: mark the newer availability spec as superseding this behavior or update the original spec.

  4. Invalid entity-location behavior is overstated
      - Claim: an invalid entity location produces no building marker.
      - Reality: any http/https value passes the initial check. If coordinates cannot be extracted, getBranchCoordinates() can fall back to
        entity-name, city, country, or Cairo coordinates and still render a marker.

      - Evidence: spec (D:/Ahmed Elsherbiny/AI PROJECTS/APPs PROJECTS/FOLLOW-UP APPLICATION OVERSEAS ONLINE DASHBOARD/docs/superpowers/
        specs/2026-09-09-map-registry-country-slicers-design.md:73), URL validation (D:/Ahmed Elsherbiny/AI PROJECTS/APPs PROJECTS/FOLLOW-UP
        APPLICATION OVERSEAS ONLINE DASHBOARD/performance_map.js:1456), fallback behavior (D:/Ahmed Elsherbiny/AI PROJECTS/APPs PROJECTS/FOLLOW-
        UP APPLICATION OVERSEAS ONLINE DASHBOARD/geo_coords.js:2584).

      - Fix: document the fallback behavior, or change the implementation later if invalid URLs must omit markers.

  5. Not every map project count uses latest records
      - Claim: project counts come only from latest joined Main records.
      - Reality: cached country counts collect project names from every report row; renamed projects can be counted twice.
      - Evidence: spec (D:/Ahmed Elsherbiny/AI PROJECTS/APPs PROJECTS/FOLLOW-UP APPLICATION OVERSEAS ONLINE DASHBOARD/docs/superpowers/
        specs/2026-09-09-map-registry-country-slicers-design.md:64), counting logic (D:/Ahmed Elsherbiny/AI PROJECTS/APPs PROJECTS/FOLLOW-UP
        APPLICATION OVERSEAS ONLINE DASHBOARD/performance_map.js:947).

      - Fix: narrow the documentation claim or update counting to use latestReportsByProject().

  6. FAB measurements are stale
      - Claim: submenu offsets are 140px desktop and 122px mobile.
      - Reality: CSS uses 144px and 126px.
      - Evidence: FAB spec (D:/Ahmed Elsherbiny/AI PROJECTS/APPs PROJECTS/FOLLOW-UP APPLICATION OVERSEAS ONLINE DASHBOARD/docs/superpowers/
        specs/2026-09-08-nested-vertical-fab-design.md:47), desktop CSS (D:/Ahmed Elsherbiny/AI PROJECTS/APPs PROJECTS/FOLLOW-UP APPLICATION
        OVERSEAS ONLINE DASHBOARD/performance_map.html:1524), mobile CSS (D:/Ahmed Elsherbiny/AI PROJECTS/APPs PROJECTS/FOLLOW-UP APPLICATION
        OVERSEAS ONLINE DASHBOARD/performance_map.html:1636).

  ### Verification gaps

  - No automated contract tests exist for the three sheet mappings or joins.
  - The requested browser smoke test for dark/light themes and mobile containment is not recorded.