# Production conversion plan: mcp-tests -> production local MCP server

Status: PLAN (not started). Owner: Claude. Written 2026-10-16 at the operator's request
("plan the conversion of the local test MCP server into a non-test version").
Queue authority stays `WORKFLOW_CANON.md` + `ACTIVE_WORKFLOW_INDEX.md`; this file is the
design input that later packages are cut from. Retire it once the conversion has landed.

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
