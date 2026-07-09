"use strict";

const SCIENCE_READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const SCIENCE_PATH = {
  type: "string",
  minLength: 1,
  maxLength: 1000,
  description: "Path inside configured workspace roots. Bare paths resolve under the primary work root; @alias/... selects an explicit extra root.",
};

const SCIENCE_GROUP_ENTRY = {
  type: "object",
  additionalProperties: false,
  required: ["count", "bytes", "human_bytes"],
  properties: {
    count: { type: "integer", minimum: 0 },
    bytes: { type: "integer", minimum: 0 },
    human_bytes: { type: "string" },
  },
};

const SCIENCE_LARGEST_ENTRY = {
  type: "object",
  additionalProperties: false,
  required: ["path", "bytes", "human_bytes", "extension", "kind", "modified"],
  properties: {
    path: { type: "string" },
    bytes: { type: "integer", minimum: 0 },
    human_bytes: { type: "string" },
    extension: { type: "string" },
    kind: { type: "string" },
    modified: { type: "string" },
  },
};

const SCIENCE_TABLE_VALUE = {
  anyOf: [
    { type: "string" },
    { type: "number" },
    { type: "integer" },
    { type: "boolean" },
    { type: "null" },
  ],
};

const FITS_INFO_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["path"],
  properties: {
    path: SCIENCE_PATH,
    max_header_cards: { type: "integer", minimum: 0, maximum: 300, default: 80 },
    max_columns: { type: "integer", minimum: 0, maximum: 500, default: 120 },
  },
};

const FITS_INFO_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["success", "path", "root_alias", "hdu_count", "hdus", "error"],
  properties: {
    success: { type: "boolean" },
    path: { type: "string" },
    root_alias: { type: "string" },
    hdu_count: { type: "integer", minimum: 0 },
    hdus: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["index", "type", "shape", "dtype", "header", "columns"],
        properties: {
          index: { type: "integer", minimum: 0 },
          type: { type: "string" },
          shape: {
            anyOf: [
              { type: "null" },
              { type: "array", items: { type: "integer" } },
            ],
          },
          dtype: { anyOf: [{ type: "string" }, { type: "null" }] },
          header: {
            type: "object",
            additionalProperties: { type: "string" },
          },
          columns: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["name", "format", "unit"],
              properties: {
                name: { type: "string" },
                format: { anyOf: [{ type: "string" }, { type: "null" }] },
                unit: { anyOf: [{ type: "string" }, { type: "null" }] },
              },
            },
          },
        },
      },
    },
    error: { type: "string" },
  },
};

const HDF5_INFO_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["path"],
  properties: {
    path: SCIENCE_PATH,
    max_items: { type: "integer", minimum: 1, maximum: 5000, default: 500 },
    include_attrs: { type: "boolean", default: true },
    max_attrs: { type: "integer", minimum: 0, maximum: 100, default: 20 },
  },
};

const HDF5_INFO_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["success", "path", "root_alias", "returned_items", "truncated", "items", "error"],
  properties: {
    success: { type: "boolean" },
    path: { type: "string" },
    root_alias: { type: "string" },
    returned_items: { type: "integer", minimum: 0 },
    truncated: { type: "boolean" },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["path", "type", "shape", "dtype", "chunks", "compression", "attrs"],
        properties: {
          path: { type: "string" },
          type: { type: "string" },
          shape: {
            anyOf: [
              { type: "null" },
              { type: "array", items: { type: "integer" } },
            ],
          },
          dtype: { anyOf: [{ type: "string" }, { type: "null" }] },
          chunks: {
            anyOf: [
              { type: "null" },
              { type: "array", items: { type: "integer" } },
            ],
          },
          compression: { anyOf: [{ type: "string" }, { type: "null" }] },
          attrs: {
            type: "object",
            additionalProperties: { type: "string" },
          },
        },
      },
    },
    error: { type: "string" },
  },
};

const TABLE_PROFILE_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["path"],
  properties: {
    path: SCIENCE_PATH,
    max_lines: { type: "integer", minimum: 10, maximum: 200000, default: 10000 },
    sample_rows: { type: "integer", minimum: 1, maximum: 100, default: 20 },
  },
};

const TABLE_PROFILE_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["success", "path", "root_alias", "lines_read", "delimiter", "columns", "sample_rows", "error"],
  properties: {
    success: { type: "boolean" },
    path: { type: "string" },
    root_alias: { type: "string" },
    lines_read: { type: "integer", minimum: 0 },
    delimiter: { type: "string" },
    columns: { type: "array", items: { type: "string" } },
    sample_rows: {
      type: "array",
      items: {
        type: "array",
        items: SCIENCE_TABLE_VALUE,
      },
    },
    error: { type: "string" },
  },
};

const INVENTORY_TREE_INPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["path"],
  properties: {
    path: SCIENCE_PATH,
    max_depth: { type: "integer", minimum: 0, maximum: 30, default: 20 },
    top_n_largest: { type: "integer", minimum: 1, maximum: 200, default: 50 },
    group_depth: { type: "integer", minimum: 1, maximum: 10, default: 4 },
    max_files: { type: "integer", minimum: 1, maximum: 100000, default: 20000 },
  },
};

const INVENTORY_TREE_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "success",
    "path",
    "root_alias",
    "files",
    "directories",
    "total_bytes",
    "human_total_bytes",
    "truncated",
    "max_files",
    "by_extension",
    "by_kind",
    "by_directory",
    "largest",
    "error",
  ],
  properties: {
    success: { type: "boolean" },
    path: { type: "string" },
    root_alias: { type: "string" },
    files: { type: "integer", minimum: 0 },
    directories: { type: "integer", minimum: 0 },
    total_bytes: { type: "integer", minimum: 0 },
    human_total_bytes: { type: "string" },
    truncated: { type: "boolean" },
    max_files: { type: "integer", minimum: 1 },
    by_extension: {
      type: "object",
      additionalProperties: SCIENCE_GROUP_ENTRY,
    },
    by_kind: {
      type: "object",
      additionalProperties: SCIENCE_GROUP_ENTRY,
    },
    by_directory: {
      type: "object",
      additionalProperties: SCIENCE_GROUP_ENTRY,
    },
    largest: {
      type: "array",
      items: SCIENCE_LARGEST_ENTRY,
    },
    error: { type: "string" },
  },
};

module.exports = {
  FITS_INFO_INPUT_SCHEMA,
  FITS_INFO_OUTPUT_SCHEMA,
  HDF5_INFO_INPUT_SCHEMA,
  HDF5_INFO_OUTPUT_SCHEMA,
  INVENTORY_TREE_INPUT_SCHEMA,
  INVENTORY_TREE_OUTPUT_SCHEMA,
  SCIENCE_READ_ONLY_ANNOTATIONS,
  TABLE_PROFILE_INPUT_SCHEMA,
  TABLE_PROFILE_OUTPUT_SCHEMA,
};
