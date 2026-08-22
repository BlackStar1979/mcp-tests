"use strict";

const assert = require("node:assert/strict");

const latestFullSmokeToken = "ok=true, version=0.40.0, public=7, tests_authenticated=313";
const latestAuthenticatedSmokeCount = 313;
const currentRestartRequiredNow = true;

const latestCanonFullSmokeLine = `Latest known full smoke: \`node ./_tests/run_all_smokes.js --skip-network = ${latestFullSmokeToken}\``;
const latestCanonAuthenticatedCountLine = `Latest validated authenticated smoke count: \`${latestAuthenticatedSmokeCount}\``;
const latestIndexFullSmokeLine = `Latest full smoke: \`${latestFullSmokeToken}\`.`;
const latestIndexAuthenticatedCountLine = `Authenticated smoke count: \`${latestAuthenticatedSmokeCount}\`.`;

function assertCanonCurrentSmokeBaseline(canon) {
  assert.ok(canon.includes(latestCanonFullSmokeLine));
  assert.ok(canon.includes(latestCanonAuthenticatedCountLine));
}

function assertIndexCurrentSmokeBaseline(index) {
  assert.ok(index.includes(latestIndexFullSmokeLine));
  assert.ok(index.includes(latestIndexAuthenticatedCountLine));
}

function assertWorkflowCurrentSmokeBaseline({ canon, index }) {
  assertCanonCurrentSmokeBaseline(canon);
  assertIndexCurrentSmokeBaseline(index);
}

const serverStartIdPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function assertCurrentRuntimeStartIdentity(state) {
  const runtime = state.current_runtime_truth.oauth21_3008;
  const connector = state.current_connector_truth.oauth21_3008_tools;
  assert.match(runtime.server_start_id, serverStartIdPattern);
  assert.match(connector.server_start_id, serverStartIdPattern);
  if (connector.connector_refresh_required_now === false) {
    assert.equal(connector.server_start_id, runtime.server_start_id);
  }
}

function assertCurrentRestartRequirement(state) {
  assert.equal(state.current_runtime_truth.oauth21_3008.restart_required_now, currentRestartRequiredNow);
}

module.exports = {
  latestFullSmokeToken,
  latestAuthenticatedSmokeCount,
  currentRestartRequiredNow,
  latestCanonFullSmokeLine,
  latestCanonAuthenticatedCountLine,
  latestIndexFullSmokeLine,
  latestIndexAuthenticatedCountLine,
  assertCanonCurrentSmokeBaseline,
  assertIndexCurrentSmokeBaseline,
  serverStartIdPattern,
  assertCurrentRuntimeStartIdentity,
  assertCurrentRestartRequirement,
  assertWorkflowCurrentSmokeBaseline,
};
