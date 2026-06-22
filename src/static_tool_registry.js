"use strict";

function cloneDescriptor(descriptor) {
  return descriptor && typeof descriptor === "object" ? JSON.parse(JSON.stringify(descriptor)) : descriptor;
}

function normalizeEntry(entry, index) {
  if (!entry || typeof entry !== "object") {
    throw new Error(`Invalid registry entry at index ${index}.`);
  }
  const name = entry.name || entry.descriptor?.name || entry.tool?.name;
  const descriptor = entry.descriptor || entry.tool?.descriptor;
  if (!name || typeof name !== "string") {
    throw new Error(`Static registry entry ${index} missing name.`);
  }
  if (!descriptor || descriptor.name !== name) {
    throw new Error(`Static registry entry ${name} missing matching descriptor.`);
  }
  return Object.freeze({
    name,
    source: entry.source || "unknown",
    descriptor,
    tool: entry.tool || null,
  });
}

function createStaticToolRegistry({ coreDescriptors = [], optionalTools = [], metadata = {} } = {}) {
  const entries = [];

  for (const descriptor of coreDescriptors) {
    entries.push(normalizeEntry({
      name: descriptor?.name,
      source: "core",
      descriptor,
    }, entries.length));
  }

  for (const tool of optionalTools) {
    entries.push(normalizeEntry({
      name: tool?.name,
      source: "optional",
      descriptor: tool?.descriptor,
      tool,
    }, entries.length));
  }

  const seen = new Set();
  for (const entry of entries) {
    if (seen.has(entry.name)) {
      throw new Error(`Duplicate static registry tool: ${entry.name}`);
    }
    seen.add(entry.name);
  }

  const frozenEntries = Object.freeze(entries.slice());
  const nameToEntry = new Map(frozenEntries.map((entry) => [entry.name, entry]));

  return Object.freeze({
    kind: "static_tool_registry",
    version: "stage8-static-registry-v1",
    metadata: Object.freeze({ ...metadata }),

    entries() {
      return frozenEntries.slice();
    },

    names() {
      return frozenEntries.map((entry) => entry.name);
    },

    descriptors({ clone = false } = {}) {
      return frozenEntries.map((entry) => clone ? cloneDescriptor(entry.descriptor) : entry.descriptor);
    },

    optionalTools() {
      return frozenEntries.filter((entry) => entry.source === "optional" && entry.tool).map((entry) => entry.tool);
    },

    get(name) {
      return nameToEntry.get(name) || null;
    },

    getDescriptor(name) {
      return nameToEntry.get(name)?.descriptor || null;
    },

    getTool(name) {
      return nameToEntry.get(name)?.tool || null;
    },

    snapshot() {
      const names = frozenEntries.map((entry) => entry.name);
      return {
        schema_version: "stage8-static-registry-snapshot-v1",
        kind: "static_tool_registry",
        version: "stage8-static-registry-v1",
        tool_count: names.length,
        core_tool_count: frozenEntries.filter((entry) => entry.source === "core").length,
        optional_tool_count: frozenEntries.filter((entry) => entry.source === "optional").length,
        names,
      };
    },
  });
}

module.exports = {
  createStaticToolRegistry,
};
