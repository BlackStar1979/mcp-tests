"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

function readText(...parts) {
  return fs.readFileSync(path.join(ROOT, ...parts), "utf8");
}

const stageMetadata = require("../src/stage_metadata");
const runtimeIdentity = require("../src/runtime/identity");
const canon = readText("_workflow", "WORKFLOW_CANON.md");
const index = readText("_workflow", "ACTIVE_WORKFLOW_INDEX.md");
const state = JSON.parse(readText("_workflow", "state.json"));
const runtimeIdentitySource = readText("src", "runtime", "identity.js");

const semanticMarker = "runtime-compatibility-label-not-repo-progress-label";
const workflowTruthMarker = "Workflow progress truth is `_workflow/state.json` and `_workflow/WORKFLOW_CANON.md`";

assert.equal(stageMetadata.CURRENT_STAGE_STATUS_SEMANTICS, semanticMarker);
assert.equal(stageMetadata.CURRENT_COMPATIBILITY_LABEL_SEMANTICS, semanticMarker);
assert.equal(stageMetadata.CURRENT_COMPATIBILITY_LABEL, stageMetadata.CURRENT_STAGE_STATUS);
assert.equal(runtimeIdentity.buildRuntimeIdentity().runtime_compatibility_label_semantics, semanticMarker);
assert.equal(runtimeIdentity.buildRuntimeIdentity().runtime_compatibility_label, stageMetadata.CURRENT_COMPATIBILITY_LABEL);
assert.equal(runtimeIdentity.buildRuntimeIdentity().runtime_stage_status_semantics, semanticMarker);
assert.ok(runtimeIdentitySource.includes("runtime_compatibility_label: CURRENT_COMPATIBILITY_LABEL"));
assert.ok(runtimeIdentitySource.includes("runtime_compatibility_label_semantics: CURRENT_COMPATIBILITY_LABEL_SEMANTICS"));
assert.ok(runtimeIdentitySource.includes("runtime_stage_status_semantics: CURRENT_STAGE_STATUS_SEMANTICS"));

assert.ok(canon.includes("Runtime identity / workflow boundary"));
assert.ok(canon.includes(workflowTruthMarker));
assert.ok(canon.includes("Do not treat `runtime_stage_status` as repo progress, deployment progress, or workflow truth."));
assert.ok(canon.includes("Changing `src/stage_metadata.js` is a runtime-imported code change"));

assert.ok(index.includes("Runtime compatibility labels are not workflow progress truth."));
assert.ok(index.includes("Runtime identity boundary guard"));

assert.equal(state.schema_version, "workflow-state-spec-map-v2");
assert.equal(state.status, "compact_orientation_map_not_progress_log");
assert.equal(state.server_identity.name, "mcp-tests-response-shape");
assert.equal(state.server_identity.version, "0.40.0");
assert.equal(state.runtime_topology.public.port, 3009);
assert.equal(state.runtime_topology.authorized.port, 3008);
assert.equal(state.current_work_constraints.do_not_use_state_json_as_log, true);
assert.ok(!Object.hasOwn(state, "stage13"), "state.json must not store Stage 13 progress logs");

console.log("smoke_runtime_identity_workflow_boundary ok");
