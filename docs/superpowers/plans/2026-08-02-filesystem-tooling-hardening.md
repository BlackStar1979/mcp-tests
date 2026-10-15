# Filesystem Tooling Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden local and remote file operations, make code-patch validation capability-aware, bound read/list work, restrict append semantics, and add a secret-safe GitHub API helper.

**Architecture:** Centralize path and mutation policy in shared utilities rather than patching individual tools. Preserve existing connector names where possible; schema-visible changes are introduced only for pagination and explicit partial-read metadata. Every behavior change is test-first and independently verifiable.

**Tech Stack:** Node.js 20+, Python 3.14 standard library, MCP strict structured schemas, Windows worktree, GitHub REST API.

## Global Constraints

- Work only in `C:\Work\_worktrees\mcp-tests-filesystem-hardening` on branch `feature/filesystem-hardening-20260802`.
- Never start a competing server on ports 3008 or 3009.
- Restart the operator-managed server only with `node .\scripts\request-restart.js --code=42 --reason=manual` from `C:\Work\mcp-tests`.
- Temporary runtime instances must use a different higher port.
- Never place the GitHub token in command arguments, logs, files under the repository, test fixtures, or tool output.
- Use tests before production changes and preserve rollback/audit behavior.

---

### Task 1: Secret-safe GitHub REST helper

**Files:**
- Create: `scripts/github_api.py`
- Create: `_tests/test_github_api_helper.py`
- Modify: `scripts/DIRECTORY.md`

- [ ] Write tests for token-file parsing, redaction, host/path validation, mutation confirmation, bounded output, and injected transport.
- [ ] Run the tests and verify the expected RED failure because the helper does not exist.
- [ ] Implement the minimal standard-library helper and make the tests green.
- [ ] Perform a read-only authenticated `/user` smoke call without exposing the token.

### Task 2: Realpath and reparse-point workspace boundary

**Files:**
- Modify: `src/util/workspace_roots.js`
- Modify: `src/util/workspace_mutation.js`
- Create: `_tests/smoke_workspace_realpath_boundary.js`
- Modify: `SERVER_ROOTS_BOUNDARY_POLICY_SPEC.json`

- [ ] Add failing tests for symlink/junction escape on reads, nonexistent descendants, copy/move/delete/restore, and mutation through any reparse-point component.
- [ ] Implement centralized existing-target and write-target boundary verification.
- [ ] Revalidate immediately before mutation and run all workspace mutation smokes.

### Task 3: Remote operation context and auditable move

**Files:**
- Modify: `src/util/remote_site_tools.js`
- Modify: `_tests/smoke_remote_site_lifecycle.js`
- Modify: `SERVER_RESOURCE_POLICY_SPEC.json`

- [ ] Add failing deterministic-clock tests proving one artifact path and shared operation/correlation identity.
- [ ] Introduce one operation context per remote mutation.
- [ ] Add move manifest/log/result identity and rollback on audit-write failure.
- [ ] Run remote lifecycle and runtime-status smokes.

### Task 4: Validation-capability preflight for code patches

**Files:**
- Modify: `src/util/code_workspace.js`
- Modify: `src/util/code_mutation_tools.js`
- Modify: `_tests/smoke_devtools.js`

- [ ] Add failing tests showing `.ts` dry-run remains available but real apply stops before backup/write when no checker exists.
- [ ] Separate analysis extensions from validation extensions and expose a validation-capability result.
- [ ] Enforce preflight before mutation and retain post-write validation for supported languages.

### Task 5: Bounded directory and file reads

**Files:**
- Modify: `src/util/workspace_fs.js`
- Modify: `src/schemas/workspace_fs_tools.js`
- Modify: `tools/list_directory.js`
- Modify: `tools/read_file.js`
- Modify: `tools/read_file_lines.js`
- Modify: `tools/read_file_chunk.js`
- Modify: `_tests/smoke_workspace_fs_tools.js`
- Modify: `SERVER_TOOLS_SPEC.json`

- [ ] Add failing tests for stable cursor pagination and early stream termination.
- [ ] Implement sorted cursor pagination and stat only the selected page.
- [ ] Stop reads after the requested bound plus one unit and report unknown totals as null when incomplete.
- [ ] Run schema, descriptor, and workspace FS smokes.

### Task 6: Append-only semantic policy

**Files:**
- Modify: `src/util/workspace_mutation.js`
- Modify: `tools/append_file.js`
- Modify: `_tests/smoke_workspace_mutation_tools.js`
- Modify: `SERVER_TOOLS_SPEC.json`

- [ ] Add failing allow/deny tests for `.jsonl`/`.ndjson`/`.log` versus code, specs, and canonical documents.
- [ ] Centralize target classification and deny semantic misuse even with `allow_protected`.
- [ ] Return guidance to use `edit_file_patch` for editable/canonical text.

### Task 7: Full verification and controlled integration

- [ ] Run targeted tests after each task, then `node server.js --self-test` and the full no-network smoke suite.
- [ ] Run JSON parse, JavaScript syntax, and `git diff --check` validation.
- [ ] Review documentation impact and update only current-truth structured sections.
- [ ] Do not restart the live server until all changes are integrated into the operator checkout; then use only the approved restart helper.
