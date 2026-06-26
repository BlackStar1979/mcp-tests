# Active artifact sanitation pass

Date: 2026-06-25
Status: GREEN / ACTIVE ARTIFACTS SANITIZED / NO RUNTIME CHANGE

## Scope

A second automated scan found retired progress-state dependencies outside active root specs but still present in active `_tests` and `_workflow/scripts`. These files were not current run-all entries, but their location could mislead future agents.

## Repairs

- Moved inactive progress-state dependent validators from `_tests/` and `_workflow/scripts/` to `_workflow/historical/progress_state_dependent_validators/`.
- Added `_workflow/historical/progress_state_dependent_validators/README.md`.
- Updated active tests that intentionally inspect those historical files to use the historical path.
- Removed literal retired active tokens from negative guard text by constructing them dynamically.
- Added `_tests/smoke_no_progress_state_active_artifacts.js` and registered it in run-all.

## Validation

- active scan for retired progress-state/root-stage tokens -> no hits
- run-all manifest -> no missing files, no duplicates
- full `run_all_smokes --skip-network` -> ok, public=6, tests_authenticated=169

## Current truth

Retired progress-state validation files are historical only. Active root specs, state, sessionless inventory, README, active tests, and active scripts must not contain the old progress-state fields or the retired Stage12 root filename.
