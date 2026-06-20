const assert = require("node:assert/strict");
const { authModularParityStatusTool } = require("../tools/auth_modular_parity_status");

(async () => {
  assert.equal(authModularParityStatusTool.name, "auth_modular_parity_status");
  assert.equal(authModularParityStatusTool.descriptor.name, "auth_modular_parity_status");
  assert.equal(authModularParityStatusTool.descriptor.inputSchema.type, "object");
  assert.equal(authModularParityStatusTool.descriptor.inputSchema.additionalProperties, false);
  assert.equal(authModularParityStatusTool.descriptor.annotations.readOnlyHint, true);
  assert.equal(authModularParityStatusTool.descriptor.annotations.openWorldHint, false);

  const result = await authModularParityStatusTool.execute({});
  assert.equal(result.success, true);
  assert.equal(result.mode, "auth-modular-parity-status");
  assert.equal(result.access_cloudflare_ready, true);
  assert.equal(result.bearer_header_ready, true);
  assert.equal(result.bearer_query_ready, false);
  assert.equal(result.bearer_query_disabled_by_default, true);
  assert.deepEqual(result.blockers, []);
  assert.equal(result.explicit_non_scope.changes_active_auth_mode, false);
  assert.equal(result.explicit_non_scope.writes_real_secret, false);
  assert.equal(result.explicit_non_scope.configures_connector_credential, false);
  assert.equal(result.explicit_non_scope.validates_cloudflare_jwt, false);
  assert.equal(result.explicit_non_scope.handles_cf_access_client_secret, false);

  console.log("smoke_stage8_10e_modular_parity_tool ok");
})().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
