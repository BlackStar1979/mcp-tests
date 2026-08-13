"use strict";

const assert = require("node:assert/strict");

const latestFullSmokeToken = "ok=true, version=0.40.0, public=7, tests_authenticated=291";
const latestAuthenticatedSmokeCount = 291;

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

module.exports = {
  latestFullSmokeToken,
  latestAuthenticatedSmokeCount,
  latestCanonFullSmokeLine,
  latestCanonAuthenticatedCountLine,
  latestIndexFullSmokeLine,
  latestIndexAuthenticatedCountLine,
  assertCanonCurrentSmokeBaseline,
  assertIndexCurrentSmokeBaseline,
  assertWorkflowCurrentSmokeBaseline,
};
