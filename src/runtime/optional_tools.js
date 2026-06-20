"use strict";

function createOptionalToolLookup(optionalTools) {
  const tools = Array.isArray(optionalTools) ? optionalTools : [];

  return function getOptionalTool(name) {
    return tools.find((tool) => tool.name === name) || null;
  };
}

module.exports = {
  createOptionalToolLookup,
};
