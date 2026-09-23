# Cloudflare Parallel Migration, Access, and Session Tracking Implementation Plan

## Objective

Implement the approved Cloudflare architecture in parallel with the current GitHub Pages production deployment, validate it on a temporary Cloudflare hostname, and transfer `sabi-arabco.site` only after every acceptance gate passes.

Final routes:

```text
https://sabi-arabco.site/          -> performance map
https://sabi-arabco.site/dashboard -> existing follow-up dashboard
https://sabi-arabco.site/news      -> news application
```

There is no `/map` route.

## Assumptions and constraints

- Deployment is initiated from the local Windows workstation, not GitHub.
- The existing GitHub Pages deployment remains production until the final cutover task.
- The untracked Excel lock file in `chair man map assets` belongs to the user and must not be edited, staged, or deleted.
- The map and dashboard currently fetch Google Sheets directly from browser JavaScript and must be migrated to same-origin Worker APIs.
- The news application has an independent Vite build.
- The analytics dashboard and Google Apps Script reporting UI are out of scope.
- Cloudflare D1 is the runtime store; Google Sheets is the control plane and finalized-session reporting mirror.
- Cloudflare Access OTP protects registration routes only. The trusted-device cookie protects normal map use.
- A two-minute idle threshold and five-minute dirty checkpoint interval are approved defaults.

## Non-goals

- Rebuilding the visual design of the map, dashboard, or news application.
- Proxying ArcGIS base tiles or third-party CDN assets.
- Identifying physical hardware after browser data has been cleared.
- Capturing GPS, raw IP history, mouse paths, screen recordings, or keystrokes.
- Building the future analytics dashboard.
- Deleting the GitHub repository or rewriting its history.

## Definition of done

- Candidate and production can run concurrently until cutover.
- All route, authentication, data-proxy, device, and tracking acceptance tests pass.
- The business Spreadsheet is private and accessible only through the Worker.
- Registration mode behavior is covered by automated state-matrix tests.
- `npm run deploy` builds and publishes all three applications from the workstation.
- Domain cutover and rollback procedures are documented and rehearsed.

## Planned project structure

```text
src/
  worker.js
  router.js
  config.js
  auth/
    access-identity.js
    cookies.js
    device-auth.js
    password-auth.js
    registration-policy.js
  google/
    auth.js
    business-data.js
    registry.js
  tracking/
    checkpoint.js
    finalize.js
    metadata.js
  routes/
    auth-routes.js
    dashboard-api.js
    map-api.js
    news-api.js
    tracking-api.js
  shared/
    errors.js
    http.js
    validation.js
client/
  auth/
    map-registration.js
  tracking/
    session-tracker.js
    device-metadata.js
scripts/
  build-static.mjs
migrations/
  0001_auth_and_tracking.sql
dist/
wrangler.jsonc
.dev.vars.example
```

`dist/` is generated and never used as a source directory.

## Task 0 — Record baselines and protect the current deployment

### Objective

Capture a reproducible baseline before any migration work and prove that current production is unaffected.

### Dependencies

None.

### Inspect

- `index.html`
- `dashboard.js`
- `performance_map.html`
- `performance_map.js`
- `missing_reports.js`
- `style.css`
- `news/`
- `tests/`
- current DNS and GitHub Pages settings, read-only

### Outputs

- Route and asset inventory.
- Current production screenshots for `/`, map page, and news entry point.
- Baseline test output saved outside generated production assets.
- Written current DNS record inventory and rollback values.

### RED / reproduction

Run the existing tests and record any pre-existing failures:

```powershell
node --test tests/*.test.cjs
Push-Location news
npm test
Pop-Location
```

### Minimal implementation intent

Do not change production. Document only the current behavior, data calls, asset dependencies, and DNS state.

### Acceptance criteria

- Existing tests have a recorded baseline.
- The exact DNS records required to return to GitHub Pages are captured.
- The current public site still responds unchanged.

### Rollback

Not applicable; this task is read-only.

## Task 1 — Add Cloudflare build and direct-deploy scaffolding

### Objective

Produce a safe static output containing only runtime assets and deploy it locally with Wrangler.

### Dependencies

Task 0.

### Create

- `wrangler.jsonc`
- `src/worker.js`
- `src/router.js`
- `scripts/build-static.mjs`
- `.dev.vars.example`

### Modify

- `package.json`
- `.gitignore` (create if absent)

### Test

- `tests/build_static.test.cjs`
- `tests/route_manifest.test.cjs`

### Inputs

- Root map sources: `performance_map.html`, `performance_map.js`, `missing_reports.js`, `geo_coords.js`, `mena_geojson.js`, `style.css`, logos.
- Dashboard sources: `index.html`, `dashboard.js`, and their referenced shared assets.
- News output produced by `news` build.

### Outputs

- `dist/index.html` for the map.
- `dist/dashboard/index.html` for the dashboard.
- `dist/news/index.html` and news assets.
- A Worker assets binding to `dist/`.
- Scripts: `build`, `dev`, `test`, `deploy`, and `deploy:dry-run`.

### RED command

```powershell
node --test tests/build_static.test.cjs tests/route_manifest.test.cjs
```

The initial test must fail because the route manifest and safe output do not exist.

### Minimal implementation intent

- Build through an explicit asset allow-list; never point Worker assets at the repository root.
- Run the news build, then copy its output under `/news`.
- Transform root map HTML into `/index.html`.
- Transform current dashboard entry and relative asset links for `/dashboard/`.
- Configure Worker-first handling for protected application and API routes.
- Keep `workers_dev` enabled only for migration testing.

### Narrow verification

```powershell
npm run build
npx wrangler deploy --dry-run
npm run dev
```

Verify locally:

- `/` loads the map.
- `/dashboard` loads the existing dashboard.
- `/news` loads the news application.
- `/map` is not routed.
- `/performance_map.html` redirects to `/`.

### Regression checks

```powershell
node --test tests/*.test.cjs
Push-Location news
npm test
Pop-Location
```

### Rollback

Remove generated Cloudflare scaffolding and `dist/`; the existing GitHub Pages source and deployment remain untouched.

## Task 2 — Deploy an uncutover static candidate

### Objective

Publish the three route shells to a temporary `workers.dev` hostname without changing production DNS.

### Dependencies

Task 1.

### Modify

- Cloudflare account project configuration only.
- No production DNS.

### Outputs

- Temporary candidate URL.
- Deployment identifier recorded for rollback.

### RED / reproduction

Before deployment, the temporary hostname does not exist.

### Minimal implementation intent

Authenticate Wrangler locally, create the Worker project, and deploy the generated static output.

### Narrow verification

```powershell
npx wrangler whoami
npm run deploy
```

Test candidate routes on desktop and mobile while confirming the production domain still serves GitHub Pages.

### Acceptance criteria

- Candidate loads all three applications.
- Production domain and GitHub Pages are unchanged.
- No source-only file, test, Spreadsheet asset, or `.dev.vars` file is downloadable from the candidate.

### Rollback

Delete or disable the candidate Worker; production is unaffected.

## Task 3 — Create D1 schema and runtime repositories

### Objective

Create the transactional store for users mirrored from Sheets, trusted devices, sessions, engagement summaries, and export state.

### Dependencies

Task 1.

### Create

- `migrations/0001_auth_and_tracking.sql`
- `src/auth/device-auth.js`
- `src/tracking/checkpoint.js`
- `src/tracking/finalize.js`
- D1 repository modules colocated with their domain modules

### Modify

- `wrangler.jsonc` with local, preview, and production D1 bindings

### Test

- `tests/d1_schema.test.cjs`
- `tests/device_repository.test.cjs`
- `tests/session_repository.test.cjs`

### Schema intent

Create tables for:

- `users_cache`
- `devices`
- `sessions`
- `session_engagement`
- `security_events`
- `sheet_exports`
- `sync_state`

Important constraints:

- Unique normalized user email.
- Unique device-token hash.
- Foreign keys from device to user and session to user/device.
- Composite uniqueness for session engagement dimensions.
- Snapshot version monotonicity.
- Export idempotency keyed by session and export target.

### RED command

```powershell
npx wrangler d1 migrations apply follow-up-access --local
node --test tests/d1_schema.test.cjs tests/device_repository.test.cjs tests/session_repository.test.cjs
```

Tests initially fail because schema and repositories do not exist.

### Minimal implementation intent

Use prepared statements and bound parameters. Store only SHA-256 hashes of random device credentials. Keep raw device credentials only in secure browser cookies.

### Acceptance criteria

- Duplicate emails and device hashes are rejected safely.
- A stale snapshot version cannot overwrite a newer session snapshot.
- Revoking a user invalidates effective access for all devices.
- Revoking one device leaves other devices valid.

### Rollback

Drop the preview D1 database only. Production is not bound yet.

## Task 4 — Create the Google security registry and gateway

### Objective

Create the five-tab registry, authenticate server-to-server, and expose narrow registry operations to the Worker.

### Dependencies

Task 3.

### Create

- Dedicated Google Spreadsheet for access and tracking registry.
- Tabs: `REGISTRATION`, `USERS`, `TRUSTED_DEVICES`, `SESSION_TRACKING`, `SESSION_ENGAGEMENT`.
- `src/google/auth.js`
- `src/google/registry.js`
- `src/auth/registration-policy.js`

### Modify

- `wrangler.jsonc` required-secret declarations.
- `.dev.vars.example` with names only, never values.

### Test

- `tests/registration_policy.test.cjs`
- `tests/registry_mapping.test.cjs`
- `tests/registry_sync.test.cjs`

### Inputs

Cloudflare Secrets:

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `SECURITY_SPREADSHEET_ID`

### Outputs

- Strictly validated registration mode.
- Normalized allow-list.
- User and device status synchronization into D1.
- Idempotent finalized-session export functions.

### RED command

```powershell
node --test tests/registration_policy.test.cjs tests/registry_mapping.test.cjs tests/registry_sync.test.cjs
```

### Required registration state matrix

Automated tests must prove:

| Existing user | User status | Mode | Email listed | Result |
| --- | --- | --- | --- | --- |
| No | n/a | PUBLIC | No | Register |
| No | n/a | RESTRICTED_TO_LIST | Yes/enabled | Register |
| No | n/a | RESTRICTED_TO_LIST | No | Deny |
| Yes | ACTIVE | Either | No | Allow new-device verification |
| Yes | INACTIVE | Either | Yes | Deny |

Additional test: changing mode never mutates users, devices, or sessions.

### Minimal implementation intent

- Treat unknown registration-mode values as restricted, not public.
- Never expose the registry Spreadsheet ID or service-account values to the browser.
- Fetch and write only named ranges or fixed columns.
- Mirror control data to D1 on a schedule and on registration/revocation writes.

### Narrow verification

Run against a disposable preview Spreadsheet first. Switch between both modes and compare D1 state before and after; existing security state must remain byte-for-byte equivalent except sync timestamps.

### Acceptance criteria

- Public and restricted registration behave exactly as approved.
- Existing active users can verify another device regardless of current registration mode.
- Spreadsheet outage produces a controlled, fail-closed response for new registration.
- No raw device credential is written to Google Sheets.

### Rollback

Unbind the preview Spreadsheet secrets and retain the Spreadsheet for inspection. No production data is affected.

## Task 5 — Add Cloudflare Access OTP registration

### Objective

Use email OTP only for first-time user/device verification, then issue the application trusted-device credential.

### Dependencies

Tasks 3 and 4.

### Create

- `src/auth/access-identity.js`
- `src/routes/auth-routes.js`
- `client/auth/map-registration.js`
- Registration/profile HTML and CSS assets

### Modify

- `src/router.js`
- Cloudflare Zero Trust Access application for `/auth/register/*`

### Test

- `tests/access_identity.test.cjs`
- `tests/registration_flow.test.cjs`
- `tests/device_cookie.test.cjs`

### Inputs

- Validated Access JWT/email identity.
- Registration mode and allow-list.
- User-entered display name for first registration.
- Server-derived request metadata.

### Outputs

- D1 user record/cache entry.
- D1 trusted-device record.
- Mirrored `USERS` and `TRUSTED_DEVICES` rows.
- `__Host-map_device` secure cookie.

### RED command

```powershell
node --test tests/access_identity.test.cjs tests/registration_flow.test.cjs tests/device_cookie.test.cjs
```

### Minimal implementation intent

- Redirect unknown devices to the Access-protected registration path.
- Validate Access identity server-side; do not trust an email submitted by client JavaScript.
- Generate at least 256 bits of random device credential material.
- Store only a cryptographic hash in D1.
- Automatically mark the device `TRUSTED` after successful OTP and policy evaluation.
- Use generic denial messages to reduce email-enumeration leakage.

### Acceptance criteria

- A new browser must complete OTP exactly once before map access.
- Reloading or returning on the trusted browser does not require login.
- A second browser/device performs its own OTP once.
- Clearing the cookie requires verification again.
- `INACTIVE` user and `REVOKED` device are denied.
- No device token is readable through client JavaScript.

### Rollback

Disable the preview Access application and remove preview device rows. Static candidate remains available for continued development if explicitly bypassed in a local-only environment.

## Task 6 — Move business data behind Worker APIs

### Objective

Remove direct Google data URLs and client-side identifiers from served map and dashboard code.

### Dependencies

Tasks 1 and 5.

### Create

- `src/google/business-data.js`
- `src/routes/map-api.js`
- `src/routes/dashboard-api.js`
- `src/shared/validation.js`
- `src/shared/errors.js`

### Modify

- `performance_map.js`
- `dashboard.js`
- `scripts/build-static.mjs`
- existing frontend parser tests as necessary

### Test

- `tests/map_api.test.cjs`
- `tests/dashboard_api.test.cjs`
- `tests/no_public_origins.test.cjs`
- existing map tests

### Inputs

Secrets/configuration:

- `BUSINESS_SPREADSHEET_ID`
- Google service-account credentials
- Existing Apps Script origin if the dashboard filter write remains proxied during the first migration

### Outputs

- Same-origin map and dashboard JSON endpoints.
- Normalized response contracts.
- Fixed allow-list of business sheets/ranges.

### RED command

```powershell
node --test tests/map_api.test.cjs tests/dashboard_api.test.cjs tests/no_public_origins.test.cjs
```

The public-origin test scans generated assets and must initially fail on current Google URLs, Spreadsheet IDs, Apps Script URL, and client-side password.

### Minimal implementation intent

- Replace JSONP and direct script injection with `fetch()` to Worker endpoints.
- Preserve date, formatted-number, percentage, missing-report, and map-registry semantics.
- Do not expose a generic `sheet`, `gid`, `range`, or upstream-URL proxy parameter.
- Authenticate map API with trusted device and dashboard API with dashboard session.

### Narrow verification

- Compare record counts and selected normalized rows between old and candidate deployments.
- Compare all visible KPI totals and map modes.
- Verify the browser network panel never contacts `docs.google.com` or `script.google.com` for protected business data.

### Regression checks

```powershell
node --test tests/*.test.cjs
```

### Acceptance criteria

- Candidate output contains no direct business origin or legacy client-side map password.
- Map and dashboard results match the old site for a fixed data snapshot.
- Upstream failures show controlled UI errors and do not leak URLs or credentials.

### Rollback

Redeploy the previous candidate version. Production GitHub Pages remains unchanged.

## Task 7 — Implement the map session tracker

### Objective

Track active map sessions, mode/layer time, country/project engagement, and approved metadata with low request volume.

### Dependencies

Tasks 3, 5, and 6.

### Create

- `client/tracking/session-tracker.js`
- `client/tracking/device-metadata.js`
- `src/tracking/metadata.js`
- `src/routes/tracking-api.js`

### Modify

- `performance_map.html`
- `performance_map.js`
- `scripts/build-static.mjs`
- `src/router.js`

### Test

- `tests/session_tracker.test.cjs`
- `tests/tracking_api.test.cjs`
- `tests/tracking_visibility.test.cjs`
- `tests/tracking_idempotency.test.cjs`

### Inputs

Client state transitions from existing map functions:

- `toggleBusinessAnalysisMode`
- `toggleEarlyWarningMode`
- `toggleMapLayer`
- `setCompletionSlicerEnabled`
- `toggleTileLayerStyle`
- `openCountryDrawer`
- `openProjectDetailModal` / project action flow
- visibility, focus, blur, and qualifying activity events

### Outputs

- Aggregated session snapshot.
- Layer/mode active seconds.
- Project and country active seconds and open counts.
- Server-derived country/region/city/timezone.
- Normalized phone/tablet/computer, OS, and browser metadata.

### RED command

```powershell
node --test tests/session_tracker.test.cjs tests/tracking_api.test.cjs tests/tracking_visibility.test.cjs tests/tracking_idempotency.test.cjs
```

### Minimal implementation intent

- Model tracking as explicit state transitions, not DOM scraping.
- Pause after 120 seconds of inactivity.
- Pause immediately when the page becomes hidden.
- Resume on qualifying interaction.
- Aggregate locally; do not transmit raw mouse/touch events.
- Persist one pending latest snapshot locally for offline recovery.
- Send only dirty snapshots every five minutes, on hidden/pagehide, and at normal end.
- Use `sendBeacon`, falling back to `fetch` with `keepalive`.
- Validate maximum payload size, enums, IDs, counts, and durations on the Worker.
- Upsert only when the incoming version is newer.

### Narrow verification

Use a fake clock to prove exact durations for:

- Default map to business analysis transition.
- Business analysis to early warning transition.
- Project A open, close, reopen.
- Hidden tab pause.
- Two-minute inactivity pause and interaction resume.
- Duplicate and out-of-order snapshots.
- Offline close followed by next-visit recovery.

### Acceptance criteria

- One hour of normal use generates no more than the expected dirty checkpoints plus lifecycle flushes.
- Hidden and idle time never inflates active time.
- Project and layer totals never exceed session active time except where intentionally overlapping dimensions are documented.
- Server metadata overrides any conflicting client location value.
- Tracker failure never breaks map interaction.

### Rollback

Disable the tracker through a Worker configuration flag while leaving authentication and map functionality intact.

## Task 8 — Finalize sessions and export summaries to Google Sheets

### Objective

Write one session summary and normalized engagement rows to Sheets without writing every checkpoint.

### Dependencies

Tasks 4 and 7.

### Modify

- `src/tracking/finalize.js`
- `src/google/registry.js`
- `wrangler.jsonc` scheduled trigger

### Test

- `tests/session_finalize.test.cjs`
- `tests/session_export.test.cjs`

### RED command

```powershell
node --test tests/session_finalize.test.cjs tests/session_export.test.cjs
```

### Minimal implementation intent

- Finalize on explicit end when available.
- Scheduled recovery finalizes sessions abandoned beyond the configured idle window.
- Export finalized sessions only.
- Record export keys in D1 before/after write safely so retries cannot duplicate rows.
- Update `TRUSTED_DEVICES.LAST_SEEN_AT` and last-region metadata at coarse intervals, not every checkpoint.

### Acceptance criteria

- Normal session produces exactly one `SESSION_TRACKING` row.
- Each unique engagement dimension produces one `SESSION_ENGAGEMENT` row.
- Retrying export does not duplicate rows.
- Browser crash loses at most the interval since the latest D1 checkpoint.
- Google Sheets receives no five-minute checkpoint traffic.

### Rollback

Disable the scheduled exporter. D1 retains complete checkpoints for later replay.

## Task 9 — Add separate dashboard and news password gates

### Objective

Replace client-side or absent protection with independent server-side password sessions.

### Dependencies

Tasks 1 and 3.

### Create

- `src/auth/password-auth.js`
- Dashboard and news login assets/routes

### Modify

- `src/router.js`
- `wrangler.jsonc` required-secret names
- `dashboard.js` to remove the client-side `1911` map gate and point map navigation to `/`

### Test

- `tests/password_auth.test.cjs`
- `tests/application_gate.test.cjs`
- `tests/security_headers.test.cjs`

### Inputs

Secrets:

- `DASHBOARD_PASSWORD_HASH`
- `NEWS_PASSWORD_HASH`
- `SESSION_SIGNING_SECRET`

### Outputs

- Path-scoped signed dashboard session cookie.
- Path-scoped signed news session cookie.
- Rate-limited login handlers.

### RED command

```powershell
node --test tests/password_auth.test.cjs tests/application_gate.test.cjs tests/security_headers.test.cjs
```

### Minimal implementation intent

- Compare password verifiers server-side only.
- Use separate secrets and cookies for the two applications.
- Apply Secure, HttpOnly, SameSite, expiry, CSRF/origin checks, and attempt throttling.
- Never embed a password or verifier in served JavaScript.

### Acceptance criteria

- Map trusted-device access grants no dashboard/news access.
- Dashboard password grants no map/news access.
- News password grants no map/dashboard access.
- Repeated failures are throttled.
- Generated assets contain no password or verifier.

### Rollback

Redeploy the previous candidate. Production remains unchanged.

## Task 10 — Candidate security and end-to-end acceptance

### Objective

Prove the Cloudflare candidate is functionally equivalent, access-controlled, private-origin, and operationally recoverable before touching DNS.

### Dependencies

Tasks 2 through 9.

### Create

- `tests/e2e/` browser tests for route and authentication journeys
- `docs/operations/cloudflare-deploy-and-rollback.md`
- `docs/operations/access-registry-runbook.md`

### Test journeys

1. Public-mode first registration.
2. Restricted listed registration.
3. Restricted unlisted denial.
4. Existing active user registers second device after mode change.
5. Inactive user denial.
6. One-device revocation while another device remains trusted.
7. Map tracking with layer and project transitions.
8. Dashboard password access.
9. News password access.
10. Google origin outage and controlled error handling.
11. D1 checkpoint recovery and Sheets export retry.

### Verification commands

```powershell
npm test
npm run build
npm run deploy:dry-run
```

Run the full E2E suite against the candidate hostname, then manually verify mobile and desktop layouts.

### Security scan assertions

Generated/browser-served assets must not contain:

```text
docs.google.com
script.google.com
SPREADSHEET_ID
SHEET_ID
GAS_URL
1911
private_key
service-account
```

### Acceptance criteria

- All automated and manual checks pass.
- Registration-mode change does not reset security state.
- Session quota behavior matches the five-minute dirty-checkpoint design.
- A previous Worker deployment has been successfully restored once in preview as a rollback rehearsal.
- Production domain remains on GitHub Pages throughout this task.

### Rollback

Restore the last known-good candidate deployment. No DNS action is necessary.

## Task 11 — Make business data private

### Objective

Remove direct public access to business Sheets only after the candidate Worker access path is proven.

### Dependencies

Task 10.

### Changes

- Share the business Spreadsheet with the Worker service account at the minimum required permission.
- Change general Spreadsheet access to restricted.
- Keep the security registry private.

### Narrow verification

- Candidate map and dashboard still load all data.
- Direct anonymous Google URL access fails.
- Candidate tracking and auth registry remain functional.

### Acceptance criteria

- All candidate data comparisons still pass.
- No user browser makes direct Google business-data requests.

### Rollback

Prefer fixing or rolling back the Worker. Temporarily restoring old sharing is an emergency-only rollback because it reopens direct access.

## Task 12 — Final domain cutover

### Objective

Move `sabi-arabco.site` from GitHub Pages to the accepted Worker as the last migration step.

### Dependencies

Task 11 and an explicitly approved cutover window.

### Pre-cutover checks

- Record current DNS values again.
- Record the accepted Worker deployment ID.
- Confirm access to domain registrar and Cloudflare dashboard.
- Confirm rollback operator and decision window.
- Confirm map, dashboard, and news passwords/secrets are production values.
- Confirm Access OTP registration route is active on the custom hostname.

### Changes

- Add Worker Custom Domain `sabi-arabco.site`.
- Remove only conflicting GitHub Pages DNS records when Cloudflare requires it.
- Do not create `/map`.
- Keep `workers.dev` enabled during the short observation window.

### Immediate verification

```text
/             -> map trusted-device flow
/dashboard    -> dashboard password flow
/news         -> news password flow
/map          -> not found
/api/map/*    -> rejects untrusted requests
```

Test from an existing trusted browser, a new incognito browser, a phone, and a desktop.

### Acceptance criteria

- TLS is valid.
- All three final routes behave exactly as specified.
- OTP, device registration, password gates, business data, and tracking work on the custom domain.
- Error and latency metrics remain acceptable during the observation window.

### Rollback

1. Restore the previous Worker deployment if the failure is application-level.
2. If Worker rollback fails, restore the recorded GitHub Pages DNS values.
3. Remember that the old client cannot read a now-private Spreadsheet; DNS rollback alone is incomplete unless the old data-access model is temporarily restored.

## Task 13 — Retire alternate public entry points

### Objective

Close the old and temporary hosting paths after the custom domain is stable.

### Dependencies

Task 12 observation window completed successfully.

### Changes

- Set `workers_dev` to `false` and redeploy.
- Disable GitHub Pages.
- Remove obsolete `CNAME` deployment behavior from the new build path.
- Keep the repository/local source untouched unless the user separately authorizes repository privacy or deletion actions.

### Verification

- Custom domain continues serving all routes.
- `workers.dev` no longer provides an alternate application URL.
- GitHub Pages URL no longer serves the site.
- Direct local deployment still succeeds.

### Rollback

Re-enable `workers.dev` or GitHub Pages only as an emergency measure, understanding that the old client is incompatible with private business data.

## Final verification matrix

| Area | Required proof |
| --- | --- |
| Routing | Root map, `/dashboard`, `/news`, and no `/map` |
| Parallelism | Production unchanged until Task 12 |
| Registration | Public/restricted state matrix passes |
| State preservation | Mode changes do not mutate users/devices/sessions |
| Trusted devices | OTP once per new browser, automatic trust, independent revoke |
| User status | Inactive user blocks every device |
| Tracking | Active-only time, two-minute idle pause, five-minute dirty checkpoints |
| Engagement | Layer, country, and project summaries with open source |
| Metadata | Approximate region and normalized phone/tablet/computer |
| Quota | D1 checkpoints; Sheets final summaries only |
| Secrets | No upstream IDs, keys, or passwords in served assets |
| Deployment | Local one-command deploy |
| Cutover | Custom domain last, rehearsed rollback available |

## Recommended implementation order

Execute tasks sequentially except for these safe parallel workstreams after Task 1:

- D1 schema/repositories in Task 3 can proceed alongside the Google registry fixture preparation in Task 4.
- Dashboard/news gate tests in Task 9 can proceed alongside map tracking unit tests in Task 7 after shared cookie utilities are stable.
- Documentation/runbook drafting can proceed during candidate acceptance.

Do not parallelize business-data privacy changes, DNS cutover, or alternate-host retirement. Those steps are ordered safety gates.
