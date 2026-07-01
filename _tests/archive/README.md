# _tests/archive

This directory is an archive boundary inside `_tests`.

## Interpretation rules

- Files here are not part of the active top-level `_tests` validation surface.
- Archived filenames may preserve stage-era names, superseded assumptions, or broken historical scaffolding exactly as they existed when retired.
- A grep hit in this directory is archival evidence first, not current workflow guidance.

## Current subdirectories

- `legacy_retired_auth/`: retired access/bearer auth tests kept only as archive evidence plus rewrite candidates already consolidated into active negative controls.
- `non_run_all_stale/`: stale or broken tests removed from the current top-level review surface.

## Operational rules

- Do not move a file out of this directory without rewriting it against current specs and current workflow truth.
- Do not treat archived filenames as authoritative naming guidance for new active tests.
