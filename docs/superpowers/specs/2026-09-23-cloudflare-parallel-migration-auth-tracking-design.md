# Cloudflare Parallel Migration, Access, and Session Tracking Design

## Goal

Move the current client-side site from GitHub Pages to a directly deployed Cloudflare Worker without interrupting the live site. Keep the existing GitHub Pages deployment serving production while a complete Cloudflare candidate is built and verified on a temporary hostname. Move `sabi-arabco.site` only after the candidate passes functional, security, and tracking acceptance checks.

The final public routes are fixed:

- `https://sabi-arabco.site/` serves the performance map. There is no `/map` route.
- `https://sabi-arabco.site/dashboard` serves the existing follow-up dashboard.
- `https://sabi-arabco.site/news` serves the news application.

## Scope

This design covers:

- Direct deployment from the local workstation with Wrangler; GitHub is not part of the deployment pipeline.
- Cloudflare Worker static asset hosting for the three applications.
- Worker APIs that hide Google Spreadsheet and Google Apps Script origin URLs from browser code.
- One-time email OTP registration for the map on each new browser/device.
- Persistent trusted-device access after the first successful OTP.
- User and device activation controls.
- Map session tracking, layer dwell time, project dwell time, metadata, and quota-conscious batching.
- Separate password-only gates for `/dashboard` and `/news`.
- Parallel rollout and last-step domain cutover.

This design does not include the future analytics dashboard or Google Apps Script analytics UI. The tracking schema intentionally supports that future work.

## Deployment topology

### During migration

- GitHub Pages remains unchanged and continues serving the current production domain.
- Cloudflare serves a candidate deployment on the project `workers.dev` hostname.
- The candidate reads from the same business data source through the Worker API.
- Security registry and tracking data use a dedicated Google Spreadsheet and Cloudflare D1 database.
- No DNS record is changed until the cutover checklist passes.

### After cutover

- A Worker Custom Domain owns `sabi-arabco.site`.
- `workers.dev` is disabled after the custom domain is verified.
- GitHub Pages is disabled only after production verification.
- New deployments run locally with `npm run deploy`.

## Application routing

The Worker is the only public origin and routes requests by path:

| Route | Application | Authentication |
| --- | --- | --- |
| `/` and map assets | Performance map | Trusted device cookie |
| `/auth/register/*` | Map device registration | Cloudflare Access OTP |
| `/api/map/*` | Map data and tracking API | Trusted device cookie |
| `/dashboard` and `/dashboard/*` | Existing follow-up dashboard | Dashboard password session |
| `/api/dashboard/*` | Dashboard data API | Dashboard password session |
| `/news` and `/news/*` | News application | News password session |
| `/api/news/*` | News server endpoints, if needed | News password session |

`/performance_map.html` redirects to `/` after cutover. `/index.html` redirects to `/dashboard`. `/map` is not created and returns the normal not-found response.

## Registration policy

The dedicated security registry Spreadsheet has a `REGISTRATION` tab. Its condition cell accepts exactly:

- `PUBLIC`
- `RESTRICTED_TO_LIST`

When the mode is `PUBLIC`, any email address successfully verified by Cloudflare Access OTP may create a new user account.

When the mode is `RESTRICTED_TO_LIST`, a new account may be created only if the normalized email address exists in the enabled allow-list in the same tab.

The mode governs only first-time user registration. Changing it must not:

- Activate or deactivate an existing user.
- Trust or revoke an existing device.
- Invalidate an existing device token.
- Modify or delete historical sessions.
- Prevent an existing active user from verifying an additional new device.

An existing `INACTIVE` user is denied regardless of registration mode or allow-list membership. User status has higher precedence than registration eligibility.

## Google Spreadsheet tabs

The security and tracking registry uses five tabs.

### `REGISTRATION`

- `B1`: registration mode, validated to `PUBLIC` or `RESTRICTED_TO_LIST`.
- Allow-list columns: `EMAIL`, `ENABLED`, `ADDED_AT`, `NOTES`.
- Emails are trimmed and normalized to lowercase before comparison.

### `USERS`

Columns:

- `USER_ID`
- `USER_NAME`
- `EMAIL`
- `USER_STATUS` (`ACTIVE` or `INACTIVE`)
- `REGISTERED_AT`
- `DEACTIVATED_AT`
- `NOTES`

Email is unique, but `USER_ID` is the stable relationship key.

### `TRUSTED_DEVICES`

Columns:

- `DEVICE_ID`
- `USER_ID`
- `USER_NAME`
- `EMAIL`
- `DEVICE_STATUS` (`TRUSTED` or `REVOKED`)
- `DEVICE_TYPE` (`PHONE`, `TABLET`, or `COMPUTER`)
- `OPERATING_SYSTEM`
- `BROWSER`
- `FIRST_ACTIVATED_AT`
- `LAST_SEEN_AT`
- `LAST_COUNTRY`
- `LAST_REGION`
- `LAST_CITY`
- `LAST_TIMEZONE`
- `REVOKED_AT`

No raw trusted-device credential or device-token hash is stored in Google Sheets.

### `SESSION_TRACKING`

One row summarizes one map session:

- `SESSION_ID`
- `USER_ID`
- `DEVICE_ID`
- `STARTED_AT`
- `ENDED_AT`
- `ACTIVE_SECONDS`
- `COUNTRY`
- `REGION`
- `CITY`
- `TIMEZONE`
- `DEVICE_TYPE`
- `OPERATING_SYSTEM`
- `BROWSER`
- `END_REASON`

### `SESSION_ENGAGEMENT`

One row summarizes engagement with one layer, country, or project inside a session:

- `SESSION_ID`
- `USER_ID`
- `DEVICE_ID`
- `ENGAGEMENT_TYPE` (`LAYER`, `COUNTRY`, or `PROJECT`)
- `MODE_NAME`
- `PROJECT_ID`
- `PROJECT_NAME`
- `COUNTRY`
- `BRANCH`
- `OPEN_SOURCE`
- `OPEN_COUNT`
- `ACTIVE_SECONDS`

This normalized layout is intentionally compatible with future Google Apps Script analytics without parsing JSON cells.

## User and trusted-device journey

1. A request to the map arrives without a valid trusted-device cookie.
2. The Worker redirects to `/auth/register/start`.
3. Cloudflare Access OTP verifies control of the email address.
4. The Worker obtains and validates the Access identity.
5. The user supplies their display name when registering for the first time.
6. The Worker evaluates existing user status before registration policy.
7. For a new user, the Worker applies `PUBLIC` or `RESTRICTED_TO_LIST`.
8. On success, the Worker creates or resolves `USER_ID`.
9. The Worker creates a random trusted-device credential, stores only its hash in D1, and creates the device row with `TRUSTED` status.
10. The raw credential is returned only in a `Secure`, `HttpOnly`, `SameSite=Lax` cookie.
11. The browser is redirected to `/` and does not see OTP again on that browser profile while the trusted-device credential remains present and valid.

A different device or browser profile performs the same OTP flow once. Clearing browser storage removes the local credential and requires OTP again. The design does not claim to identify physical hardware; `DEVICE_ID` identifies one trusted browser installation.

## Activation and revocation

Effective map access requires both:

```text
USER_STATUS = ACTIVE
AND
DEVICE_STATUS = TRUSTED
```

Setting a user to `INACTIVE` blocks every linked device. Setting one device to `REVOKED` blocks only that device. Runtime status is synchronized from the Spreadsheet control plane into D1 so protected requests do not query Google Sheets continuously.

Synchronization rules:

- A scheduled Worker imports registration mode, allow-list changes, users, and device status into D1.
- Registration and revocation operations update D1 transactionally, then mirror administrative rows to Google Sheets.
- Protected API calls fail closed when a user or device is inactive/revoked.
- A tracking checkpoint rechecks effective access and can terminate an already-open map session.

## Session definition

A map session is not a login. A session begins automatically whenever an already trusted device opens the map in a new browsing session.

The tracker measures active attention, not wall-clock page-open time:

- Time counts only while the document is visible.
- Time pauses after two minutes without qualifying interaction.
- Time resumes on the next qualifying interaction.
- Mouse movement, touch, keyboard use, map pan/zoom, layer changes, country selection, and project selection refresh activity, but raw movements are not stored.

Tracked map modes:

- `DEFAULT_MAP`
- `BUSINESS_ANALYSIS`
- `EARLY_WARNING`

Tracked display state includes projects, branches, completion filter, and base-tile style. Tracked engagement includes countries and projects, together with the source that opened them.

## Quota-conscious checkpointing

The browser aggregates durations and counts locally. It does not send one request per interaction.

It sends a versioned session snapshot only:

- Every five minutes when the snapshot is dirty.
- When the document becomes hidden.
- At normal session end using `sendBeacon` or `fetch(..., { keepalive: true })`.
- On the next visit if an offline or interrupted snapshot remains pending locally.

D1 receives idempotent upserts keyed by `SESSION_ID` and monotonically increasing snapshot version. A repeated or late older snapshot cannot roll data backward.

Google Sheets is not updated at every checkpoint. Finalized session and engagement summaries are exported once. A scheduled recovery job finalizes abandoned sessions from their latest D1 checkpoint and exports them idempotently.

## Metadata

Server-derived metadata uses Cloudflare request metadata for country, region, city, and timezone. It is approximate IP-based geography, not GPS.

Client metadata is normalized to:

- Device type: `PHONE`, `TABLET`, or `COMPUTER`.
- Operating-system family.
- Browser family.

The system does not retain precise coordinates, raw mouse activity, keystrokes, or a long-lived raw IP address.

## Dashboard and news authentication

`/dashboard` and `/news` use separate server-side password gates. Password material is stored only in Cloudflare Secrets. A successful login issues a signed, expiring, `HttpOnly` cookie scoped to the application path. Password checks are rate-limited and use generic failure responses.

These password sessions are separate from map users, trusted devices, and map session tracking.

## Business-data protection

The map and dashboard stop fetching Google endpoints directly. Browser code calls same-origin Worker endpoints. The Worker:

- Holds Spreadsheet IDs, Google service-account material, and the existing Apps Script origin as secrets.
- Uses a fixed allow-list of sheets/ranges and never acts as an arbitrary Spreadsheet proxy.
- Normalizes responses into application JSON.
- Applies the authentication policy of the calling application.
- Returns generic errors without upstream credentials or URLs.

The business Spreadsheet is changed from link-public to restricted only after the Worker path is verified in the candidate deployment.

## Parallel migration and rollback

The current production site remains untouched until all candidate checks pass. The migration order is deliberately reversible:

1. Build and deploy static candidate.
2. Add Worker APIs while Google data remains compatible with the old site.
3. Add D1, registration, trusted devices, and tracking.
4. Add dashboard and news password gates.
5. Verify the full candidate on `workers.dev` with test users and devices.
6. Make Google business data private only after the candidate reads it successfully.
7. Bind the custom domain and verify production.
8. Disable `workers.dev` and GitHub Pages after the observation window.

Before domain cutover, rollback means continuing to use the unchanged GitHub Pages site. After cutover, rollback first uses a previous Worker deployment. DNS is moved back only if the Worker rollback fails; if Google data has already been made private, the old client cannot read it and is not a complete rollback target without temporarily restoring its old sharing model.

## Definition of done

- `/` is the map, `/dashboard` is the follow-up dashboard, and `/news` is the news application.
- No `/map` route exists.
- The old site remains live throughout candidate development.
- Local `npm run deploy` publishes without GitHub.
- Google origin URLs, Spreadsheet IDs, service credentials, and passwords are absent from served JavaScript.
- New-device map access requires OTP once, then persists through a trusted-device cookie.
- Registration mode changes affect only new users and do not reset security state.
- User and device revocation work independently.
- Session time pauses on hidden/idle states and records layer/project attention.
- Checkpoints are batched and idempotent.
- Final session summaries appear in `SESSION_TRACKING` and `SESSION_ENGAGEMENT`.
- Domain cutover occurs only after acceptance and rollback rehearsal.
