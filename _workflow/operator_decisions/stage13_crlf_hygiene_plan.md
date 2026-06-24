# Stage 13.3 - CRLF Hygiene Plan

Status: GREEN / PLAN AND GUARD ONLY
Date: 2026-06-24

## Scope

Stage 13.3 records a controlled CRLF hygiene plan for the repository. It does not normalize the existing tree and does not rewrite files solely to change line endings.

## Boundary

server_change: false
workflow_change: true
schema_change: false
runtime_restart_required: false
connector_refresh_required: false
backup_required: false
rollback_path: revert workflow-only documentation/state/test-guard changes
restore_path: this file, _workflow/WORKFLOW_CANON.md, _workflow/ACTIVE_WORKFLOW_INDEX.md, _workflow/state.json, _tests/smoke_stage13_crlf_hygiene_plan.js, _tests/run_all_smoke_scripts.json, _tests/smoke_stage12_streamable_http_workflow_plan.js

## Observed evidence

- The repository already has .gitattributes line-ending policy.
- .gitattributes declares LF for .gitattributes, .gitignore, Dockerfile, *.js, *.json, *.jsonl, *.md, *.txt, *.yml, and *.yaml.
- .gitattributes declares CRLF for *.ps1.
- Read-only scan checked 632 tracked text files.
- Current working-tree CRLF population: 191 tracked text files.
- CRLF split: 180 .js files, 7 .md files, and 4 .json files.
- Repeated git operations surfaced CRLF warnings where touched files are already covered by .gitattributes.

## Decision

Do not run global normalization in Stage 13.3. Specifically, do not run git add --renormalize ., do not rewrite the whole repository, and do not create whitespace-only churn under a semantic workflow checkpoint.

The repository should instead use incremental hygiene:

1. Keep the existing .gitattributes policy as the source policy.
2. When a file is substantively edited, allow Git to converge that touched file to its declared EOL policy.
3. If a future dedicated normalization stage is approved, normalize in small batches by file class, preferably tests first, then workflow docs, then root specs.
4. Each batch must record before/after CRLF counts and run targeted validation plus run_all smoke.
5. Preserve *.ps1 CRLF unless a PowerShell-specific decision changes that policy.
6. Treat standalone line-ending churn as a separate migration, not incidental cleanup.

## Guard expectations

The Stage 13.3 guard checks that the policy remains plan-only, that .gitattributes still contains the expected LF/CRLF declarations, and that workflow state marks Stage 13.3 as green without authorizing runtime actions or global normalization.

## Non-actions

- no mass line-ending normalization
- no git add --renormalize .
- no runtime code patch
- no deploy
- no runtime restart
- no connector refresh
- no public connector reconnect
- no runtime enforcement
- no allow/deny behavior change
- no dispatch behavior change
- no hotplug/list_changed emission
- no sessionless migration
