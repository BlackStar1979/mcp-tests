"use strict";

const assert = require("node:assert/strict");
const { authLegacyRetirementStatusTool } = require("../tools/auth_legacy_retirement_status");

(async () => {
  assert.equal(authLegacyRetirementStatusTool.name, "auth_legacy_retirement_status");
  assert.equal(authLegacyRetirementStatusTool.descriptor.name, "auth_legacy_retirement_status");
  assert.equal(authLegacyRetirementStatusTool.descriptor.inputSchema.additionalProperties, false);
  assert.equal(authLegacyRetirementStatusTool.descriptor.annotations.readOnlyHint, true);

  const payload = await authLegacyRetirementStatusTool.execute({});
  assert.equal(payload.success, true);
  assert.deepEqual(payload.active_auth_modes, ["none", "oauth21"]);
  assert.deepEqual(payload.active_ports, { none: 3009, oauth21: 3008 });
  assert.deepEqual(payload.retired_auth_modes, ["access", "bearer"]);
  assert.deepEqual(payload.retired_ports, { access: 3005, bearer: 3006 });
  assert.equal(payload.connector_refresh_required, true);
  assert.ok(payload.legacy_tools_replaced.includes("auth_transition_status"));
  assert.ok(payload.legacy_tools_replaced.includes("auth_bearer_dry_run"));
  assert.ok(payload.legacy_tools_replaced.includes("auth_bearer_cutover_guard"));
  assert.ok(payload.legacy_tools_replaced.includes("auth_modular_parity_status"));

  console.log("smoke_auth_legacy_retirement_status ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
