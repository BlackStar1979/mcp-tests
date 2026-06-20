const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..', '..');
const fixtureRoot = path.join(root, 'fixtures');
const publicRoot = path.join(root, '_public_sandbox');
const port = Number(process.env.DEBUG_PORT || 3301);
const tests = [
  '_tests/descriptor_audit.js',
  '_tests/profile_policy_audit.js',
  '_tests/smoke_stage2_auth.js',
  '_tests/smoke_stage3_fs.js',
  '_tests/smoke_stage5_1_fs_streaming.js',
  '_tests/smoke_stage6_devtools.js',
  '_tests/smoke_stage7_plugin_registry.js',
  '_tests/smoke_stage7_1_plugin_catalog.js',
  '_tests/smoke_stage7_2_security_boundary.js',
  '_tests/smoke_stage7_2_internal_auth_runtime.js',
  '_tests/smoke_stage7_3_plugin_visibility.js',
  '_tests/smoke_stage8_session_toolsets.js',
  '_tests/smoke_stage8_1_plugin_execution.js',
  '_tests/smoke_stage8_2_execution_governance.js',
  '_tests/smoke_stage8_3_execution_policy_regression.js',
  '_tests/smoke_stage8_4_execution_audit_envelope.js',
  '_tests/smoke_stage8_5_execution_receipt_verifier.js',
  '_tests/smoke_stage8_6_readonly_handler_registry.js',
  '_tests/smoke_stage8_7_auth_transition_readiness.js',
  '_tests/smoke_stage8_8_bearer_dry_run_harness.js',
  '_tests/smoke_stage8_9_bearer_cutover_guard.js',
  '_tests/smoke_stage8_10a_bearer_query_token.js',
  '_tests/smoke_stage8_10b_access_assertion.js',
  '_tests/smoke_stage8_10c_modular_parity_status.js',
  '_tests/smoke_stage8_10d_readiness_guard_parity.js',
  '_tests/smoke_stage8_10e_modular_parity_tool.js',
  '_tests/smoke_stage8_11_observability_status.js',
  '_tests/smoke_stage8_12_auth_precutover_operator_checklist.js',
  '_tests/smoke_stage8_13_process_runner_observability.js',
  '_tests/smoke_stage8_14_observability_hardening.js',
  '_tests/smoke_stage8_14a_observability_self_observation.js',
  '_tests/smoke_stage8_15a_dev_code_impact_normalization.js',
  '_tests/smoke_stage8_16_audit_arg_summary_semantics.js',
  '_tests/smoke_stage8_17a_network_allowlist_workflow.js',
  '_tests/smoke_stage8_17b_schema_compat.js',
  '_tests/smoke_stage8_18_tool_surface_fingerprints.js',
  '_tests/smoke_stage8_18a_compact_connector_map.js',
  '_tests/smoke_stage8_19_dev_code_locate.js',
  '_tests/smoke_stage8_20_runtime_status_compact.js',
  '_tests/smoke_stage8_20_stage_status_current.js',
  '_tests/smoke_stage8_20_no_stale_stage_strings.js',
];

function rmFixture() {
  if (fs.existsSync(fixtureRoot)) fs.rmSync(fixtureRoot, { recursive: true, force: true });
}
function wait(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
async function waitHealth() {
  for (let i = 0; i < 50; i += 1) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/healthz`);
      if (r.ok) return;
    } catch {}
    await wait(100);
  }
  throw new Error('health timeout');
}

(async () => {
  rmFixture();
  const env = { ...process.env, MCP_TEST_PORT: String(port), MCP_TEST_AUTH_MODE: 'none', MCP_TEST_FS_ROOT: publicRoot };
  const server = spawn(process.execPath, ['server.js'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    await waitHealth();
    if (fs.existsSync(fixtureRoot)) {
      console.log('CREATED_BY server_start');
      return;
    }
    const testEnv = { ...process.env, MCP_TEST_SMOKE_URL: `http://127.0.0.1:${port}/mcp`, MCP_TEST_FS_ROOT: publicRoot };
    for (const test of tests) {
      const r = spawnSync(process.execPath, [test], { cwd: root, env: testEnv, encoding: 'utf8' });
      if (fs.existsSync(fixtureRoot)) {
        console.log(`CREATED_BY ${test}`);
        console.log(r.stdout || '');
        console.log(r.stderr || '');
        return;
      }
      if (r.status !== 0) {
        console.log(`FAILED ${test}`);
        console.log(r.stdout || '');
        console.log(r.stderr || '');
        return;
      }
    }
    console.log('not created');
  } finally {
    server.kill();
  }
})().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
