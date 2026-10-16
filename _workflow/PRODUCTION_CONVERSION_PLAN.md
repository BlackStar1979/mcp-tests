# Production conversion plan: mcp-tests -> production local MCP server

Status: IN PROGRESS (P1 done except P1.5, P2.1 done). Owner: Claude. Written 2026-10-16 at the
operator's request ("plan the conversion of the local test MCP server into a non-test version").
Queue authority stays `WORKFLOW_CANON.md` + `ACTIVE_WORKFLOW_INDEX.md`; this file is the
design input that later packages are cut from. Retire it once the conversion has landed.

## 0. Progress log

- 2026-10-16 P1.1: WIP `0f18977` triaged. It was one coherent package (COMP-1A refresh to
  `codex-mcp-client 0.153.1`), half-applied; completed in `7c81c75` after re-running its evidence
  command. It had broken 3 smokes (two frozen sentences, `state.json` over its 16000-char budget).
- 2026-10-16 P1.2-P1.3: full suite 7 + 313 green (79 s); `main` fast-forwarded 149 commits to
  `c24609e`; annotated tag `v0.40.0` = rollback target.
- 2026-10-16 P1.4: all 26 other branches became 27 `archive/*` tags (one branch had diverged
  local/remote heads; both kept), each verified on the remote before its branch was deleted.
  Two archives hold work NOT in `main` and need a keep/drop decision (P2.4).
- 2026-10-16 P1.5 FINDING: the repo has NO CI (`.github/workflows` absent). The local suite is
  the only gate. Adding CI is now a P2 item, not a formality.
- 2026-10-16 P2.1: the three GPT defects resolved, each with its own cause:
  - 9f312d0d "every invocation returns ExceptionGroup after restart": NOT a server defect. The
    server started 2026-08-19T20:06:10Z and the workstation hard-reset (CPU MCE, event 41) at
    20:07:27Z; GPT's calls hit a dead host. Its cached tool schemas made discovery look alive.
  - 6e203293 write_file ExceptionGroup: audit shows `destructive_tool_denied` (blanket deny on
    `destructive=true`), rendered by the connector as ExceptionGroup. Fixed by `cc75a66`
    (2026-08-20, capability-adaptive authorization); guarded by
    `boundedWorkspaceWriteIsNotBlanketDeniedByDestructiveMetadata`.
  - f2f5e44b file_inspect on an empty file: real defect; `eof` selector returned line 0 against a
    schema minimum of 1. Fixed in this session with a regression through the DLP boundary.
- 2026-10-16 FS-HARDEN Task 2 (realpath/junction boundary): the archived test, run unchanged
  against `main` FIRST, showed every escape to outside (read/write/copy/move/delete through a
  junction) was already rejected by `555fad0`; the one gap was MUTATION through an in-root
  junction (swappable target). Ported `assertNoLinkedComponents` into
  `resolveWritableWorkspacePath`; spec + test registered; suite 7 + 314.
- 2026-10-16 P0 ANSWERED by the operator: (1) background autostart without him: yes; (2) clients:
  all, as needed; (3) public 3009 retired; (4) name: LocalNodeMCP (my pick from his options).
- 2026-10-16 P5.1 DONE: per-user logon task `LocalNodeMCP` (no elevation) runs
  `scripts/localnode-keeper.ps1` under a HEADLESS conhost (a plain `-WindowStyle Hidden` pwsh was
  delegated to Windows Terminal and left empty windows on his desktop on every start). The keeper
  runs `server.ps1` with the September settings from `scripts/localnode.config.json` and relaunches
  it after any exit (back-off 5-60 s); a named mutex keeps one keeper per session. Verified:
  98 tools, public healthz 200 and unauthenticated POST 401 through the tunnel; killed node came
  back in 6 s; a second keeper exits without touching the server; `-Stop` stops the whole tree.
  Found and fixed on the way: `server.ps1` takeover of a supervised server killed only the parent,
  so node kept the port and the takeover failed (now it stops the server too).
- 2026-10-16 3009 RETIRED: tunnel route removed (remote config v26), DNS record
  `mcp-tests.romionologic.dev` deleted, local `~/.cloudflared/config.yml` block removed (backup
  `config.yml.bak-20261016`; the running service applies it at its next restart). Only
  `mcp-tests-oauth21` -> 127.0.0.1:3008 remains on tunnel `mcp` (4cf51ef4).
- 2026-10-16 FIXED: test runs wrote content-stage and file-compose SQLite state into the SECRET
  store `~/.romion` (`tests_{content_stages,file_compose}_<port>.sqlite`, one set per dynamic port;
  1563 stage DBs in the morning, 1574 after my own runs, 9444 files incl. -shm/-wal and compose).
  `withHermeticServerControlEnv` isolated audit/restart/rate-limit state but not these two stores;
  it now sets `MCP_CONTENT_STAGE_STORAGE_FILE` and `MCP_FILE_COMPOSE_STORAGE_FILE` into the test
  temp root. A full suite afterwards added 0 files. 9438 debris files moved (not deleted) to
  `~/.romion/_archive_test_debris_20261016/`; the 6 files of the live 3008 server stay.
- 2026-10-16 FS-HARDEN Task 6 (append-only policy): DROPPED as superseded. Its premise was that
  append bypasses mutation safety; on `main` `appendFile` already goes through the file-transform
  engine (expected hash, receipt, atomic replace), the same path as `edit_file_patch` append.
  Restricting it to .log/.jsonl/.ndjson would remove function without adding protection
  (5 append_file calls in all retained audit logs, all successful).
- 2026-10-16 FS-HARDEN Task 4 (code-patch validation preflight): MEASURED, DEFERRED to the schema
  batch. On `main`, `.ts/.tsx/.jsx` count as code but have no checker (only .js/.mjs/.cjs/.py do),
  so `code_apply_patch` on them always writes, fails validation and rolls back from backup: it can
  never succeed, and a hard reset inside that window leaves an unvalidated file. The fix adds a
  new status/field to the output schema, which changes the descriptor fingerprint and forces a
  connector refresh -- so it ships together with Task 5 (bounded reads, also schema-visible) at
  cutover (P6), not alone. Remaining archive tasks: 1 (github_api.py), 3 (remote op context).

## 1. What "production" means here (the decision this plan rests on)

The production server is the **PC-resident compute-plane MCP server**: it owns the tools that
MUST touch this workstation (the `C:\Work` filesystem, local processes, the codebase-memory
bridge, local indexes, GPU-bound work). It is NOT a second TinyPyMCP: anything that does not need
the PC belongs on the VPS server (see `compute-plane-doctrine`).

Production means, concretely:
1. Released from `main`, with tagged versions and a rollback target. The runtime never again
   runs from a feature branch.
2. A production profile that loads only production tools. The test fixtures, response-shape
   probes and auth-transition diagnostics live in a `tests` profile that production never loads.
3. One owner per capability across the estate. The memory and task store has ONE authority
   (TinyPyMCP `/data/memory.db`); two stores = two write paths (`two-write-paths-one-store`).
4. Supervised runtime: it restarts after a crash (this PC hard-resets on a CPU MCE, WHEA 18),
   reports health, and its durable state (OAuth SQLite, process registry, artifacts) is backed up.
5. A stable identity: its name, description and docs no longer say "TEST".

## 2. Facts at planning time (2026-10-16, re-verify before acting)

| fact | value |
|---|---|
| branch the live runtime ran from | `feature/cbm-cli-bridge-mvp` @ `47f08f5` (+ WIP commit `0f18977`) |
| `main` | `2e108d0`, 2026-07-23, **145 commits behind** the feature branch, 0 ahead |
| local branches | 10, several `backup/*`, `recovery/*`, `validation/*` from August |
| identity | package `mcp-tests` 0.40.0, "TEST MCP workbench", server `mcp-tests-response-shape` |
| ports | 3008 (oauth21, profile `tests`, 98 tools); 3009 (auth none, public, 13 tools) |
| listening now | neither (started by hand only) |
| tool modules | 128 in `tools/` |
| readiness | 13 of 15 components at 4/4; `POL-1` 3/4 (POL-1C: 4 `specified_only` policies); `COMP-1` 3/4 (Codex client still uses legacy `initialize`) |
| known defects | task 3a64767c: post-restart invocation ExceptionGroup, `write_file` ExceptionGroup, `file_inspect` DLP rejection on an empty file |
| MCP client dep | `@modelcontextprotocol/client` 2.0.0 (current 2.3.1); spec current `2026-07-28` |

## 3. Phases

Each phase ends green on the full smoke suite (`node _tests/run_all_smokes.js`) before the next one starts.

### P0. Operator decisions (product requirements only, asked once, in one message)
- D-P1 **Autostart.** On 2026-07-22 the operator ruled the local servers pre-release and
  started them by hand on purpose. Production needs supervised autostart. Ask: yes, and from when?
- D-P2 **Clients.** Which clients are production consumers: Codex, ChatGPT, Claude? This decides
  which auth modes and transports must survive.
- D-P3 **Public 3009** (auth none). Retire it, or keep it as a deliberately public fixture?
  Default proposal: retire it from production and keep it only in the `tests` profile.
- D-P4 **Name.** Proposed: `romion-local-mcp`. The connector hostname changes only with a
  parallel run (see P6).
Everything else is my call; do not ask about it.

### P1. Repository truth: `main` is the release line
1. Triage WIP commit `0f18977`: keep it, split it, or drop it, with a reason recorded per file.
2. Full suite on the feature branch, then fast-forward `main` to it (0 commits on `main` are
   missing from the branch, so this is a fast-forward, not a merge).
3. Tag `v0.40.0` as the pre-conversion baseline (the rollback target).
4. Stale branches: turn each into an archive tag (`archive/<name>`), then delete the branch.
   Nothing is lost; verify the tag points at the branch head before deleting it.
5. CI runs on `main`; the gate is a superset of CI (`pushed-is-not-landed`).
Done when the runtime's `running_source` equals a tagged commit on `main`.

### P2. Known defects and current debt
1. Fix the three task 3a64767c defects test-first (reproduce, then fix); then mark GPT tasks
   9f312d0d, 6e203293 and f2f5e44b done.
2. Bump `@modelcontextprotocol/client` 2.0.0 -> 2.3.x in a separate commit; run the hermetic
   OAuth/DCR suite against it.
3. `npm audit` + pinning review; no `^` ranges in production deps (`ssh2-sftp-client` is `^12`).
4. Keep/drop decision for the two archives holding unmerged work -- DECIDED 2026-10-16:
   - `archive/fix/oauth21-mcp-resource` (28 commits, 2026-07-11): SUPERSEDED. `git cherry` finds no
     patch-equivalent commit, but the substance (issuer separated from the canonical MCP resource,
     tokens bound to it) landed differently on `main` (`canonicalizeResource` with aliases in
     `src/auth/oauth21_authorization_server.js`; AUTH-1 4/4). Keep the tag, port nothing.
   - `archive/feature/filesystem-hardening-20260802` (`550d58d`, 38 files, +1835/-268, base
     2026-08-02): KEEP AND PORT as package FS-HARDEN. None of it is on `main` (its five new smokes,
     `scripts/github_api.py`, the plan doc are absent; `main`'s `workspace_roots.js` has 3 realpath
     checks, the branch 10). Its Task 2 closes symlink/junction escape from the workspace boundary,
     which a production server must have. Port task by task, test-first, onto current `main`;
     the base is 140 commits old, so this is a re-implementation guided by the archive, not a
     rebase. Its plan: `git show archive/feature/filesystem-hardening-20260802:docs/superpowers/plans/2026-08-02-filesystem-tooling-hardening.md`.
5. CI: DONE 2026-10-16 (`.github/workflows/smoke.yml`): Windows runner, repository copied to the
   production path `C:\Work\mcp-tests` (the suite asserts that root), `npm ci`, `npm audit
   --audit-level=high`, full suite. A July attempt on the oauth21 branch was removed by its author.
   Dependency bump of P2.2/P2.3 also DONE (`cda3a61`): client 2.3.1, fast-uri 3.1.8, audit 0.
6. `_tests/smoke_sep2549_list_read_cache_inventory.js` (helper manifest, not in run-all) asserts
   the dispatcher has NO `resources/read`; that became false by design with PROCESS-ARTIFACTS.
   Update the assertion to the current contract or retire the helper manifest entry.
7. `state.json` compaction (15930 / 16000 chars): the 34 `*_record` paths in
   `active_target_direction` repeat the `_workflow/operator_decisions/` prefix.

### P3. Surface split: production / tests / moves to TinyPyMCP
Classify all 128 tools into a table (`_workflow/SURFACE_CLASSIFICATION.md`) with one owner per row:
- **production, PC-bound**: filesystem under `C:\Work`, `process_*`, `cbm_*`, local `search_index*`,
  `file_*` / `markdown_*`, `code_*` and `dev_code_*`, `table_profile` / `fits_info` / `hdf5_info`.
- **tests-only**: `auth_*_status`, `auth_bearer_*`, `test_mcp_runtime_status`, `code_sample_js`,
  `fs_*_public*` on `_public_sandbox`, `change_workflow_simulator`, the response-shape probes.
- **duplicated with TinyPyMCP, single owner to decide**: `memory_*` (7 tools), `*_remote_site_*`,
  `net_check_*`, `tool_usage_snapshot`. Default: the VPS owns them. The local memory store
  (67 entries) is migrated INTO TinyPyMCP by content hash, then frozen read-only, then retired.
  Measure preservation as well as removal (`memory-poisoning-repair-measured-jointly`).
- **plugin / tool-registry machinery**: keep it only if a production consumer calls it (check
  `observability_status` call counts); otherwise it goes to `tests`.
Then add `profiles/production.json` that loads exactly the production rows. Add a guard test
that fails if a tests-only tool appears in the production profile, with a seeded positive control.

### P4. Identity and docs
Rename the package, the server identity, the README, `NORTHSTAR.md` ("production-grade TEST MCP
server" becomes the production target) and the SERVER_* specs, in ONE commit, with the WORKFLOW
changelog and SPEC bumps in the same commit. The repo name and directory stay `mcp-tests` until
P7 (renaming the directory breaks about 70 references, and that is its own package).

### P5. Production runtime
1. Supervisor: decide between a Windows service (e.g. a WinSW/NSSM wrapper) and a logon task with
   restart-on-failure. Measure, do not assume, that it survives a hard reset and comes back.
   Probe it by RUNNING it: Smart App Control may block a fresh binary
   (`smart-app-control-blocks-venv-shims`).
2. Health: `/health` returns the version, `running_source` and the tool fingerprint; add a Kuma
   monitor through the tunnel (its 401/200 semantics as on the VPS).
3. Backups: OAuth SQLite, process registry, artifacts. Restic to the same offsite target as the
   VPS, with a restore drill, never an untested backup.
4. Logs: bounded rotation; keep the no-raw-payload observability boundary.

### P6. Cutover
1. Run the production profile on a new port and host alongside 3008, for at least 7 days.
2. Move clients one at a time; each client's OAuth registration is re-done against the new
   resource identity (the resource-server identity changes with the host).
3. Acceptance: each production client completes discover/initialize, lists tools and calls one
   PC-bound tool; zero ExceptionGroup errors during the soak; the hard-reset recovery is observed.
4. Retire 3008/3009 from production: CF route, DNS, process. The `tests` profile stays runnable
   on demand on high ports for development.
Rollback: re-point clients to 3008 and run tag `v0.40.0`.

### P7. After cutover
- Directory/repo rename (about 70 references, the same shape as the Hermes regroup task a4d8be88).
- Spec migration M44 (2026-07-28 per-request versioning). Legacy `initialize` stays while any
  production client needs it (COMP-1); retire it only on evidence.
- POL-1C: the four `specified_only` policies.

## 4. Risks
- **The PC is crash-prone** (CPU MCE). Production on the PC inherits that availability. The
  supervisor and restart recovery (P5) are the mitigation; the BIOS check is the operator's.
- **Two memory stores** while P3 is in progress: freeze the local store read-only BEFORE the
  migration starts, so that it cannot diverge during the move.
- **Connector catalog caching**: clients keep stale tool lists. Verify a rename on a FRESH client,
  never the long-lived one.
- **Scope**: this is weeks of packages, not one session. Every phase is a stopping point that
  leaves a working server.

## 5. Order of the first session
P0 message to the operator -> P1.1-P1.3 -> P2.1. Nothing user-visible changes until P6.
