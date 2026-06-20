"use strict";

function assertRejectedRelativePath(normalizeRelativePath, input, expectedMessagePart, allowedMessage) {
  try {
    normalizeRelativePath(input, { allowEmpty: false });
    throw new Error(allowedMessage);
  } catch (error) {
    if (!String(error.message || "").includes(expectedMessagePart)) {
      throw error;
    }
  }
}

function assertPublicFsPolicySelfTest(fsTools, normalizeRelativePath) {
  if (fsTools.length <= 0) {
    return;
  }

  const expectedFsTools = [
    "fs_get_public_info",
    "fs_list_public",
    "fs_read_public_chunk",
    "fs_read_public_lines",
    "fs_read_public_text",
  ].sort();
  const actualFsTools = fsTools.map((tool) => tool.name).sort();

  for (const name of expectedFsTools) {
    if (!actualFsTools.includes(name)) {
      throw new Error(`missing FS tool: ${name}`);
    }
  }

  assertRejectedRelativePath(
    normalizeRelativePath,
    "../server.js",
    "traversal",
    "FS path policy allowed traversal"
  );
  assertRejectedRelativePath(
    normalizeRelativePath,
    "C:/Work/mcp-tests/server.js",
    "Drive-letter",
    "FS path policy allowed drive-letter path"
  );
  assertRejectedRelativePath(
    normalizeRelativePath,
    "_backups/server.js",
    "underscore",
    "FS path policy allowed underscore segment"
  );
}

module.exports = {
  assertPublicFsPolicySelfTest,
};
