# _workflow/historical

This directory is the workflow-history archive boundary.

## Interpretation rules

- Contents here are historical records, not active machine authority.
- Historical files may intentionally preserve superseded routes, stage-era numbering, old validators, and obsolete assumptions.
- A string hit here does not make that string current.

## Current contents

- `progress_state_dependent_validators/`: validators retired when `_workflow/state.json` was reduced back to a compact orientation map.
- `stage12_workflow_history.json`: chronological historical record, not the active workflow controller.

## Operational rules

- Do not infer current next work from this directory unless an active workflow file explicitly points here as evidence.
- Do not copy historical numbering or chronology from here back into active specs, state files, or new operator-decision records.
