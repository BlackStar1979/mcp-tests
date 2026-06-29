# CRLF Batch Normalization and LF Policy

Status: GREEN / NORMALIZED / SYSTEM LF POLICY
Date: 2026-06-29

## Purpose

Normalize tracked text files to LF and prevent new CRLF generation in the repository.

## Declarations

- server_change: false
- workflow_change: true
- schema_change: false
- runtime_restart_required: false
- connector_refresh_required: false
- backup_required: true via Git commit boundary
- rollback_path: git revert this commit
- restore_path: git revert this commit

## Baseline

- before_crlf_tracked_text_files: 321
- before_split: .js=244, .json=37, .jsonl=2, .md=32, .ps1=4, .sh=1, no_extension=1
- after_crlf_tracked_text_files: 0

## System policy

- `.gitattributes` now uses repo-wide `* text=auto eol=lf`.
- `.editorconfig` now enforces `end_of_line = lf`.
- PowerShell files are normalized to LF as well.
- Future automation must write files in binary mode or explicit LF mode, not host-default text mode.

## Non-actions

- no runtime code behavior change
- no OAuth21 3008 restart
- no public 3009 start
- no connector refresh
- no MCP-visible schema change

## Validation

- `_tests/smoke_crlf_batch_normalization_lf_policy.js`
- updated Stage 13 CRLF guard
- full `run_all --skip-network`
