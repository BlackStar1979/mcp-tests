"use strict";

const { assertConnectorShapeSelfTest } = require("./connector_shape_selftest");

async function runConnectorShapeSelfTest(context) {
  if (!context || typeof context !== "object") {
    throw new Error("connector shape self-test context missing");
  }

  if (typeof context.toolsList !== "function") {
    throw new Error("connector shape self-test toolsList missing");
  }

  if (typeof context.documentRuntimeContext !== "function") {
    throw new Error("connector shape self-test documentRuntimeContext missing");
  }

  return assertConnectorShapeSelfTest(context);
}

module.exports = {
  runConnectorShapeSelfTest,
};
