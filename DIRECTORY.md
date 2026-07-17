# DIRECTORY

Status: active top-level directory map
Updated: 2026-07-17

- `_control/`
  Local runtime/control-plane state and generated operational state files for the repo.
- `_docs/`
  Local reference-document area used for workspace-specific documentation support.
- `_logs/`
  Local runtime and operational logs kept outside committed source truth.
- `_public_sandbox/`
  Small bounded public filesystem fixtures used by tests and public FS tooling.
- `_repos_with_code_samples/`
  Local code-sample corpus used by bounded tooling and tests.
- `_tests/`
  Active smoke suite, targeted guards, helper manifests, and archived test evidence.
- `_workflow/`
  Canonical workflow truth, operator decisions, inventories, and control-plane guidance.
- `.codebase-memory/`
  Local code graph/index artifacts for codebase-memory tooling.
- `.temp/`
  Local transient scratch area.
- `docker/`
  Container and devcontainer scaffolding.
- `node_modules/`
  Installed dependency tree for local execution.
- `plugins/`
  Example or support plugin material for test-server behavior.
- `profiles/`
  Runtime profile configuration files.
- `scripts/`
  Operator/runtime helper scripts for controlled server execution and restart.
- `src/`
  Runtime implementation, auth, schemas, truth tools, and support modules.
- `tools/`
  MCP tool entry modules, split into public, authorized, and internal helper layers.
- `.editorconfig`
  Formatting baseline for editor-aware tooling.
- `.gitattributes`
  Git attribute rules.
- `.gitignore`
  Ignore policy for local artifacts and generated files.
- `GITHUB_PUBLISHING.md`
  First-push and GitHub publishing checklist.
- `package-lock.json`
  Locked npm dependency graph.
- `package.json`
  Package metadata and script entrypoints.
- `README.md`
  Human-oriented repo overview and common commands.
- `SERVER_AUTH_SPEC.json`
  Canonical auth/OAuth server contract.
- `SERVER_AUTHZ_DECISION_SPEC.json`
  Authorization decision envelope contract.
- `SERVER_CAPABILITY_ATTESTATION_POLICY_SPEC.json`
  Capability attestation policy spec.
- `SERVER_CONNECTOR_SURFACE_SPEC.json`
  Connector-visible surface and refresh rules.
- `SERVER_CONSENT_POLICY_SPEC.json`
  Consent policy spec.
- `SERVER_DATABASE_POLICY_SPEC.json`
  Database/state-store policy spec.
- `SERVER_DECISION_RUNTIME_SPEC.json`
  Historical decision-runtime contract retained as canonical spec material.
- `SERVER_ELICITATION_POLICY_SPEC.json`
  Elicitation policy spec.
- `SERVER_EVENT_CATALOG_SPEC.json`
  Runtime audit-event catalog.
- `SERVER_INCIDENT_RESPONSE_POLICY_SPEC.json`
  Incident response policy spec.
- `SERVER_MEMORY_POLICY_SPEC.json`
  Memory/state/task policy spec.
- `SERVER_NETWORK_POLICY_SPEC.json`
  Network policy spec.
- `SERVER_OUTPUT_DLP_POLICY_SPEC.json`
  Output DLP policy spec.
- `SERVER_PLUGIN_VISIBILITY_POLICY_SPEC.json`
  Plugin visibility policy spec.
- `SERVER_POLICY_COVERAGE_MATRIX_SPEC.json`
  Policy coverage matrix.
- `SERVER_POLICY_RUNTIME_SPEC.json`
  Runtime policy composition gate.
- `SERVER_PROFILES_SPEC.json`
  Public/tests profile contract.
- `SERVER_PROMPT_CONTENT_POLICY_SPEC.json`
  Prompt content policy spec.
- `SERVER_RATE_LIMIT_QUOTA_POLICY_SPEC.json`
  Rate-limit and quota policy spec.
- `SERVER_RESOURCE_POLICY_SPEC.json`
  Resource classes and permission model.
- `SERVER_ROOTS_BOUNDARY_POLICY_SPEC.json`
  Workspace roots and filesystem boundary policy.
- `SERVER_RUNTIME_CONFIG_SPEC.json`
  Runtime CLI/env/config authority.
- `SERVER_RUNTIME_TOPOLOGY_SPEC.json`
  Runtime topology and restart authority spec.
- `SERVER_SAMPLING_POLICY_SPEC.json`
  Sampling and approval policy spec.
- `SERVER_SCOPE_MINIMIZATION_POLICY_SPEC.json`
  Scope minimization policy spec.
- `SERVER_SESSION_SECURITY_POLICY_SPEC.json`
  Session security policy spec.
- `SERVER_SPEC.json`
  High-level server identity/topology contract.
- `SERVER_SUPPLY_CHAIN_POLICY_SPEC.json`
  Supply-chain policy spec.
- `SERVER_TOOLS_SPEC.json`
  Tool surface and tool catalog contract.
- `SERVER_TRANSPORT_SECURITY_POLICY_SPEC.json`
  Transport security policy spec.
- `server.js`
  Thin runtime entrypoint that delegates to the current bootstrap runtime.

This top-level map is intentional but not yet exhaustive for every nested directory in the repository. The remaining rollout is tracked in `_workflow/ROADMAP.md`, and bounded regeneration support is available through `npm run docs:directory`.
