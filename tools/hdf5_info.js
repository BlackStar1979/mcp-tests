"use strict";

const {
  HDF5_INFO_INPUT_SCHEMA,
  HDF5_INFO_OUTPUT_SCHEMA,
  SCIENCE_READ_ONLY_ANNOTATIONS,
} = require("../src/schemas/science_tools");
const { inspectHdf5, summarizeSciencePath } = require("../src/util/science_tools");

const TOOL_NAME = "hdf5_info";

const hdf5InfoTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Inspect HDF5 file structure",
    description: "Read-only HDF5 introspection inside configured workspace roots with bounded item and attribute limits.",
    inputSchema: HDF5_INFO_INPUT_SCHEMA,
    outputSchema: HDF5_INFO_OUTPUT_SCHEMA,
    annotations: SCIENCE_READ_ONLY_ANNOTATIONS,
  },
  async execute(args = {}) {
    try {
      return {
        success: true,
        error: "",
        ...(await inspectHdf5(args.path, {
          max_items: args.max_items,
          include_attrs: args.include_attrs,
          max_attrs: args.max_attrs,
        })),
      };
    } catch (error) {
      return {
        success: false,
        path: String(args.path || ""),
        root_alias: "",
        returned_items: 0,
        truncated: false,
        items: [],
        error: error?.message || String(error),
      };
    }
  },
  summarizeArgs: summarizeSciencePath,
  resultStats(payload = {}) {
    return {
      result_count: Number(payload.returned_items || 0),
      result_chars: JSON.stringify(payload || {}).length,
    };
  },
};

module.exports = {
  hdf5InfoTool,
};
