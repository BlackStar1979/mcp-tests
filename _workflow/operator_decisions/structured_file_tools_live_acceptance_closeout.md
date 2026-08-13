# Structured File Tools Live Acceptance

Status: accepted
Date: 2026-08-13

## Decision

Accept `FILE-1` at readiness `4/4` on the authorized `tests/internal` surface.

## Runtime Evidence

- Controlled restart request: `manual-1786646699884`.
- Live server start: `2026-08-13T18:45:01.480Z`.
- Surface: `13 public + 85 authorized-visible = 98`.
- Tool names hash: `b6526b6d88ccbee3`.
- Combined fingerprint: `05a85f87dfb3304d`.
- Direct connector calls succeeded for `file_inspect`, `content_stage`, `file_transform`, `file_split`, `file_merge`, `markdown_inspect`, and `markdown_transform`.

## Acceptance Scenario

An isolated Markdown fixture was inspected without whole-file transfer, extended from a sealed owner-bound stage, edited by heading path with file and section hash preconditions, split into three source-preserving physical files, and merged back in explicit order. The merged file was 108 bytes and matched the post-Markdown source SHA-256 exactly: `dd2652193c760a70dbc9c359b0848b9374e5951856d5a4b4ffc4542323cfe115`.

All mutations used preview receipts before commit. The stage was released and the fixture plus generated backups were removed after verification.

Final full offline suite job `15a407fa-9b62-4535-ab75-301dc005b9b0` completed with exit code `0`, no stderr, no truncation, and `7 public + 291 authenticated` scripts. Release-gate job `bde2b694-a9c3-47ce-9bbe-ab944f0053db` independently repeated the same result after the final workflow and index updates.

## Policy Correction

The five reversible or source-preserving mutation tools are `readOnlyHint=false` and `destructiveHint=false`. They remain restricted by OAuth, the internal profile, workspace roots, hash preconditions, receipts, backups, journals, and owner isolation. This permits normal execution without weakening controls for genuinely destructive tools.

## Reopen Conditions

Reopen `FILE-1` only for a reproduced integrity, recovery, owner-isolation, usability, or scale defect, or an approved contract change.
