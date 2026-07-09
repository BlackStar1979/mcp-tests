"use strict";

const {
  SCIENCE_READ_ONLY_ANNOTATIONS,
  TABLE_PROFILE_INPUT_SCHEMA,
  TABLE_PROFILE_OUTPUT_SCHEMA,
} = require("../src/schemas/science_tools");
const { profileTable, summarizeSciencePath } = require("../src/util/science_tools");

const TOOL_NAME = "table_profile";

const tableProfileTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Profile tabular text file",
    description: "Read-only CSV/TSV/text-table profiling inside configured workspace roots with bounded line and sample limits.",
    inputSchema: TABLE_PROFILE_INPUT_SCHEMA,
    outputSchema: TABLE_PROFILE_OUTPUT_SCHEMA,
    annotations: SCIENCE_READ_ONLY_ANNOTATIONS,
  },
  async execute(args = {}) {
    try {
      return {
        success: true,
        error: "",
        ...(await profileTable(args.path, {
          max_lines: args.max_lines,
          sample_rows: args.sample_rows,
        })),
      };
    } catch (error) {
      return {
        success: false,
        path: String(args.path || ""),
        root_alias: "",
        lines_read: 0,
        delimiter: "",
        columns: [],
        sample_rows: [],
        error: error?.message || String(error),
      };
    }
  },
  summarizeArgs: summarizeSciencePath,
  resultStats(payload = {}) {
    return {
      result_count: Number(payload.lines_read || 0),
      result_chars: JSON.stringify(payload || {}).length,
    };
  },
};

module.exports = {
  tableProfileTool,
};
