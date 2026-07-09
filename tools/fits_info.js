"use strict";

const {
  FITS_INFO_INPUT_SCHEMA,
  FITS_INFO_OUTPUT_SCHEMA,
  SCIENCE_READ_ONLY_ANNOTATIONS,
} = require("../src/schemas/science_tools");
const { inspectFits, summarizeSciencePath } = require("../src/util/science_tools");

const TOOL_NAME = "fits_info";

const fitsInfoTool = {
  name: TOOL_NAME,
  descriptor: {
    name: TOOL_NAME,
    title: "Inspect FITS file structure",
    description: "Read-only FITS introspection inside configured workspace roots with bounded headers and columns.",
    inputSchema: FITS_INFO_INPUT_SCHEMA,
    outputSchema: FITS_INFO_OUTPUT_SCHEMA,
    annotations: SCIENCE_READ_ONLY_ANNOTATIONS,
  },
  async execute(args = {}) {
    try {
      return {
        success: true,
        error: "",
        ...(await inspectFits(args.path, {
          max_header_cards: args.max_header_cards,
          max_columns: args.max_columns,
        })),
      };
    } catch (error) {
      return {
        success: false,
        path: String(args.path || ""),
        root_alias: "",
        hdu_count: 0,
        hdus: [],
        error: error?.message || String(error),
      };
    }
  },
  summarizeArgs: summarizeSciencePath,
  resultStats(payload = {}) {
    return {
      result_count: Number(payload.hdu_count || 0),
      result_chars: JSON.stringify(payload || {}).length,
    };
  },
};

module.exports = {
  fitsInfoTool,
};
