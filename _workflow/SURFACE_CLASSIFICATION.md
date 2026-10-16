# LocalNodeMCP surface classification (conversion plan P3)

Status: CLASSIFIED, NOT YET APPLIED. Written 2026-10-16. Implementation ships in the cutover batch
(P6) together with the other schema-visible changes (FS-HARDEN Tasks 4 and 5), because every
change to the callable set changes the tool-surface fingerprint and forces each client to refresh
its connector -- one refresh for all of it, not three.

## Evidence

Every `tool_call_start` in all retained audit logs (`_logs/.mcp-tests-audit.jsonl*`,
2026-07-26 .. 2026-10-16): **12,328 calls**. Test runs write their audit to a temp root
(hermetic env), so these are client calls (mostly Codex and ChatGPT). Re-measure with
`tool_usage.py`-style counting before applying; numbers below are the 2026-10-16 snapshot.

The callable surface is 98 tools = 85 `authorized_mcp_tools` + 13 `public_mcp_tools`; the 26
`internal_runtime_tools` (tool/plugin registries, hotplug, session toolsets, runtime status) are
not MCP-visible and are out of scope here.

| category | calls | production decision | reason |
|---|---:|---|---|
| process | 5,846 | KEEP | the backbone: run_process 1,803, process_status 2,297 |
| filesystem (workspace) | 4,180 | KEEP | edit_file_patch 1,084, file_transform 833, reads; move_path/restore_path never called but are the recovery path -- keep |
| codebase_memory (cbm_*) | 891 | KEEP | PC-bound code graph |
| workspace_index | 371 | KEEP | build/search index over C:\Work |
| code_analysis | 281 | KEEP | dev_code_locate 153, syntax_check 97; code_patch_plan never called -- keep with code_apply_patch |
| truth | 277 | KEEP project_truth_audit (182), code_runtime_map, tool_usage_snapshot; TESTS-ONLY `change_workflow_simulator` (6) and `deploy_decision_guard` (42) | the last two serve this repository's own workflow, not the operator's PC work |
| memory (memory_*) | 245 | REMOVE at cutover (migration done 2026-10-16) | duplicates the TinyPyMCP shared store (two write paths); migrate the 87 local entries first (plan P3), then point clients at TinyPyMCP |
| network (net_*) | 59 | KEEP | cheap, read-only, allowlisted |
| code_mutation | 3 | KEEP | code_apply_patch/rollback pair; fix FS-HARDEN Task 4 at cutover |
| core: search / fetch | 7 | KEEP | the search+fetch pair some ChatGPT modes require; verify against the public sandbox root before cutover |
| core: code_sample_js | 53 | TESTS-ONLY | a connector-compatibility sampler, not a work tool |
| public sandbox fs_*_public | 26 | TESTS-ONLY | read `_public_sandbox` fixtures; the public surface (3009) is retired |
| remote_site (SFTP to the web site) | 5 | KEEP the 3 read tools; TESTS-ONLY the 6 mutators | write/edit/delete/move/restore/preview_retention were NEVER called in 3 months; a never-used write path to a public web site is attack surface with no benefit. Site deploys go through the VPS release plane |
| science (fits/hdf5/table_profile/inventory_tree) | 1 | KEEP read-only | never or barely used, but read-only and cheap; revisit after 3 months of production data |
| code_dispatch (tool_dispatch) | 0 | TESTS-ONLY | never called |

Net effect if applied as written: 98 -> 83 callable tools in production. 15 names move to the
tests-only profile: code_sample_js, 5 fs_*_public, 6 remote_site mutators, tool_dispatch,
change_workflow_simulator, deploy_decision_guard (recount at apply time). Later -7 more when
memory_* moves to TinyPyMCP.

## Mechanism (to build at cutover)

Profiles select whole groups (`optional_tool_groups`) and the profile schema is strict
(`src/profile_schema_validator.js` SURFACE_KEYS), so there is no per-tool exclusion today. Add
`excluded_tools` (array of names, validated against the catalog: an unknown name fails startup) to
the profile schema, a `profiles/production.json` that is `tests` minus the TESTS-ONLY rows, and a
guard test that fails when a TESTS-ONLY tool appears in the production surface -- with a seeded
positive control. `scripts/localnode.config.json` then switches `profile` to `production`.
