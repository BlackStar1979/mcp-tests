"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT = process.cwd();
const DEFAULT_FILES = [
  "_workflow/WORKFLOW_CANON.md",
  "_workflow/state.json",
  "_workflow/README.md",
  "_workflow/scripts/workflow_snapshot.js",
  "_workflow/scripts/workflow_validate.js",
  "_workflow/scripts/runtime_apply_package_preparation_check.js",
  "_tests/smoke_workstream_boundary_control_review.js",
  "_tests/smoke_workplace_contract.js",
  "_tests/run_all_smokes.js",
  "_tests/run_all_smoke_scripts.json",
];

const RUNTIME_SNAPSHOT_ALLOWLIST = new Set([
  "server.js",
  "src/stage_metadata.js",
  "src/runtime/identity.js",
  "src/runtime/auth_bootstrap_config_resolver.js",
  "src/runtime/cors_preflight_handler.js",
  "src/runtime/startup_report_builder.js",
  "src/runtime/server_cli_args.js",
  "src/runtime/static_docs.js",
  "src/runtime/server_factory.js",
  "src/runtime/server_lifecycle.js",
  "src/runtime/server_bootstrap_runtime.js",
  "src/runtime/mcp_runtime_handlers.js",
  "src/runtime/runtime_context_assembly.js",
  "src/runtime/runtime_status_assembly.js",
  "src/runtime/optional_tools_assembly.js",
  "src/runtime/runtime_support_assembly.js",
  "src/runtime/code_sample_selftest.js",
  "src/mechanism_parity_matrix.js",
  "src/truth/parity_audit.js",
  "src/truth/project_truth_audit.js",
  "src/runtime/request_body_parse_handler.js",
  "tools/plugin_execution_governance.js",
  "src/schemas/plugin_execution_tools.js",
  "src/auth/auth_policy.js",
  "src/auth/auth_access.js",
  "src/auth/auth_bearer.js",
  "src/startup_report.js",
  "SERVER_SPEC.json",
]);

const FORBIDDEN_PATH_SEGMENTS = new Set([
  ".env",
  ".mcp_trash",
  ".secrets",
  "logs",
  "_logs",
  "node_modules",
]);

function safeLabel(label) {
  return String(label || "workflow-snapshot")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "workflow-snapshot";
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function parseArgs(argv) {
  const args = { files: [] };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--file") {
      if (!argv[i + 1]) throw new Error("--file requires a value");
      args.files.push(argv[i + 1]);
      i += 1;
    } else if (arg === "--label") {
      if (!argv[i + 1]) throw new Error("--label requires a value");
      args.label = argv[i + 1];
      i += 1;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return args;
}

function assertSafeRelativePath(filePath) {
  if (path.isAbsolute(filePath)) throw new Error(`absolute path rejected: ${filePath}`);
  const normalized = filePath.replace(/\\/g, "/");
  if (normalized.includes("../") || normalized === "..") {
    throw new Error(`traversal rejected: ${filePath}`);
  }
  if (
    normalized === "_workflow/control_plane/snapshots" ||
    normalized.startsWith("_workflow/control_plane/snapshots/")
  ) {
    throw new Error(`nested control-plane snapshots rejected: ${filePath}`);
  }
  const segments = normalized.split("/");
  for (const segment of segments) {
    if (FORBIDDEN_PATH_SEGMENTS.has(segment)) {
      throw new Error(`forbidden snapshot path segment rejected: ${filePath}`);
    }
  }
  if (
    !normalized.startsWith("_workflow/") &&
    !normalized.startsWith("_tests/") &&
    !RUNTIME_SNAPSHOT_ALLOWLIST.has(normalized)
  ) {
    throw new Error(
      `workflow snapshot only accepts _workflow/, _tests/, or explicitly allowlisted runtime files: ${filePath}`
    );
  }
  return normalized;
}

function createSnapshot({ label = "workflow-snapshot", files = DEFAULT_FILES } = {}) {
  const normalizedFiles = files.map((filePath) => assertSafeRelativePath(filePath));
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const snapshotDir = path.join(ROOT, "_workflow", "control_plane", "snapshots", `${timestamp}_${safeLabel(label)}`);
  fs.mkdirSync(snapshotDir, { recursive: true });

  const entries = [];
  for (const normalizedPath of normalizedFiles) {
    const source = path.resolve(ROOT, normalizedPath);
    const relativeSource = path.relative(ROOT, source).replace(/\\/g, "/");
    if (relativeSource.startsWith("../") || relativeSource === ".." || path.isAbsolute(relativeSource)) {
      throw new Error(`resolved path escapes repository root: ${filePath}`);
    }
    if (!fs.existsSync(source)) {
      entries.push({ path: normalizedPath, copied: false, reason: "missing" });
      continue;
    }
    const content = fs.readFileSync(source);
    const target = path.join(snapshotDir, normalizedPath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
    entries.push({
      path: normalizedPath,
      copied: true,
      bytes: content.length,
      sha256: sha256(content),
    });
  }

  const manifest = {
    snapshot_version: "workflow-snapshot-v1",
    created_at: new Date().toISOString(),
    label: safeLabel(label),
    root: "mcp-tests",
    path: path.relative(ROOT, snapshotDir).replace(/\\/g, "/"),
    entries,
  };
  fs.writeFileSync(path.join(snapshotDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

if (require.main === module) {
  try {
    const args = parseArgs(process.argv);
    const manifest = createSnapshot({
      label: args.label || "workflow-snapshot",
      files: args.files.length ? args.files : DEFAULT_FILES,
    });
    console.log(JSON.stringify(manifest, null, 2));
  } catch (error) {
    console.error(error?.stack || error?.message || String(error));
    process.exit(1);
  }
}

module.exports = {
  createSnapshot,
};

