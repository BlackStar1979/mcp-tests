"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const TODAY = "2026-07-17";

const CONFIG = {
  ".": {
    title: "top-level directory map",
    entries: {
      "_control/": "Local runtime/control-plane state and generated operational state files for the repo.",
      "_docs/": "Local reference-document area used for workspace-specific documentation support.",
      "_logs/": "Local runtime and operational logs kept outside committed source truth.",
      "_public_sandbox/": "Small bounded public filesystem fixtures used by tests and public FS tooling.",
      "_repos_with_code_samples/": "Local code-sample corpus used by bounded tooling and tests.",
      "_tests/": "Active smoke suite, targeted guards, helper manifests, and archived test evidence.",
      "_workflow/": "Canonical workflow truth, operator decisions, inventories, and control-plane guidance.",
      ".codebase-memory/": "Local code graph/index artifacts for codebase-memory tooling.",
      ".temp/": "Local transient scratch area.",
      "docker/": "Container and devcontainer scaffolding.",
      "node_modules/": "Installed dependency tree for local execution.",
      "plugins/": "Example or support plugin material for test-server behavior.",
      "profiles/": "Runtime profile configuration files.",
      "scripts/": "Operator/runtime helper scripts for controlled server execution and restart.",
      "src/": "Runtime implementation, auth, schemas, truth tools, and support modules.",
      "tools/": "MCP tool entry modules, split into public, authorized, and internal helper layers.",
      ".editorconfig": "Formatting baseline for editor-aware tooling.",
      ".gitattributes": "Git attribute rules.",
      ".gitignore": "Ignore policy for local artifacts and generated files.",
      "GITHUB_PUBLISHING.md": "First-push and GitHub publishing checklist.",
      "package-lock.json": "Locked npm dependency graph.",
      "package.json": "Package metadata and script entrypoints.",
      "README.md": "Human-oriented repo overview and common commands.",
      "SERVER_AUTH_SPEC.json": "Canonical auth/OAuth server contract.",
      "SERVER_AUTHZ_DECISION_SPEC.json": "Authorization decision envelope contract.",
      "SERVER_CAPABILITY_ATTESTATION_POLICY_SPEC.json": "Capability attestation policy spec.",
      "SERVER_CONNECTOR_SURFACE_SPEC.json": "Connector-visible surface and refresh rules.",
      "SERVER_CONSENT_POLICY_SPEC.json": "Consent policy spec.",
      "SERVER_DATABASE_POLICY_SPEC.json": "Database/state-store policy spec.",
      "SERVER_DECISION_RUNTIME_SPEC.json": "Historical decision-runtime contract retained as canonical spec material.",
      "SERVER_ELICITATION_POLICY_SPEC.json": "Elicitation policy spec.",
      "SERVER_EVENT_CATALOG_SPEC.json": "Runtime audit-event catalog.",
      "SERVER_INCIDENT_RESPONSE_POLICY_SPEC.json": "Incident response policy spec.",
      "SERVER_MEMORY_POLICY_SPEC.json": "Memory/state/task policy spec.",
      "SERVER_NETWORK_POLICY_SPEC.json": "Network policy spec.",
      "SERVER_OUTPUT_DLP_POLICY_SPEC.json": "Output DLP policy spec.",
      "SERVER_PLUGIN_VISIBILITY_POLICY_SPEC.json": "Plugin visibility policy spec.",
      "SERVER_POLICY_COVERAGE_MATRIX_SPEC.json": "Policy coverage matrix.",
      "SERVER_POLICY_RUNTIME_SPEC.json": "Runtime policy composition gate.",
      "SERVER_PROFILES_SPEC.json": "Public/tests profile contract.",
      "SERVER_PROMPT_CONTENT_POLICY_SPEC.json": "Prompt content policy spec.",
      "SERVER_RATE_LIMIT_QUOTA_POLICY_SPEC.json": "Rate-limit and quota policy spec.",
      "SERVER_RESOURCE_POLICY_SPEC.json": "Resource classes and permission model.",
      "SERVER_ROOTS_BOUNDARY_POLICY_SPEC.json": "Workspace roots and filesystem boundary policy.",
      "SERVER_RUNTIME_CONFIG_SPEC.json": "Runtime CLI/env/config authority.",
      "SERVER_RUNTIME_TOPOLOGY_SPEC.json": "Runtime topology and restart authority spec.",
      "SERVER_SAMPLING_POLICY_SPEC.json": "Sampling and approval policy spec.",
      "SERVER_SCOPE_MINIMIZATION_POLICY_SPEC.json": "Scope minimization policy spec.",
      "SERVER_SESSION_SECURITY_POLICY_SPEC.json": "Session security policy spec.",
      "SERVER_SPEC.json": "High-level server identity/topology contract.",
      "SERVER_SUPPLY_CHAIN_POLICY_SPEC.json": "Supply-chain policy spec.",
      "SERVER_TOOLS_SPEC.json": "Tool surface and tool catalog contract.",
      "SERVER_TRANSPORT_SECURITY_POLICY_SPEC.json": "Transport security policy spec.",
      "server.js": "Thin runtime entrypoint that delegates to the current bootstrap runtime.",
    },
    tail: "This top-level map is intentional but not yet exhaustive for every nested directory in the repository. The remaining rollout is tracked in `_workflow/ROADMAP.md`, and bounded regeneration support is available through `npm run docs:directory`.",
  },
  "_workflow": {
    title: "workflow directory map",
    entries: {
      "_diagnostics/": "Workflow-specific diagnostic records and derived analysis artifacts.",
      "baselines/": "Baseline records used for workflow and runtime comparison.",
      "control_plane/": "Control-plane scripts, manifests, archival snapshots, and bounded OAuth21 prune records/backups for operational procedures.",
      "historical/": "Historical workflow evidence retained for traceability, not current authority.",
      "inventories/": "Structured inventories that support migration and parity work.",
      "operator_decisions/": "Binding decision records and bounded work-package evidence.",
      "scripts/": "Workflow helper scripts for backup/deploy/restart/rollback procedures.",
      "ACTIVE_WORKFLOW_INDEX.md": "Current navigation entrypoint and active queue overview.",
      "CONNECTOR_REFRESH_READINESS.md": "Connector refresh contract and evidence requirements.",
      "DIRECTORY.md": "Functional map of the `_workflow` directory.",
      "NEXT_CHAT_HANDOFF.md": "Handoff-oriented continuity file for fast re-entry.",
      "NORTHSTAR.md": "Accepted end-state vision for the product.",
      "OAUTH_PRODUCTION_HARDENING_PLAN.md": "OAuth production-hardening plan and related evidence.",
      "README.md": "Workflow usage rules and read order.",
      "READINESS.md": "Maturity map between current state and NorthStar.",
      "ROADMAP.md": "Dependency-aware prioritized operator-facing TODO plan.",
      "sessionless_inventory.json": "SEP-driven machine-readable migration checklist.",
      "STATE.md": "Operator-facing current as-is summary.",
      "state.json": "Compact machine-readable orientation map; not a progress log.",
      "STREAMABLE_HTTP_SAMPLING_OAUTH_WORKFLOW.md": "Specialized workflow notes for streamable HTTP, sampling, and OAuth work.",
      "WORKFLOW_CANON.md": "Canonical workflow truth and closeout ledger.",
      "WORKING_COURSE.md": "Compatibility pointer kept for older references; current content redirects to the canon.",
    },
  },
  "_workflow/_diagnostics": {
    title: "workflow diagnostics directory map",
    entries: {
      "DIRECTORY.md": "Functional map for the workflow diagnostics area itself.",
    },
    tail: "Use this directory for bounded workflow-facing diagnostic outputs and derived evidence summaries. Treat it as support material for active decisions, not as canonical workflow truth.",
  },
  "scripts": {
    title: "scripts directory map",
    entries: {
      "request-restart.js": "Writes a bounded restart request for the supervisor-managed runtime path.",
      "server.ps1": "PowerShell helper for controlled local server startup/orchestration.",
      "server.sh": "Shell helper for controlled local server startup/orchestration.",
      "generate_directory_docs.js": "Regenerates selected `DIRECTORY.md` files from a bounded description map.",
    },
  },
  "profiles": {
    title: "profiles directory map",
    entries: {
      "public.json": "Runtime profile for the public unauthenticated surface.",
      "tests.json": "Runtime profile for the authorized/internal test surface.",
    },
  },
  "_control": {
    title: "control directory map",
    entries: {
      "smoke_workspace_mutation_tools_dbg/": "Local debug output directory used by workspace-mutation smoke tooling.",
      "rate-limit-state.json": "Local persisted rate-limit/quota state for runtime controls.",
      "sessionless-prototype.json": "Local control/config state related to the sessionless prototype path.",
      "tool-surface-state.json": "Local persisted tool-surface state used by runtime/control-plane logic.",
    },
  },
  "_logs": {
    title: "logs directory map",
    entries: {
      "compact/": "Compact derived log/report artifacts kept outside committed source truth.",
      ".mcp-tests-audit.jsonl": "Default structured runtime audit log for TEST MCP request, response, and lifecycle evidence.",
      ".mcp-agent-state.json": "File-backed local agent state output when explicit overrides are not supplied.",
      ".mcp-agent-memory.jsonl": "File-backed local agent memory output when explicit overrides are not supplied.",
      ".mcp-agent-tasks.jsonl": "File-backed local agent task output when explicit overrides are not supplied.",
      "README.md": "Human-oriented `_logs` usage and purpose note.",
    },
    tail: "This directory is runtime-owned and high-churn. Treat the generated files as operational evidence, not canonical product/workflow truth.",
  },
  "src": {
    title: "src directory map",
    entries: {
      "auth/": "OAuth/OAuth21, legacy auth, and authorization-server implementation modules.",
      "exec/": "Bounded execution and process-control support.",
      "memory/": "Memory/state/task support modules for the MCP surface.",
      "plugin/": "Plugin registry, visibility, governance, and execution support.",
      "runtime/": "Core MCP runtime assembly, routing, handlers, and observability wiring.",
      "schemas/": "Schema and descriptor helpers for MCP-visible contracts.",
      "truth/": "Read-only truth/audit helpers used for repo/runtime/workflow inspection.",
      "util/": "General utility support used across runtime and guards.",
      "README.md": "Source-tree orientation note.",
    },
  },
  "tools": {
    title: "tools directory map",
    entries: {
      "authorized/": "Authorized/tests-surface MCP tool facade modules.",
      "internal/": "Server-internal helper modules intentionally hidden from MCP-visible schema/tools-list.",
      "public/": "Public unauthenticated MCP tool facade modules.",
      "README.md": "Tool-surface layout and orientation note.",
    },
  },
  "_tests": {
    title: "tests directory map",
    entries: {
      "archive/": "Archived legacy and stale smoke material retained for traceability only.",
      "fixtures/": "Static fixtures used by smoke tests.",
      "helpers/": "Reusable helper modules for smoke/test assertions and baselines.",
      "targeted_debt/": "Focused debt-review and readiness artifacts outside the default run-all surface.",
      "README.md": "Orientation, inventory, and maintenance rules for the `_tests` tree.",
      "run_all_smokes.js": "Active smoke harness entrypoint.",
      "run_all_smoke_scripts.json": "Default active smoke manifest.",
      "smoke_operator_contract_docs.js": "Guard for operator-facing documentation contract and initial DIRECTORY rollout.",
    },
    tail: "This map is intentionally compact. The complete active inventory remains in `_tests/README.md` and `run_all_smoke_scripts.json`.",
  },
};

function render(cfg) {
  const lines = [
    "# DIRECTORY",
    "",
    `Status: active ${cfg.title}`,
    `Updated: ${TODAY}`,
    "",
  ];

  for (const [name, desc] of Object.entries(cfg.entries)) {
    lines.push(`- \`${name}\``);
    lines.push(`  ${desc}`);
  }

  if (cfg.tail) {
    lines.push("");
    lines.push(cfg.tail);
  }

  return lines.join("\n") + "\n";
}

function writeFile(target, body) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, body, "utf8");
  console.log(`wrote ${path.relative(ROOT, target)}`);
}

function renderSnapshotDirectory(relPath, name) {
  const lines = [
    "# DIRECTORY",
    "",
    "Status: archived snapshot directory map",
    `Updated: ${TODAY}`,
    "",
    `- \`_tests/\``,
    `  Snapshot copy of test-surface files for archive \`${name}\`, when present.`,
    `- \`_workflow/\``,
    `  Snapshot copy of workflow files for archive \`${name}\`, when present.`,
    `- \`src/\``,
    `  Snapshot copy of source files for archive \`${name}\`, when present.`,
    "",
    "This directory is archival evidence only, not active workflow authority.",
    "",
  ];
  return lines.join("\n");
}

for (const [relPath, cfg] of Object.entries(CONFIG)) {
  const target = path.join(ROOT, relPath, "DIRECTORY.md");
  writeFile(target, render(cfg));
}

const snapshotRoot = path.join(ROOT, "_workflow", "control_plane", "snapshots");
if (fs.existsSync(snapshotRoot)) {
  for (const entry of fs.readdirSync(snapshotRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const relPath = path.join("_workflow", "control_plane", "snapshots", entry.name);
    writeFile(path.join(ROOT, relPath, "DIRECTORY.md"), renderSnapshotDirectory(relPath, entry.name));
  }
}
