"use strict";

const fs = require("node:fs");

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, "utf8"));
}

function loadRootServerSpec() {
  return readJson("SERVER_SPEC.json");
}

function loadAuthSpec() {
  return readJson("SERVER_AUTH_SPEC.json");
}

function loadProfilesSpec() {
  return readJson("SERVER_PROFILES_SPEC.json");
}

function loadToolsSpec() {
  return readJson("SERVER_TOOLS_SPEC.json");
}

function loadDecisionSpec() {
  return readJson("SERVER_AUTHZ_DECISION_SPEC.json");
}

function loadStage12Spec() {
  return readJson("SERVER_STAGE12.json");
}

function loadCombinedServerSpec() {
  const root = loadRootServerSpec();
  const auth = loadAuthSpec();
  const profiles = loadProfilesSpec();
  const tools = loadToolsSpec();  const xspec = loadDecisionSpec();
  const stage12 = loadStage12Spec();
  return {
    ...root,
    ...(stage12.sections || {}),
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
  loadDecisionSpec,  loadStage12Spec,
  loadToolsSpec,
  readJson,
};
