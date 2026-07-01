# Archived Legacy Retired Auth Tests

This directory preserves historical tests for retired access/bearer auth modes.

## Interpretation rules

- These files are archived only and are not active coverage.
- Historical names such as `smoke_stage*` are preserved as evidence labels, not as current naming authority.
- Current auth truth is OAuth21-based and the active consolidated guard is `_tests/smoke_legacy_retired_auth_negative_controls.js`.

## Operational rules

- Do not restore these files to top-level `_tests` unchanged.
- If any behavior needs to return as active coverage, rewrite it against current canonical specs and current runtime topology first.
