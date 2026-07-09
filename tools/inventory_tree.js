"use strict";

const {
  INVENTORY_TREE_INPUT_SCHEMA,
  INVENTORY_TREE_OUTPUT_SCHEMA,
  SCIENCE_READ_ONLY_ANNOTATIONS,
} = require("../src/schemas/science_tools");
const { inventoryTree, summarizeSciencePath } = require("../src/util/science_tools");

const TOOL_NAME = "inventory_tree";

const inventoryTreeTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Inventory workspace tree",
    description: "Recursively scan a directory inside configured workspace roots and aggregate extensions, science-data kinds, sizes, and largest files.",
    inputSchema: INVENTORY_TREE_INPUT_SCHEMA,
    outputSchema: INVENTORY_TREE_OUTPUT_SCHEMA,
    annotations: SCIENCE_READ_ONLY_ANNOTATIONS,
  },
  async execute(args = {}) {
    try {
      return {
        success: true,
        error: "",
        ...(await inventoryTree(args.path, args)),
      };
    } catch (error) {
      return {
        success: false,
        path: String(args.path || ""),
        root_alias: "",
        files: 0,
        directories: 0,
        total_bytes: 0,
        human_total_bytes: "0 B",
        truncated: false,
        max_files: Number(args.max_files || 20000),
        by_extension: {},
        by_kind: {},
        by_directory: {},
        largest: [],
        error: error?.message || String(error),
      };
    }
  },
  summarizeArgs: summarizeSciencePath,
  resultStats(payload = {}) {
    return {
      result_count: Number(payload.files || 0),
      result_chars: JSON.stringify(payload || {}).length,
    };
  },
};

module.exports = {
  inventoryTreeTool,
};
