const assert = require("node:assert/strict");
const {
  AUTH_MODULAR_PARITY_VERSION,
  getModularAuthParityStatus,
  runAccessParityDryRun,
  runBearerParityDryRun,
} = require("../src/auth_modular_parity");

(function accessDryRun() {
  const access = runAccessParityDryRun();
  assert.equal(access.success, true);
  assert.equal(access.mode, "access");
  assert.equal(access.assertion_header, "cf-access-jwt-assertion");
  assert.equal(access.missing_rejected_401, true);
  assert.equal(access.assertion_present_accepted_200, true);
  assert.equal(access.expects_cloudflare_proxy, true);
  assert.equal(access.validates_cloudflare_jwt, false);
  assert.equal(access.accepts_cf_access_service_token_headers_directly, false);
})();

(function bearerDryRun() {
  const bearer = runBearerParityDryRun();
  assert.equal(bearer.success, true);
  assert.equal(bearer.mode, "bearer");
  assert.equal(bearer.accepts_authorization_bearer, true);
  assert.equal(bearer.accepts_query_token, false);
  assert.equal(bearer.accepts_query_token_disabled_by_default, true);
  assert.equal(bearer.missing_rejected_401, true);
  assert.equal(bearer.invalid_header_rejected_401, true);
  assert.equal(bearer.invalid_query_rejected_401, true);
  assert.equal(bearer.header_accepted_200, true);
  assert.equal(bearer.query_rejected_401, true);
  assert.equal(bearer.header_extractor_ok, true);
  assert.equal(bearer.query_extractor_ok, true);
  assert.equal(bearer.temp_token_removed, true);
  assert.equal(bearer.temp_dir_removed, true);
  assert.equal(bearer.token_disclosed, false);
  assert.equal(bearer.token_path_disclosed, false);
})();

(function parityStatus() {
  const status = getModularAuthParityStatus();
  assert.equal(status.success, true);
  assert.equal(status.mode, "auth-modular-parity-status");
  assert.equal(status.version, AUTH_MODULAR_PARITY_VERSION);
  assert.deepEqual(status.modular_mcp_modes, ["access", "bearer"]);
  assert.deepEqual(status.credential_delivery_variants, [
    "cloudflare_access_assertion_header",
    "authorization_bearer_header",
  ]);
  assert.equal(status.access_cloudflare_ready, true);
  assert.equal(status.bearer_header_ready, true);
  assert.equal(status.bearer_query_ready, false);
  assert.equal(status.bearer_query_disabled_by_default, true);
  assert.deepEqual(status.blockers, []);
  assert.equal(status.explicit_non_scope.changes_active_auth_mode, false);
  assert.equal(status.explicit_non_scope.writes_real_secret, false);
  assert.equal(status.explicit_non_scope.writes_persistent_token_file, false);
  assert.equal(status.explicit_non_scope.configures_connector_credential, false);
  assert.equal(status.explicit_non_scope.validates_cloudflare_jwt, false);
  assert.equal(status.explicit_non_scope.handles_cf_access_client_secret, false);
  assert.equal(status.explicit_non_scope.removes_auth_none, false);
})();

console.log("smoke_stage8_10c_modular_parity_status ok");
