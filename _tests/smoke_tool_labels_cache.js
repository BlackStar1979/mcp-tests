"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { buildPluginLabelsSync } = require("../src/tool_labels");

const originalExistsSync = fs.existsSync;
const originalReaddirSync = fs.readdirSync;
const originalStatSync = fs.statSync;
const originalReadFileSync = fs.readFileSync;

let statVersion = 1;
let readCount = 0;

try {
  fs.existsSync = (targetPath) => {
    if (String(targetPath).endsWith(path.join("alpha", "plugin.manifest.json"))) return true;
    return originalExistsSync(targetPath);
  };
  fs.readdirSync = (targetPath, options) => {
    if (String(targetPath).endsWith(path.join("mcp-tests", "plugins"))) {
      return [{
        name: "alpha",
        isDirectory: () => true,
      }];
    }
    return originalReaddirSync(targetPath, options);
  };
  fs.statSync = (targetPath, options) => {
    if (String(targetPath).endsWith(path.join("alpha", "plugin.manifest.json"))) {
      return {
        mtimeMs: statVersion,
        size: 123,
      };
    }
    return originalStatSync(targetPath, options);
  };
  fs.readFileSync = (targetPath, options) => {
    if (String(targetPath).endsWith(path.join("alpha", "plugin.manifest.json"))) {
      readCount += 1;
      return JSON.stringify({
        plugin_id: "alpha-plugin",
        status: "candidate",
        tools: [
          {
            name: "alpha_tool",
            title: "Alpha Tool",
            permissions: { write: false },
          },
        ],
      });
    }
    return originalReadFileSync(targetPath, options);
  };

  const first = buildPluginLabelsSync();
  const second = buildPluginLabelsSync();
  assert.equal(readCount, 1);
  assert.deepEqual(second, first);
  assert.notStrictEqual(second, first);

  statVersion += 1;
  const third = buildPluginLabelsSync();
  assert.equal(readCount, 2);
  assert.deepEqual(third, first);

  console.log("smoke_tool_labels_cache ok");
} finally {
  fs.existsSync = originalExistsSync;
  fs.readdirSync = originalReaddirSync;
  fs.statSync = originalStatSync;
  fs.readFileSync = originalReadFileSync;
}
