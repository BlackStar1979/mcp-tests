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
      ".agents/": "Project-local cross-runtime agent skills and their discovery-oriented references.",
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
  ".agents": {
    title: "project-local agent directory map",
    entries: {
      "skills/": "Cross-runtime project-local skills discovered from `.agents/skills/<skill-name>/SKILL.md`.",
      "DIRECTORY.md": "Functional map of the `.agents` directory.",
    },
    tail: "Keep skills in a flat namespace. Each skill must contain `SKILL.md`; load supporting references only when their `Load when:` condition matches the task.",
  },
  ".agents/skills/using-codebase-memory": {
    title: "using-codebase-memory skill directory map",
    updated: "2026-08-01",
    entries: {
      "references/": "Task-routed CBM tool contracts and decision scenarios loaded only when needed.",
      "SKILL.md": "Entrypoint instructions for using TEST MCP `cbm_*` tools and freshness-aware knowledge retrieval while preserving repository, index, runtime, and client/UI truth boundaries.",
      "DIRECTORY.md": "Functional map of the `using-codebase-memory` skill boundary.",
    },
    tail: "This skill is project-local agent guidance. It must reject stale knowledge-index claims and describe how to use CBM evidence safely, while repository files and live runtime probes remain authoritative for consequential claims.",
  },
  ".agents/skills/using-codebase-memory/references": {
    title: "using-codebase-memory references directory map",
    updated: "2026-07-28",
    entries: {
      "scenarios.md": "Decision examples for selecting CBM tools and interpreting bounded or partial results.",
      "tools.md": "Per-tool argument, mutation, and caveat reference for the fifteen TEST MCP `cbm_*` tools.",
      "DIRECTORY.md": "Functional map of the CBM skill references.",
    },
    tail: "Load these references only from `SKILL.md` routing. Keep caveats explicit and do not let indexed evidence replace direct repository or runtime verification.",
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
  "_workflow/operator_decisions": {
    title: "workflow operator decisions directory map",
    updated: "2026-08-13",
    entries: {
      "initialize_client_compatibility_evidence.md": "Current operational evidence for legacy `initialize` versus `server/discover` client-entry behavior.",
      "initialize_retirement_decision_prep.md": "Bounded decision-preparation record for any future legacy `initialize` retirement package.",
      "connector_*.md": "Connector refresh, migration, callable-surface, route-coexistence, and reconnect evidence records.",
      "keep_mcp_*.md": "Decision records for retaining `/mcp` as the canonical route while retiring or constraining adjacent route debt.",
      "sessionless_*.md, single_route_*.md, subscriptions_listen_*.md": "Sessionless, single-route, and subscriptions/listen compatibility and migration records.",
      "oauth21_*.md, auth_*.md": "OAuth21/auth control-plane, pruning, and security-adjacent decision evidence.",
      "retr_1_quality_regression_closeout.md": "Acceptance evidence for freshness-aware workspace retrieval, complete canonical extraction, and authoritative current-state ranking.",
      "process_job_persistence_live_acceptance.md": "Live acceptance evidence for durable owner-scoped async process jobs, same-job restart recovery, controlled errors, and resolver fixes.",
      "process_job_pid_reuse_recovery.md": "Post-acceptance correction and regression evidence for PID-reuse-safe durable process recovery.",
      "run_process_sync_ceiling.md": "Evidence and rationale for the synchronous 90-second ceiling below Cloudflare's proxy read timeout.",
      "ops_1a_operational_e2e_closeout.md": "Evidence-classified closeout for the bounded operational E2E matrix, hermetic/live soak, and remaining external boundaries.",
      "stage*.md, p*.md, post_stage*.md": "Historical stage/package records retained for traceability; current authority stays in active workflow files.",
      "*_closeout.md, *_inventory.md, *_plan.md, *_review.md, *_package.md": "Bounded work-package lifecycle records used to explain why a change was prepared, accepted, deferred, or closed.",
    },
    tail: "This directory is a decision ledger, not the active queue. Current priority and interpretation still come from `_workflow/READINESS.md`, `_workflow/ROADMAP.md`, `_workflow/ACTIVE_WORKFLOW_INDEX.md`, `_workflow/WORKFLOW_CANON.md`, and `_workflow/state.json`.",
  },
  "_workflow/inventories": {
    title: "workflow inventories directory map",
    updated: "2026-08-09",
    entries: {
      "modular_tool_migration_inventory.json": "Machine-readable modular tool migration and parity inventory.",
      "modular_tool_migration_inventory.md": "Human-readable rendering of the modular tool migration inventory.",
      "ops_1a_operational_e2e_matrix.json": "Machine-readable operational evidence matrix for restart, reconnect, cancellation, timeout, Cloudflare, SFTP, network, process, and rollback families.",
      "DIRECTORY.md": "Functional map of structured workflow inventories.",
    },
    tail: "Inventories classify current evidence and migration state. They do not replace repository, runtime, connector, or active workflow truth.",
  },
  "_workflow/control_plane/file_backups": {
    title: "control-plane file backups directory map",
    entries: {
      "DIRECTORY.md": "Functional map for the control-plane file-backup area itself.",
    },
    tail: "This directory stores runtime-owned backup bundles produced by bounded operational procedures. Treat the contents as support artifacts, not active workflow authority.",
  },
  "_workflow/control_plane/oauth21_prune_backups": {
    title: "oauth21 prune backups directory map",
    entries: {
      "DIRECTORY.md": "Functional map for the OAuth21 prune backup area itself.",
    },
    tail: "This directory stores backup bundles emitted by explicit OAuth21 prune execute runs. Treat the contents as control-plane support artifacts, not canonical workflow truth.",
  },
  "scripts": {
    title: "scripts directory map",
    updated: "2026-08-09",
    entries: {
      "audit-memory-embedding-runtime.ps1": "Reads only allowlisted MEM-1 environment names from a live Windows process and emits secret-free activation booleans.",
      "audit_directory_docs.js": "Audits high-churn tracked directories for `DIRECTORY.md` coverage without modifying files.",
      "backfill-memory-embeddings.js": "Performs bounded, idempotent hydration of missing active-memory vectors and emits aggregate-only results.",
      "provision-memory-embedding-token.ps1": "Provisions or rotates the MEM-1 token file through a secure prompt or stdin with a restricted Windows ACL and secret-free output.",
      "request-restart.js": "Writes a bounded restart request for the supervisor-managed runtime path.",
      "server.ps1": "PowerShell helper for controlled local server startup/orchestration.",
      "server.sh": "Shell helper for controlled local server startup/orchestration.",
      "generate_directory_docs.js": "Regenerates selected `DIRECTORY.md` files from a bounded description map.",
      "run_operational_e2e_soak.js": "Runs the bounded OPS-1A hermetic/live operational matrix with independent repetition limits and structured output.",
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
  "docs": {
    title: "documentation directory map",
    updated: "2026-08-13",
    entries: {
      "superpowers/": "Imported or adapted Superpowers planning/specification material used by local workflow documentation.",
      "CBM_RELIABILITY_HARDENING_REPORT.md": "Reliability hardening notes for the CBM bridge and its operational guardrails.",
      "CBM_UPSTREAM_ISSUES_101_150_REVIEW.md": "Review of current upstream codebase-memory-mcp issues 101-150 and local mcp-tests impact.",
      "CBM_UPSTREAM_ISSUES_151_200_REVIEW.md": "Review of current upstream codebase-memory-mcp issues 151-200 and local mcp-tests impact.",
      "CBM_UPSTREAM_ISSUES_201_277_REVIEW.md": "Review of current upstream codebase-memory-mcp issues 201-277 and local mcp-tests impact.",
      "CBM_UPSTREAM_ISSUES_51_100_REVIEW.md": "Review of upstream issues 51-100 and local bridge safeguards derived from them.",
      "CBM_UPSTREAM_ISSUES_FIRST50_REVIEW.md": "Initial upstream issue review for the first 50 open codebase-memory-mcp issues.",
      "CBM_V0_9_0_REBASELINE_REPORT.md": "Rebaseline report for the codebase-memory v0.9.0 bridge contract and compatibility state.",
      "PROCESS_RUNNER_CONSUMER_INSTRUCTION.md": "Consumer contract for choosing synchronous versus durable asynchronous process execution and recovering jobs.",
    },
    tail: "This directory holds supporting reports and imported planning references. Current project truth remains in `_workflow/` and root `SERVER_*_SPEC.json` files.",
  },
  "docs/superpowers": {
    title: "superpowers documentation directory map",
    updated: "2026-07-29",
    entries: {
      "plans/": "Execution-plan documents generated while applying structured development workflows.",
      "specs/": "Design/specification documents paired with the execution plans.",
    },
    tail: "Treat this area as supporting workflow material. It can inform implementation, but it does not replace `_workflow/READINESS.md`, `_workflow/ROADMAP.md`, or root server specs.",
  },
  "docs/superpowers/plans": {
    title: "superpowers plans directory map",
    updated: "2026-07-29",
    entries: {
      "2026-07-26-cbm-cli-bridge-mvp.md": "Execution plan for the CBM CLI bridge MVP package.",
      "2026-07-26-cbm-full-tool-surface.md": "Execution plan for the full CBM tool-surface package.",
      "2026-07-26-cbm-reliability-hardening.md": "Execution plan for CBM bridge reliability hardening.",
      "2026-07-26-cbm-v0-9-0-compatibility-hardening.md": "Execution plan for CBM v0.9.0 compatibility hardening.",
      "2026-08-09-process-runner-async.md": "Execution plan for durable asynchronous process execution and policy hardening.",
      "2026-08-13-structured-file-mutation.md": "Execution plan for staged content, streaming file mutation, physical split/merge, and Markdown structure tools.",
    },
    tail: "Keep these plans bounded to historical or supporting package execution. Active priority still comes from `_workflow/ROADMAP.md`.",
  },
  "docs/superpowers/specs": {
    title: "superpowers specs directory map",
    updated: "2026-07-29",
    entries: {
      "2026-07-26-cbm-cli-bridge-design.md": "Design specification for the CBM CLI bridge MVP package.",
      "2026-07-26-cbm-full-tool-surface-design.md": "Design specification for the full CBM tool-surface package.",
      "2026-07-26-cbm-reliability-hardening-design.md": "Design specification for CBM bridge reliability hardening.",
      "2026-07-26-cbm-v0-9-0-compatibility-hardening-design.md": "Design specification for CBM v0.9.0 compatibility hardening.",
      "2026-08-09-process-runner-async-design.md": "Design specification for durable asynchronous process execution and policy hardening.",
      "2026-08-13-structured-file-mutation-design.md": "Design specification for staged content, streaming file mutation, physical split/merge, and Markdown structure tools.",
    },
    tail: "Use these specs as supporting design evidence only. Current runtime and connector behavior must still be verified through tests, live probes, and canonical specs.",
  },
  "src": {
    title: "src directory map",
    updated: "2026-07-27",
    entries: {
      "auth/": "OAuth/OAuth21, legacy auth, and authorization-server implementation modules.",
      "exec/": "Bounded execution and process-control support.",
      "integrations/": "External dependency bridges and versioned integration contracts.",
      "memory/": "Memory/state/task support modules for the MCP surface.",
      "plugin/": "Plugin registry, visibility, governance, and execution support.",
      "runtime/": "Core MCP runtime assembly, routing, handlers, and observability wiring.",
      "schemas/": "Schema and descriptor helpers for MCP-visible contracts.",
      "truth/": "Read-only truth/audit helpers used for repo/runtime/workflow inspection.",
      "util/": "General utility support used across runtime and guards.",
      "README.md": "Source-tree orientation note.",
    },
  },
  "src/integrations": {
    title: "source integrations directory map",
    updated: "2026-07-27",
    entries: {
      "codebase_memory/": "External integration boundaries for the native codebase-memory executable and its versioned contract.",
    },
    tail: "Keep dependency-specific transport, compatibility, and normalization logic inside this boundary rather than leaking it into general runtime modules.",
  },
  "src/integrations/codebase_memory": {
    title: "codebase-memory integration directory map",
    updated: "2026-07-27",
    entries: {
      "cbm_cli_bridge.js": "Native process bridge for executable discovery, stdin JSON transport, timeouts, output parsing, normalization, and queue-aware execution.",
      "cbm_contract_registry.js": "Loads and validates versioned native CBM contract manifests used by bridge compatibility checks.",
      "cbm_tools.js": "Runtime-facing CBM orchestration, containment, mutation locking, ADR preservation, error mapping, and result shaping.",
      "contracts/": "Versioned native codebase-memory contract manifests; currently anchored to v0.9.0.",
    },
    tail: "This directory describes bridge and runtime behavior. Repository files remain repository truth, while persisted CBM graphs and ADR data remain index truth.",
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
    updated: "2026-08-09",
    entries: {
      "archive/": "Archived legacy and stale smoke material retained for traceability only.",
      "fixtures/": "Static fixtures used by smoke tests.",
      "helpers/": "Reusable helper modules for smoke/test assertions and baselines.",
      "targeted_debt/": "Focused debt-review and readiness artifacts outside the default run-all surface.",
      "README.md": "Orientation, inventory, and maintenance rules for the `_tests` tree.",
      "run_all_smokes.js": "Active smoke harness entrypoint.",
      "run_all_smoke_scripts.json": "Default active smoke manifest.",
      "smoke_directory_docs_audit.js": "Guard for churn-ranked `DIRECTORY.md` coverage on currently high-change directories.",
      "smoke_build_index_tool.js": "Regression coverage for workspace-index profiles, freshness, structured workflow extraction, and retrieval ranking.",
      "smoke_operator_contract_docs.js": "Guard for operator-facing documentation contract and initial DIRECTORY rollout.",
      "smoke_operational_e2e_matrix.js": "Guard for OPS-1A family classification, evidence references, explicit gaps, and bounded runner selection.",
      "live_cloudflare_boundary_probe.js": "Explicit non-default read-only live probe for Cloudflare health, OAuth metadata, method guard, and auth challenge.",
      "operational_network_manifest.json": "One-entry live network manifest that supplies the full isolated MCP harness required by `smoke_network.js`.",
    },
    tail: "This map is intentionally compact. The complete active inventory remains in `_tests/README.md` and `run_all_smoke_scripts.json`.",
  },
};

function render(cfg) {
  const lines = [
    "# DIRECTORY",
    "",
    `Status: active ${cfg.title}`,
    `Updated: ${cfg.updated || TODAY}`,
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

function describeArtifactEntry(entry) {
  const name = entry.name;
  if (entry.isDirectory()) {
    return `Nested runtime-owned artifact bundle for \`${name}\`.`;
  }
  if (/\.json$/i.test(name)) {
    return "JSON control-plane receipt, record, or metadata artifact emitted by the bounded procedure.";
  }
  if (/\.sqlite$/i.test(name)) {
    return "SQLite backup artifact captured for bounded rollback or auditability.";
  }
  if (/\.bak($|\.)/i.test(name)) {
    return "Legacy or bounded backup artifact retained for traceability.";
  }
  return "Runtime-owned support artifact retained for bounded operational procedures.";
}

function renderRuntimeOwnedDirectory({ title, intro, tail, entries }) {
  const lines = [
    "# DIRECTORY",
    "",
    `Status: active ${title}`,
    `Updated: ${TODAY}`,
    "",
  ];
  if (intro) {
    lines.push(intro);
    lines.push("");
  }
  if (!entries.length) {
    lines.push("It is currently empty.");
  } else {
    for (const entry of entries) {
      const suffix = entry.isDirectory() ? "/" : "";
      lines.push(`- \`${entry.name}${suffix}\``);
      lines.push(`  ${describeArtifactEntry(entry)}`);
    }
  }
  if (tail) {
    lines.push("");
    lines.push(tail);
  }
  lines.push("");
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

const runtimeOwnedRoots = [
  {
    relPath: path.join("_workflow", "control_plane", "file_backups"),
    title: "control-plane file backups directory map",
    intro: "This directory stores runtime-owned backup bundles produced by bounded operational procedures.",
    tail: "Treat these backup bundles as support artifacts for rollback and auditability, not as active workflow authority.",
  },
  {
    relPath: path.join("_workflow", "control_plane", "oauth21_prune_backups"),
    title: "oauth21 prune backups directory map",
    intro: "This directory stores backup bundles emitted by explicit OAuth21 prune execute runs.",
    tail: "Treat these backup bundles as control-plane support artifacts, not as canonical workflow truth.",
  },
];

for (const rootConfig of runtimeOwnedRoots) {
  const absRoot = path.join(ROOT, rootConfig.relPath);
  if (!fs.existsSync(absRoot)) continue;
  const entries = fs.readdirSync(absRoot, { withFileTypes: true }).filter((entry) => entry.name !== "DIRECTORY.md");
  writeFile(path.join(absRoot, "DIRECTORY.md"), renderRuntimeOwnedDirectory({ ...rootConfig, entries }));
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const childAbs = path.join(absRoot, entry.name);
    const childEntries = fs.readdirSync(childAbs, { withFileTypes: true }).filter((item) => item.name !== "DIRECTORY.md");
    writeFile(
      path.join(childAbs, "DIRECTORY.md"),
      renderRuntimeOwnedDirectory({
        title: `${path.basename(rootConfig.relPath)} bundle directory map`,
        intro: `This bundle belongs to \`${entry.name}\` under \`${rootConfig.relPath.replaceAll("\\", "/")}\`.`,
        tail: "This directory is runtime-owned support material for bounded control-plane procedures.",
        entries: childEntries,
      })
    );
  }
}
