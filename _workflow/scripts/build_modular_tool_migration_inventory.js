"use strict";

const fs = require("fs");
const path = require("path");

const MCP_REGISTER_PATTERNS = [
  /registerSafeTool\(\s*server\s*,\s*["']([^"']+)["']/gms,
  /server\.registerTool\(\s*["']([^"']+)["']/gms,
];

const CAPABILITY_EQUIVALENTS = Object.freeze({
  search: "search",
  fetch: "fetch",
  http_get: "net_http_get_allowlisted",
  fetch_github_file: "net_fetch_github_raw",
  check_npm_package: "net_check_npm_package",
  check_pypi_package: "net_check_pypi_package",
  code_symbols: "dev_code_symbols",
  code_dependencies: "dev_code_dependencies",
  code_audit: "dev_code_audit",
  code_impact: "dev_code_impact",
});

const DECISION_OVERRIDES = Object.freeze({
  search: {
    overlap_status: "name_conflict_semantic_divergence",
    mapped_tool: "search",
    migration_action: "rename_on_port",
    resolution: "keep_existing_and_port_renamed",
    notes: [
      "mcp-tests search is public document search; modular search is workspace search across configured roots.",
      "Do not overwrite the public search contract on workbench.",
      "If ported, modular search must land under a new authorized/tests-only name.",
    ],
  },
  fetch: {
    overlap_status: "name_conflict_semantic_divergence",
    mapped_tool: "fetch",
    migration_action: "rename_on_port",
    resolution: "keep_existing_and_port_renamed",
    notes: [
      "mcp-tests fetch reads public test documents; modular fetch reads arbitrary workspace files from search results.",
      "Do not overwrite the public fetch contract on workbench.",
      "If ported, modular fetch must land under a new authorized/tests-only name.",
    ],
  },
  http_get: {
    overlap_status: "capability_overlap",
    mapped_tool: "net_http_get_allowlisted",
    migration_action: "keep_existing",
    resolution: "prefer_existing",
    notes: [
      "Current workbench tool already adds SSRF guardrails, redirect handling, DNS/IP checks, and richer transport metadata.",
      "Do not port a second HTTP GET tool unless new functionality appears.",
    ],
  },
  fetch_github_file: {
    overlap_status: "capability_overlap",
    mapped_tool: "net_fetch_github_raw",
    migration_action: "keep_existing",
    resolution: "prefer_existing",
    notes: [
      "Current workbench tool already covers the raw GitHub fetch use case with stricter input validation and bounded output.",
      "Do not port a second GitHub raw fetch tool unless new functionality appears.",
    ],
  },
  check_npm_package: {
    overlap_status: "capability_overlap",
    mapped_tool: "net_check_npm_package",
    migration_action: "keep_existing",
    resolution: "merged_into_existing_keep_existing",
    notes: [
      "Current workbench tool already includes bounded transport fields plus normalized npm summary fields.",
      "Do not port a second npm metadata tool; keep the consolidated workbench tool.",
    ],
  },
  check_pypi_package: {
    overlap_status: "capability_overlap",
    mapped_tool: "net_check_pypi_package",
    migration_action: "keep_existing",
    resolution: "merged_into_existing_keep_existing",
    notes: [
      "Current workbench tool already includes bounded transport fields plus normalized PyPI summary fields and found/not_found semantics.",
      "Do not port a second PyPI metadata tool; keep the consolidated workbench tool.",
    ],
  },
  pypi_info: {
    overlap_status: "capability_overlap",
    mapped_tool: "net_check_pypi_package",
    migration_action: "do_not_port_alias",
    resolution: "merge_unique_fields",
    notes: [
      "modular pypi_info is the same handler family as check_pypi_package and should not survive as a second alias on workbench.",
      "Any useful extra fields should merge into net_check_pypi_package instead.",
    ],
  },
  code_symbols: {
    overlap_status: "capability_overlap",
    mapped_tool: "dev_code_symbols",
    migration_action: "keep_existing",
    resolution: "prefer_existing",
    notes: [
      "Current workbench dev tool already provides the bounded symbol extraction capability on workspace code.",
      "Keep one tool unless modular code exposes extra semantics worth merging.",
    ],
  },
  code_dependencies: {
    overlap_status: "capability_overlap",
    mapped_tool: "dev_code_dependencies",
    migration_action: "keep_existing",
    resolution: "prefer_existing",
    notes: [
      "Current workbench dev tool already provides bounded dependency graph inspection.",
      "Keep one tool unless modular code exposes extra semantics worth merging.",
    ],
  },
  code_audit: {
    overlap_status: "capability_overlap",
    mapped_tool: "dev_code_audit",
    migration_action: "keep_existing",
    resolution: "prefer_existing",
    notes: [
      "Current workbench dev tool already provides bounded dependency audit output.",
      "Keep one tool unless modular code exposes extra semantics worth merging.",
    ],
  },
  code_impact: {
    overlap_status: "capability_overlap",
    mapped_tool: "dev_code_impact",
    migration_action: "keep_existing",
    resolution: "prefer_existing",
    notes: [
      "Current workbench dev tool already provides bounded code impact tracing.",
      "Keep one tool unless modular code exposes extra semantics worth merging.",
    ],
  },
});

const SAFE_PUBLIC_TOOLS = new Set([
  "search",
  "fetch",
  "http_get",
  "fetch_github_file",
  "check_npm_package",
  "check_pypi_package",
  "pypi_info",
]);

const SAFE_TESTS_PREFIXES = [
  "code_runtime_map",
  "project_truth_audit",
  "tool_usage_snapshot",
  "change_workflow_simulator",
  "deploy_decision_guard",
  "index_status",
  "search_index",
  "search_index_context",
  "collect_context",
  "collect_romionsim_context",
  "code_symbols",
  "code_dependencies",
  "code_audit",
  "code_impact",
  "code_patch_plan",
  "code_scenario",
  "tool_registry_status",
  "tool_registry_list",
  "tool_registry_get_tool",
  "tool_registry_validate_tool",
  "tool_registry_policy",
  "tool_registry_preflight",
  "tool_registry_execute",
  "tool_registry_plan",
  "get_info",
  "list_directory",
  "read_file",
  "read_file_lines",
  "read_file_chunk",
  "inventory_tree",
  "fits_info",
  "hdf5_info",
  "table_profile",
  "process_runner_status",
  "remote_site_runtime_status",
  "preview_remote_site_retention",
  "list_remote_site_files",
  "read_remote_site_file",
];

const UNSAFE_TOOL_NAMES = new Set([
  "append_file",
  "build_index",
  "code_apply_patch",
  "code_orchestrate",
  "code_rollback_patch",
  "copy_path",
  "delete_path",
  "delete_remote_site_file",
  "edit_file_patch",
  "edit_remote_site_file",
  "move_path",
  "move_remote_site_file",
  "restore_path",
  "restore_remote_site_file",
  "run_process",
  "tool_dispatch",
  "write_file",
  "write_remote_site_file",
]);

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function walkJsFiles(dirPath, out = []) {
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const absolutePath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkJsFiles(absolutePath, out);
      continue;
    }
    if (entry.isFile() && absolutePath.endsWith(".js")) {
      out.push(absolutePath);
    }
  }
  return out;
}

function scanModularTools(mcpRoot) {
  const coreRoot = path.join(mcpRoot, "core");
  const files = walkJsFiles(coreRoot);
  const tools = new Map();

  for (const filePath of files) {
    const source = fs.readFileSync(filePath, "utf8");
    const relativeFilePath = path.relative(mcpRoot, filePath).replace(/\\/g, "/");

    for (const pattern of MCP_REGISTER_PATTERNS) {
      let match = null;
      while ((match = pattern.exec(source))) {
        const toolName = match[1];
        if (!tools.has(toolName)) {
          tools.set(toolName, {
            tool: toolName,
            source_files: [],
          });
        }
        tools.get(toolName).source_files.push(relativeFilePath);
      }
    }
  }

  return Array.from(tools.values())
    .map((entry) => ({
      ...entry,
      source_files: Array.from(new Set(entry.source_files)).sort(),
    }))
    .sort((a, b) => a.tool.localeCompare(b.tool));
}

function familyFromSourceFiles(sourceFiles) {
  const first = sourceFiles[0] || "";
  if (first.includes("core/web/")) return "web";
  if (first.includes("core/filesystem/read_tools")) return "filesystem_read";
  if (first.includes("core/filesystem/mutation_tools")) return "filesystem_mutation";
  if (first.includes("core/filesystem/patch_tools")) return "filesystem_patch";
  if (first.includes("core/remote_site/file_ops_tools")) return "remote_site_file_ops";
  if (first.includes("core/remote_site/runtime_tools")) return "remote_site_runtime";
  if (first.includes("core/process_tools_safe")) return "process";
  if (first.includes("core/science_tools")) return "science";
  if (first.includes("core/tools_index")) return "index";
  if (first.includes("core/truth/")) return "truth";
  if (first.includes("core/connector_tools")) return "connector";
  if (first.includes("core/registry_tools_safe")) return "registry";
  if (first.includes("core/code/")) return "code";
  if (first.includes("core/code_tools")) return "code";
  return "review";
}

function classifySafety(toolName) {
  if (UNSAFE_TOOL_NAMES.has(toolName)) {
    return {
      safety: "unsafe",
      confidence: "high",
      reason: "Name or operation implies mutation, deletion, process execution, or write-side effects.",
    };
  }

  if (SAFE_PUBLIC_TOOLS.has(toolName)) {
    return {
      safety: "safe",
      confidence: "high",
      reason: "Bounded read-only retrieval capability candidate for public exposure.",
    };
  }

  if (SAFE_TESTS_PREFIXES.includes(toolName)) {
    return {
      safety: "safe",
      confidence: "high",
      reason: "Read-only inspection, planning, status, or analysis capability.",
    };
  }

  return {
    safety: "review",
    confidence: "medium",
    reason: "Could not classify conservatively from registration site and tool name alone.",
  };
}

function classifyTargetSurface(toolName, safety) {
  if (SAFE_PUBLIC_TOOLS.has(toolName) && safety.safety === "safe") {
    return {
      target_surface: "public",
      reason: "Public-safe, bounded retrieval capability.",
    };
  }

  if (safety.safety === "unsafe") {
    return {
      target_surface: "tests",
      reason: "Unsafe capability belongs only on the broad authenticated tests surface.",
    };
  }

  if (safety.safety === "safe") {
    return {
      target_surface: "tests",
      reason: "Safe capability still requires full-workspace or non-public operational scope.",
    };
  }

  return {
    target_surface: "review",
    reason: "Target surface needs manual confirmation before migration.",
  };
}

function normalizeCurrentMcpTestsSurface(toolPolicyModule) {
  const publicTools = Array.from(new Set(toolPolicyModule.PUBLIC_TOOL_NAMES)).sort();
  const testsTools = Array.from(
    new Set([...toolPolicyModule.PUBLIC_TOOL_NAMES, ...toolPolicyModule.AUTHORIZED_MCP_TOOL_NAMES])
  ).sort();
  return {
    public: publicTools,
    tests: testsTools,
  };
}

function overlapStatus(toolName, testsSurface) {
  if (testsSurface.public.includes(toolName)) {
    return {
      status: "exact_public",
      mapped_tool: toolName,
      reason: "Exact tool already present on current public surface.",
    };
  }

  if (testsSurface.tests.includes(toolName)) {
    return {
      status: "exact_tests",
      mapped_tool: toolName,
      reason: "Exact tool already present on current authenticated surface.",
    };
  }

  const equivalent = CAPABILITY_EQUIVALENTS[toolName];
  if (equivalent && testsSurface.tests.includes(equivalent)) {
    return {
      status: "capability_overlap",
      mapped_tool: equivalent,
      reason: "Equivalent capability already exists under a different tool name.",
    };
  }

  return {
    status: "missing",
    mapped_tool: null,
    reason: "No exact or conservative capability-equivalent tool found in mcp-tests.",
  };
}

function migrationAction(overlap, targetSurface, safety) {
  const override = DECISION_OVERRIDES[overlap.tool_name || ""];
  if (override?.migration_action) {
    return override.migration_action;
  }

  if (overlap.status === "exact_public" || overlap.status === "exact_tests") {
    return "already_present";
  }

  if (overlap.status === "capability_overlap") {
    return "review_existing_equivalent";
  }

  if (targetSurface.target_surface === "review" || safety.safety === "review") {
    return "manual_review";
  }

  if (targetSurface.target_surface === "public") {
    return "port_public";
  }

  return "port_tests";
}

function buildInventory(repoRoot, mcpRoot) {
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const toolPolicy = require(path.join(repoRoot, "src", "tool_policy.js"));
  const testsSurface = normalizeCurrentMcpTestsSurface(toolPolicy);
  const modularTools = scanModularTools(mcpRoot);

  const items = modularTools.map((entry) => {
    const family = familyFromSourceFiles(entry.source_files);
    const safety = classifySafety(entry.tool);
    const targetSurface = classifyTargetSurface(entry.tool, safety);
    const overlap = { ...overlapStatus(entry.tool, testsSurface), tool_name: entry.tool };
    const action = migrationAction(overlap, targetSurface, safety);
    const override = DECISION_OVERRIDES[entry.tool] || null;
    const resolvedOverlapStatus = override?.overlap_status || overlap.status;
    const resolvedMappedTool = override?.mapped_tool !== undefined ? override.mapped_tool : overlap.mapped_tool;
    const resolution = override?.resolution || (overlap.status === "capability_overlap" ? "review_needed" : "");
    const notes = [safety.reason, targetSurface.reason, overlap.reason];
    if (override?.notes) notes.push(...override.notes);
    return {
      tool: entry.tool,
      source_files: entry.source_files,
      family,
      module_visibility: "external",
      safety: safety.safety,
      safety_confidence: safety.confidence,
      target_surface: targetSurface.target_surface,
      overlap_status: resolvedOverlapStatus,
      mapped_tool: resolvedMappedTool,
      migration_action: action,
      overlap_resolution: resolution,
      notes,
    };
  });

  const summary = {
    total_tools: items.length,
    by_surface: countBy(items, "target_surface"),
    by_safety: countBy(items, "safety"),
    by_action: countBy(items, "migration_action"),
    exact_or_equivalent_overlap_count: items.filter((item) => item.overlap_status !== "missing").length,
    missing_count: items.filter((item) => item.overlap_status === "missing").length,
  };

  return {
    generated_at: new Date().toISOString(),
    source_repo: {
      name: "mcp",
      path: mcpRoot.replace(/\\/g, "/"),
    },
    target_repo: {
      name: "mcp-tests",
      path: repoRoot.replace(/\\/g, "/"),
    },
    normalization_notes: [
      "mcp-tests runtime code currently uses public/internal profile labels; this inventory normalizes the broad authenticated surface to tests to match workflow terminology.",
      "Only external MCP-visible tool registrations from mcp/core/**/*.js are inventoried here.",
      "Review entries are intentionally conservative and should be resolved before migration.",
    ],
    current_mcp_tests_surface: testsSurface,
    items,
    summary,
  };
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key];
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function renderMarkdown(inventory) {
  const lines = [];
  lines.push("# Modular Tool Migration Inventory");
  lines.push("");
  lines.push(`Generated: ${inventory.generated_at}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Source repo: \`${inventory.source_repo.path}\``);
  lines.push(`- Target repo: \`${inventory.target_repo.path}\``);
  lines.push(`- Total modular external tools: ${inventory.summary.total_tools}`);
  lines.push(`- Existing exact/equivalent overlap: ${inventory.summary.exact_or_equivalent_overlap_count}`);
  lines.push(`- Missing in mcp-tests: ${inventory.summary.missing_count}`);
  lines.push("");
  lines.push("### By target surface");
  lines.push("");
  for (const [name, count] of Object.entries(inventory.summary.by_surface).sort()) {
    lines.push(`- \`${name}\`: ${count}`);
  }
  lines.push("");
  lines.push("### By safety");
  lines.push("");
  for (const [name, count] of Object.entries(inventory.summary.by_safety).sort()) {
    lines.push(`- \`${name}\`: ${count}`);
  }
  lines.push("");
  lines.push("### By migration action");
  lines.push("");
  for (const [name, count] of Object.entries(inventory.summary.by_action).sort()) {
    lines.push(`- \`${name}\`: ${count}`);
  }
  lines.push("");
  lines.push("## Review-first items");
  lines.push("");
  const reviewItems = inventory.items.filter(
    (item) =>
      item.safety === "review" ||
      item.target_surface === "review" ||
      item.migration_action === "manual_review" ||
      item.migration_action === "review_existing_equivalent"
  );
  if (reviewItems.length === 0) {
    lines.push("- none");
  } else {
    for (const item of reviewItems) {
      lines.push(`- \`${item.tool}\` (${item.family}) -> [${item.overlap_resolution || item.migration_action}] ${item.notes.join(" ")}`);
    }
  }
  lines.push("");
  lines.push("## Overlap resolutions");
  lines.push("");
  const resolvedItems = inventory.items.filter((item) => item.overlap_status !== "missing");
  if (resolvedItems.length === 0) {
    lines.push("- none");
  } else {
    for (const item of resolvedItems) {
      lines.push(`- \`${item.tool}\` -> \`${item.mapped_tool || "-"}\` : \`${item.overlap_resolution || item.migration_action}\``);
    }
  }
  lines.push("");
  lines.push("## Inventory");
  lines.push("");
  lines.push("| tool | family | safety | target surface | overlap | resolution | action |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const item of inventory.items) {
    lines.push(
      `| \`${item.tool}\` | \`${item.family}\` | \`${item.safety}\` | \`${item.target_surface}\` | \`${item.overlap_status}${item.mapped_tool ? `:${item.mapped_tool}` : ""}\` | \`${item.overlap_resolution || "-"}\` | \`${item.migration_action}\` |`
    );
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function main() {
  const repoRoot = path.resolve(__dirname, "..", "..");
  const mcpRoot = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(repoRoot, "..", "mcp");
  const inventoryDir = path.join(repoRoot, "_workflow", "inventories");
  ensureDir(inventoryDir);

  const inventory = buildInventory(repoRoot, mcpRoot);
  const jsonPath = path.join(inventoryDir, "modular_tool_migration_inventory.json");
  const mdPath = path.join(inventoryDir, "modular_tool_migration_inventory.md");

  fs.writeFileSync(jsonPath, `${JSON.stringify(inventory, null, 2)}\n`, "utf8");
  fs.writeFileSync(mdPath, renderMarkdown(inventory), "utf8");

  process.stdout.write(
    JSON.stringify(
      {
        status: "ok",
        json: path.relative(repoRoot, jsonPath).replace(/\\/g, "/"),
        markdown: path.relative(repoRoot, mdPath).replace(/\\/g, "/"),
        summary: inventory.summary,
      },
      null,
      2
    )
  );
}

main();
