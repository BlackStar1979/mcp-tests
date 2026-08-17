"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..", "..");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadRootServerSpec() {
  return readJson(path.join(ROOT, "SERVER_SPEC.json"));
}

function loadAuthSpec() {
  return readJson(path.join(ROOT, "SERVER_AUTH_SPEC.json"));
}

function loadProfilesSpec() {
  return readJson(path.join(ROOT, "SERVER_PROFILES_SPEC.json"));
}

function loadToolsSpec() {
  return readJson(path.join(ROOT, "SERVER_TOOLS_SPEC.json"));
}

function loadDecisionSpec() {
  return readJson(path.join(ROOT, "SERVER_AUTHZ_DECISION_SPEC.json"));
}

function loadDecisionRuntimeSpec() {
  return readJson(path.join(ROOT, "SERVER_DECISION_RUNTIME_SPEC.json"));
}

function loadStage12Spec() {
  return loadDecisionRuntimeSpec();
}

function loadCombinedServerSpec() {
  const root = loadRootServerSpec();
  const auth = loadAuthSpec();
  const profiles = loadProfilesSpec();
  const tools = loadToolsSpec();  const xspec = loadDecisionSpec();
  const decisionRuntime = loadDecisionRuntimeSpec();
  return {
    ...root,
    ...(decisionRuntime.sections || {}),
    auth_port_policy: auth.auth_port_policy,
    server_profiles: profiles.server_profiles,
    server_tools: tools,    server_decision_spec: xspec,
  };
}

module.exports = {
  loadAuthSpec,
  loadCombinedServerSpec,
  loadProfilesSpec,
  loadRootServerSpec,
  loadDecisionSpec,
  loadDecisionRuntimeSpec,
  loadStage12Spec,
  loadToolsSpec,
  readJson,
};
