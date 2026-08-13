# Structured File Mutation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans and superpowers:test-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add durable staged content, streaming partial text mutation, physical split/merge, and structure-aware Markdown editing without sending complete files through model context.

**Architecture:** A selector compiler resolves exact source spans and a streaming transaction engine writes sibling temporary files with source-hash preconditions. SQLite stores owner-scoped content stages and multi-file operation journals; Markdown parsing provides positions but never rewrites untouched syntax.

**Tech Stack:** Node.js CommonJS, `node:fs` streams, `node:sqlite` WAL, JSON Schema, unified/remark parser packages, MCP Streamable HTTP runtime, repository smoke harness.

## Global Constraints

- Keep the public 13-tool profile unchanged.
- Keep the ordinary global string input limit at 10,000 characters.
- Bound staged content chunks to 8,192 characters and stages to 8 MiB by default.
- Do not log, echo, or persist OAuth client IDs, unsealed content, or raw mutation payloads outside the stage database.
- Never delete source files during split or merge.
- Preserve UTF-8 BOM, dominant line endings, permissions, and untouched bytes.
- Require source hash or range hash preconditions for every committed transform.
- Keep compatibility wrappers for existing mutation tools.
- Never start a replacement server on port 3008; use an isolated port and the controlled restart helper.
- Every behavior change starts with a failing regression test.

---

### Task 1: Per-schema input budgets and selector contracts

**Files:**
- Create: `src/schemas/structured_file_tools.js`
- Create: `_tests/smoke_structured_file_schemas.js`
- Modify: `src/runtime/tool_input_validator.js`
- Modify: `_tests/smoke_tool_input_budget_guards.js`

**Interfaces:**
- Produces: `FILE_SELECTOR_SCHEMA`, `CONTENT_SOURCE_SCHEMA`, and seven closed tool schemas.
- Produces: schema extension `x-mcp-max-string-length` consumed only by `validateToolInput`.

- [ ] **Step 1: Write RED schema and budget tests**

```js
const chunkSchema = { type: "string", "x-mcp-max-string-length": 8192 };
assert.equal(validateToolInput("stage", { chunk: "x".repeat(8192) }, objectWith(chunkSchema)).ok, true);
assert.equal(validateToolInput("stage", { chunk: "x".repeat(8193) }, objectWith(chunkSchema)).ok, false);
assert.equal(validateToolInput("ordinary", { value: "x".repeat(10001) }, objectWith({ type: "string" })).ok, false);
assert.equal(FILE_SELECTOR_SCHEMA.oneOf.length, 5);
```

- [ ] **Step 2: Run RED tests**

Run `node _tests/smoke_structured_file_schemas.js` and `node _tests/smoke_tool_input_budget_guards.js`. Expected: missing schema module and unsupported per-schema budget.

- [ ] **Step 3: Implement strict schema-aware budgets**

Resolve the effective string limit as `Math.min(schema["x-mcp-max-string-length"] || limits.maxStringLength, limits.maxStringLength)` unless the validator call explicitly enables the trusted content-chunk profile. The trusted profile may raise only the named `chunk` field to 8,192 and must not change ordinary fields.

- [ ] **Step 4: Run GREEN tests**

Run both smokes plus `node --check src/runtime/tool_input_validator.js` and descriptor schema validation.

---

### Task 2: Durable owner-scoped content stages

**Files:**
- Create: `src/util/content_stage_store.js`
- Create: `src/util/content_stage_manager.js`
- Create: `tools/content_stage.js`
- Create: `tools/authorized/content_stage.js`
- Create: `_tests/smoke_content_stage_manager.js`
- Create: `_tests/smoke_content_stage_tool.js`

**Interfaces:**
- Produces: `createContentStageManager({ storageFile, now, randomUUID })`.
- Methods: `create(ownerId)`, `append(ownerId, stageId, sequence, chunk)`, `seal(ownerId, stageId, expected)`, `status(ownerId, stageId)`, `release(ownerId, stageId)`, `openReadStream(ownerId, stageId)`.
- Tool execution reads owner identity from the existing optional-tool context.

- [ ] **Step 1: Write RED lifecycle, quota, and isolation tests**

```js
const stage = manager.create("client-a");
manager.append("client-a", stage.stage_id, 0, "alpha");
manager.append("client-a", stage.stage_id, 1, "beta");
const sealed = manager.seal("client-a", stage.stage_id, { expected_chars: 9 });
assert.equal(sealed.sha256.length, 64);
assert.throws(() => manager.status("client-b", stage.stage_id), /not found/i);
```

Cover wrong sequence, append-after-seal, hash mismatch, restart reconstruction, retention, per-stage quota, owner quota, and content-free audit summaries.

- [ ] **Step 2: Verify RED**

Run manager and tool smokes. Expected: modules absent.

- [ ] **Step 3: Implement SQLite WAL storage and tool facade**

Use `BEGIN IMMEDIATE` for create/append/seal/release. Store chunks by `(stage_id, sequence)`, enforce owner hash in every query, and stream chunks in sequence without concatenating the complete stage.

- [ ] **Step 4: Verify GREEN and confidentiality**

Run stage smokes, inspect SQLite rows, and assert tool/audit responses contain sizes, sequence, state, and hashes but no chunk text or raw owner ID.

---

### Task 3: Selector compiler, inspector, and streaming atomic writer

**Files:**
- Create: `src/util/file_selectors.js`
- Create: `src/util/file_transaction.js`
- Create: `src/util/file_transform_engine.js`
- Create: `tools/file_inspect.js`
- Create: `tools/file_transform.js`
- Create: `tools/authorized/file_inspect.js`
- Create: `tools/authorized/file_transform.js`
- Create: `_tests/smoke_file_selectors.js`
- Create: `_tests/smoke_file_transform_engine.js`
- Modify: `src/util/workspace_mutation.js`

**Interfaces:**
- Produces: `resolveSelector(path, selector) -> { startByte, endByte, sha256, matches, lineStart, lineEnd }`.
- Produces: `prepareFileTransform(input, context) -> previewReceipt` and `commitFileTransform(input, receipt, context) -> result`.
- Content sources are `{ inline }`, `{ stage_id }`, or `{ file: { path, selector, expected_sha256 } }`.

- [ ] **Step 1: Write RED selector and mutation tests**

```js
const preview = await prepareFileTransform({
  path: "sample.txt",
  expected_file_sha256: sha256(original),
  operations: [{ kind: "replace", selector: anchor("old"), content: { inline: "new" } }],
});
await fs.writeFile(target, "changed concurrently", "utf8");
await assert.rejects(() => commitFileTransform(input, preview.receipt), /source changed/);
```

Cover duplicate anchors, zero-length EOF insertion, ordered non-overlapping operations, CRLF conversion, BOM, UTF-8 boundaries, permissions, failed rename cleanup, and files above 5 MiB.

- [ ] **Step 2: Verify RED**

Run selector and transform smokes. Expected: modules absent.

- [ ] **Step 3: Implement streaming prepare and commit**

Compile selectors before writing. Copy unchanged byte ranges with bounded streams, stream content sources, hash input/output incrementally, flush the temporary handle, back up an existing target, and rename the sibling temporary file over the target. Never retain complete source or result text.

- [ ] **Step 4: Verify GREEN and failure cleanup**

Run both smokes with injected open/write/sync/rename failures and assert original target integrity, no orphan temp files, and deterministic receipts.

---

### Task 4: Migrate compatibility mutation facades

**Files:**
- Modify: `src/util/workspace_mutation.js`
- Modify: `src/util/code_mutation_tools.js`
- Modify: `tools/write_file.js`
- Modify: `tools/append_file.js`
- Modify: `tools/edit_file_patch.js`
- Modify: `_tests/smoke_workspace_mutation_tools.js`
- Create: `_tests/smoke_code_apply_patch_source_binding.js`

**Interfaces:**
- Existing tool inputs and response fields remain accepted.
- New responses add `source_sha256`, `result_sha256`, and `receipt` where applicable.

- [ ] **Step 1: Write RED compatibility and race tests**

Assert old calls retain old fields, writes are atomic under injected failure, and `code_apply_patch` refuses commit after target content changes even when anchor/content arguments are unchanged.

- [ ] **Step 2: Verify RED**

Run workspace mutation and source-binding smokes. Expected: direct write path and race acceptance.

- [ ] **Step 3: Delegate wrappers to the shared engine**

Map append to EOF insertion, edit modes to one transform operation, overwrite to a full-file selector, and code dry-run receipts to exact source hashes. Preserve backup and syntax-validation behavior.

- [ ] **Step 4: Verify GREEN**

Run all existing workspace/code mutation smokes plus new race and injected-failure tests.

---

### Task 5: Physical file split and merge

**Files:**
- Create: `src/util/file_compose.js`
- Create: `tools/file_split.js`
- Create: `tools/file_merge.js`
- Create: `tools/authorized/file_split.js`
- Create: `tools/authorized/file_merge.js`
- Create: `_tests/smoke_file_split_merge.js`

**Interfaces:**
- Produces: `prepareSplit`, `commitSplit`, `prepareMerge`, and `commitMerge` over the transaction journal.
- Split consumes `{ source, expected_source_sha256, parts[], require_full_coverage }`.
- Merge consumes `{ sources[], destination, separator, allow_repeated_sources }`.

- [ ] **Step 1: Write RED physical composition tests**

Create a 122 KiB fixture with specification, historical log, and current log sections. Assert three exact outputs, source preservation, full-coverage rejection for gaps/overlaps, merge ordering for five log fragments, separator handling, source-hash races, destination alias rejection, and rollback after the second target commit fails.

- [ ] **Step 2: Verify RED**

Run `node _tests/smoke_file_split_merge.js`. Expected: modules absent.

- [ ] **Step 3: Implement journaled multi-file composition**

Prepare every destination temp file before committing any target. Record source/destination hashes and backup paths in SQLite. On failure, restore committed targets in reverse order and mark the journal rolled back. On startup, recover any nonterminal journal deterministically.

- [ ] **Step 4: Verify GREEN and recovery**

Run normal, injected-failure, and reconstructed-manager tests. Assert sources remain unchanged and no prepared temp survives terminal cleanup.

---

### Task 6: Markdown inspection and structural mutation

**Files:**
- Create: `src/util/markdown_structure.js`
- Create: `tools/markdown_inspect.js`
- Create: `tools/markdown_transform.js`
- Create: `tools/authorized/markdown_inspect.js`
- Create: `tools/authorized/markdown_transform.js`
- Create: `_tests/smoke_markdown_structure.js`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `inspectMarkdown(path, options)` and `compileMarkdownTransform(path, operation)`.
- Markdown transforms compile to the `file_transform_engine` operation format.

- [ ] **Step 1: Write RED structural tests**

Use fixtures containing YAML frontmatter, duplicate headings, nested headings, GFM tables, task lists, fenced code with heading-like text, inline HTML, CRLF, and no final newline. Assert stable heading paths, occurrences, ranges, hashes, and byte-identical untouched regions after each operation.

- [ ] **Step 2: Verify RED and dependency versions**

Run the smoke before installation to prove the module is absent. Query current maintained versions, install exact compatible ranges for `unified`, `remark-parse`, `remark-gfm`, and `remark-frontmatter`, then run `npm audit --omit=dev`.

- [ ] **Step 3: Implement parse-only structural mapping**

Load ESM parser packages through cached dynamic imports from CommonJS. Use node positions to derive byte ranges and heading ancestry. Never call a Markdown stringifier. Compile structural operations to exact source spans and delegate commit.

- [ ] **Step 4: Verify GREEN and no-formatting guarantee**

Run Markdown tests and compare every untouched prefix/suffix byte-for-byte. Run malformed and oversized document cases and verify controlled errors without writes.

---

### Task 7: Register tools, policies, specs, workflow, and agent guidance

**Files:**
- Modify: `src/tool_loader.js`
- Modify: `src/tool_policy.js`
- Modify: `SERVER_TOOLS_SPEC.json`
- Modify: `SERVER_CONNECTOR_SURFACE_SPEC.json`
- Modify: `SERVER_RESOURCE_POLICY_SPEC.json`
- Modify: `SERVER_RUNTIME_CONFIG_SPEC.json`
- Modify: `SERVER_DATABASE_POLICY_SPEC.json`
- Modify: `SERVER_EVENT_CATALOG_SPEC.json`
- Modify: `_workflow/READINESS.md`
- Modify: `_workflow/ROADMAP.md`
- Modify: `_workflow/WORKFLOW_CANON.md`
- Modify: `_workflow/state.json`
- Modify: `.agents/skills/using-codebase-memory/SKILL.md`
- Modify: affected `DIRECTORY.md` files and count/fingerprint guards.

**Interfaces:**
- Authenticated surface grows by seven tools; public surface remains 13.
- Tool descriptions contain explicit decision rules for weaker models.

- [ ] **Step 1: Write RED loader, policy, descriptor, and skill tests**

Assert exact tool names, strict schemas, conservative annotations, closed-world classification, authenticated-only exposure, public exclusion, and decision-language phrases distinguishing transform/split/merge/Markdown/staging.

- [ ] **Step 2: Verify RED**

Run loader, descriptor, policy, connector-surface, directory, workflow, and agent-skill guards. Expected: missing tools and stale counts.

- [ ] **Step 3: Wire runtime and synchronize source-of-truth files**

Register seven tools, update explicit policies and root specs, regenerate count/fingerprint and directory artifacts with repository scripts, and add readiness/roadmap evidence without using `state.json` as a progress log.

- [ ] **Step 4: Verify repository truth**

Run all targeted guards, `node server.js --self-test`, `git diff --check`, directory audit, and `project_truth_audit`. Expected: zero drift findings.

---

### Task 8: Full suite, isolated runtime, controlled restart, and publish

**Files:**
- Create: `_workflow/operator_decisions/structured_file_mutation_live_acceptance_2026-08-13.md`
- Modify: persistent workbench task/state records.

**Interfaces:**
- Produces: acceptance evidence for direct connector calls and crash-safe file operations.

- [ ] **Step 1: Run full offline acceptance**

```text
node _tests/run_all_smokes.js --skip-network
node server.js --self-test --auth=oauth21 --profile=tests
npm audit --omit=dev
git diff --check
```

Expected: every command exits zero.

- [ ] **Step 2: Run isolated OAuth runtime on an unused port**

Use isolated OAuth, audit, stage, and transaction database paths. Exercise all seven tools through MCP: staged multi-call content, exact replace, append, 122 KiB split, five-file merge, Markdown inspection/edit, owner isolation, restart reconstruction, conflict rejection, and cleanup. Never bind the isolated process to port 3008.

- [ ] **Step 3: Restart production with the supported helper**

Run `node .\\scripts\\request-restart.js --code=42 --reason=manual`. Verify health, changed start ID, expected tool count/fingerprints, OAuth continuity, and direct workbench calls. Request operator action only if connector re-enumeration or OAuth UI interaction is actually required.

- [ ] **Step 4: Close workflow and publish**

Write the acceptance record, rebuild the CBM index, close the durable task, commit bounded changes, push the current branch, verify `HEAD` equals upstream, and verify a clean worktree.
