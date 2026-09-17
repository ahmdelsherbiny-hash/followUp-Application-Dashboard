# Map Data Disclaimer Design

## Goal

Show a soft disclaimer whenever `performance_map.html` is opened or refreshed. The notice explains that the displayed data is current through the same last-update date shown in the map header.

## Interaction

- Present a centered dialog on every page load after the map data has been processed.
- Keep the dialog visible until the user explicitly closes it.
- Provide a clear close button and support closing with the Escape key.
- Return focus appropriately after keyboard dismissal.
- Do not persist a dismissed state across reloads or sessions.

## Content and date source

- Render the exact Arabic disclaimer supplied by the user.
- Use the same computed latest-report date and formatting as the top-right header.
- Compute the value once and apply it to both the header date elements and the disclaimer date element so they cannot drift.
- If no valid report date exists, display the same `--` fallback in both locations.

## Visual design

- Use a centered, responsive dialog with a restrained translucent backdrop.
- Match the existing map typography, colors, rounded corners, and dark/light themes.
- Add a short soft fade-in while respecting `prefers-reduced-motion`.
- Constrain the dialog within narrow mobile viewports with wrapped text and no horizontal overflow.

## Implementation boundary

- Add the dialog markup and scoped styles to `performance_map.html`.
- Extend the existing last-update flow in `performance_map.js`; do not add a dependency or a separate data request.
- Keep the disclaimer independent from the existing missing-reports dialog.

## Verification

- Confirm the disclaimer opens on each fresh page initialization and stays open until dismissed.
- Confirm its displayed date equals every visible header last-update date.
- Confirm close-button and Escape behavior.
- Confirm the fallback date is synchronized when reports contain no valid date.
- Check syntax, existing automated tests, dark/light styling, and desktop/mobile containment.
