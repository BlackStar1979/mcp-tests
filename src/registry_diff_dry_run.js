"use strict";

const crypto = require("node:crypto");
const { diffToolLists } = require("./tools_list_diff");
const { buildListChangedNotificationEnvelope } = require("./list_changed_notification_bus");
const { runListChangedHarness } = require("./list_changed_harness");

const REGISTRY_DIFF_DRY_RUN_VERSION = "registry-diff-dry-run-v1";

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashValue(value) {
  return crypto.createHash("sha256").update(stableJson(value)).digest("hex").slice(0, 16);
}

function descriptorForEntry(entry) {
  return entry?.descriptor || entry?.tool?.descriptor || null;
}

function snapshotRegistryForDiff({ registry, label = "" } = {}) {
  if (!registry || typeof registry.entries !== "function") {
    throw new Error("snapshotRegistryForDiff requires a registry with entries().");
  }
  const entries = registry.entries().map((entry) => {
    const descriptor = descriptorForEntry(entry);
    if (!entry?.name || !descriptor || descriptor.name !== entry.name) {
      throw new Error(`Invalid registry entry for diff snapshot: ${entry?.name || "<missing>"}`);
    }
    return {
      name: entry.name,
      source: entry.source || "unknown",
      descriptor_hash: hashValue(descriptor),
      descriptor_summary: {
        name: descriptor.name,
        title: descriptor.title || null,
        description_hash: hashValue(descriptor.description || ""),
        input_schema_hash: hashValue(descriptor.inputSchema || null),
        output_schema_hash: hashValue(descriptor.outputSchema || null),
        annotations_hash: hashValue(descriptor.annotations || null),
      },
    };
  }).sort((a, b) => a.name.localeCompare(b.name));

  return {
    schema_version: "registry-diff-snapshot-v1",
    label: String(label || ""),
    registry_version: registry.version || "unknown",
    tool_count: entries.length,
    names: entries.map((entry) => entry.name),
    entries,
    entries_hash: hashValue(entries),
  };
}

function entryMap(snapshot) {
  return new Map((snapshot?.entries || []).map((entry) => [entry.name, entry]));
}

function diffRegistrySnapshots({ currentSnapshot, targetSnapshot, reason = "", correlationId = "" } = {}) {
  if (!currentSnapshot || !targetSnapshot) {
    throw new Error("diffRegistrySnapshots requires currentSnapshot and targetSnapshot.");
  }
  const nameDiff = diffToolLists({ current: currentSnapshot.names || [], target: targetSnapshot.names || [] });
  const currentEntries = entryMap(currentSnapshot);
  const targetEntries = entryMap(targetSnapshot);
  const update = [];

  for (const name of nameDiff.unchanged) {
    const currentEntry = currentEntries.get(name);
    const targetEntry = targetEntries.get(name);
    if (currentEntry && targetEntry && currentEntry.descriptor_hash !== targetEntry.descriptor_hash) {
      update.push({
        name,
        current_descriptor_hash: currentEntry.descriptor_hash,
        target_descriptor_hash: targetEntry.descriptor_hash,
      });
    }
  }

  const updateNames = update.map((entry) => entry.name).sort();
  const unchanged = nameDiff.unchanged.filter((name) => !updateNames.includes(name));
  const changeCount = nameDiff.add.length + nameDiff.remove.length + update.length;

  return {
    success: true,
    mode: "registry-diff-dry-run",
    registry_diff_version: REGISTRY_DIFF_DRY_RUN_VERSION,
    source: "static_tool_registry",
    reason: String(reason || ""),
    correlation_id: String(correlationId || ""),
    current_tool_count: currentSnapshot.tool_count || 0,
    target_tool_count: targetSnapshot.tool_count || 0,
    add_count: nameDiff.add.length,
    remove_count: nameDiff.remove.length,
    update_count: update.length,
    unchanged_count: unchanged.length,
    change_count: changeCount,
    current_tools_hash: nameDiff.current_tools_hash,
    target_tools_hash: nameDiff.target_tools_hash,
    current_registry_hash: currentSnapshot.entries_hash || "",
    target_registry_hash: targetSnapshot.entries_hash || "",
    add: nameDiff.add,
    remove: nameDiff.remove,
    update,
    update_names: updateNames,
    unchanged,
    would_change_tools_list: changeCount > 0,
    would_require_list_changed: changeCount > 0,
    list_changed_enabled_now: false,
    execute_allowed_now: false,
    real_mutation_enabled: false,
    required_approvals: changeCount > 0 ? [
      "registry diff review",
      "explicit operator approval",
      "client refresh or notifications/tools/list_changed workflow",
    ] : [],
    blockers: changeCount > 0 ? [
      "real registry mutation is disabled",
      "real tools/list mutation is disabled",
      "notifications/tools/list_changed emission is disabled",
    ] : [],
    warnings: changeCount > 0 ? ["registry diff is dry-run only and must not be applied in the current mode"] : [],
  };
}

function runRegistryListChangedDryRun({ currentRegistry, targetRegistry, capabilities = { tools: { listChanged: false } }, reason = "", correlationId = "" } = {}) {
  const currentSnapshot = snapshotRegistryForDiff({ registry: currentRegistry, label: "current" });
  const targetSnapshot = snapshotRegistryForDiff({ registry: targetRegistry, label: "target" });
  const diff = diffRegistrySnapshots({ currentSnapshot, targetSnapshot, reason, correlationId });
  const envelope = buildListChangedNotificationEnvelope({ diff, reason, correlationId });
  const harness = runListChangedHarness({ diff, capabilities, allowEmit: false, reason, correlationId });

  return {
    success: diff.success === true && envelope.success === true && harness.success === true,
    mode: "registry-list-changed-dry-run",
    registry_diff_version: REGISTRY_DIFF_DRY_RUN_VERSION,
    diff,
    envelope_summary: {
      method: envelope.method,
      would_notify: envelope.would_notify,
      notification_emitted: envelope.notification_emitted,
      transport_send_called: envelope.transport_send_called,
      diff_hash: envelope.diff_hash,
    },
    harness_summary: {
      would_notify: harness.would_notify,
      ready_to_emit_now: harness.ready_to_emit_now,
      notification_emitted: harness.notification_emitted,
      transport_send_called: harness.transport_send_called,
      blocker_count: Array.isArray(harness.blockers) ? harness.blockers.length : 0,
    },
    runtime_tools_list_mutated: false,
    runtime_transport_used: false,
    client_notification_emitted: false,
  };
}

module.exports = {
  REGISTRY_DIFF_DRY_RUN_VERSION,
  diffRegistrySnapshots,
  hashValue,
  runRegistryListChangedDryRun,
  snapshotRegistryForDiff,
  stableJson,
};
