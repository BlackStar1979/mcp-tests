# POL-1A prompt/content live closeout

Status: GREEN / LIVE ACCEPTED / CONNECTOR UNCHANGED
Date: 2026-08-21
Package: `POL-1A-PROMPT-CONTENT`

## Declarations

- server_change: true
- workflow_change: true
- schema_change: false
- runtime_restart_required: true and completed
- connector_refresh_required: false
- backup_required: true via Git commit boundary and structured-file backups
- rollback_path: revert source commit `20ab92155dfb9ba356d079f7a9264e7d8cf67005`
- restore_path: controlled OAuth21 `3008` supervisor restart after revert

## Decision

Accept the prompt/content policy as implemented and live on the OAuth21/internal runtime.

All normal tool results remain untrusted data by default. Returned tool content cannot become model instruction through this policy boundary unless a future explicit promotion authority is added. Detection classifies content; it does not suppress the source payload.

## Runtime ownership

- `src/runtime/prompt_content_policy.js` is the single owner of prompt/content classification rules.
- `src/runtime/tool_result.js` applies the model-visible trust boundary after output-DLP sanitation.
- `_workflow/scripts/io_prompt_firewall.js` is a compatibility adapter and does not own duplicate rules.
- `content[0]` remains the primary JSON text payload.
- `structuredContent` remains equal to the primary sanitized payload in structured mode.
- `content[1]` carries bounded model-visible trust metadata.

## Repository validation

- Source commit: `20ab92155dfb9ba356d079f7a9264e7d8cf67005` (`fix(policy): enforce prompt content trust boundary`).
- Commit was pushed before activation and the remote branch ref was independently verified.
- Pre-live full suite durable job: `592bdbe7-7e97-417c-b4f7-4dd067f7ac66`.
- Pre-live full suite: `7 public + 313 authenticated`, GREEN, exit `0`, stderr `0`.
- Directory-document generator check: GREEN.
- Knowledge index before activation: fresh, `300` documents / `1264` visited files / `48` directories / `37` source-of-truth documents / `790` internal links.

## Controlled activation

- Supervisor restart request: `manual-1787337877357`.
- Restart reason: `pol-1a-prompt-content-live-acceptance`.
- Accepted live `server_start_id`: `2026-08-21T18:44:38.849Z`.
- Live OAuth profile: `internal`.
- Tool count: `98`.
- Combined fingerprint: `93721a82a339f9d6`.
- Tool names, input schema, output schema, and descriptor fingerprints remained unchanged.
- Connector refresh was not required and was not performed.

## Live semantic proof

A fresh ephemeral OAuth client executed raw `/mcp` `tools/call` probes without logging credential material.

Safe-content probe proved:

- HTTP `200`;
- two `content` blocks;
- primary JSON remained an object;
- `structuredContent` matched the primary payload;
- boundary `trust_class = untrusted_tool_output`;
- `instruction_handling = data_only`;
- `promotion_allowed = false`;
- `instruction_risk = none`.

Existing hostile fixture probe proved:

- HTTP `200`;
- original hostile fixture remained present in the primary payload;
- `structuredContent` matched the primary payload;
- boundary `trust_class = untrusted_tool_output`;
- `instruction_handling = data_only`;
- `promotion_allowed = false`;
- `instruction_risk = critical`;
- findings included `ignore_previous` and `secret_exfiltration`;
- boundary metadata did not copy hostile source text.

## Policy outcome

- `prompt_content_policy` moves from `critical_specified` to `implemented`.
- Required-policy coverage becomes `16/24`.
- All `6/6` critical policy rows are implemented.
- Eight non-critical rows remain outside `implemented`: four `partial` and four `specified_only`.
- `POL-1` advances to `3/4`.
- `POL-1B` becomes `next_primary`; `POL-1C` becomes `next_secondary`.

## Preservation rule

Preserve the centralized classifier and the data-only default. Do not duplicate prompt-injection patterns in per-tool handlers, do not promote ordinary tool output through `_meta`, and do not turn detection into source-content censorship.
