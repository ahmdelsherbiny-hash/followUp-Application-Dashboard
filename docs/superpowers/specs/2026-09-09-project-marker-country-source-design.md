# Project Marker Country Source Design

## Goal

Keep project markers inside the country assigned by the Map Registry while preserving precise Google Maps locations whenever the project link contains usable coordinates.

## Rules

1. A valid coordinate extracted from the project Google Maps link is the highest-priority location.
2. If the link is present but does not contain extractable coordinates, do not infer a location from the entity or branch display name.
3. The fallback location must come from the project `countryName` supplied by the joined Map Registry record.
4. Country identity is based on the country name resolver; project placement must not depend on `GN`, `GQ`, or any other entity-name coordinate alias.
5. Existing exact project coordinates remain available only after a usable Maps link and before the country fallback, because they are project-specific data rather than entity-name inference.

## Implementation Boundary

- Update `geo_coords.js` project coordinate resolution only.
- Preserve direct Maps coordinate extraction and exact project-coordinate overrides.
- Remove the branch-coordinate fallback from the project marker path.
- Keep branch coordinates for entity markers, which are separate informational markers.

## Verification

- A project with a valid Maps URL uses the URL coordinates.
- A project with a short/unparseable Maps URL and `countryName = Equatorial Guinea` falls back inside Equatorial Guinea.
- The same project must not use the `GN` branch alias coordinates.
- `geo_coords.js` and `performance_map.js` pass syntax checks.
