"use strict";

function maybeOutputSchema(outputMode, schema) {
  if (outputMode !== "structured") {
    return {};
  }

  return {
    outputSchema: schema,
  };
}

module.exports = {
  maybeOutputSchema,
};
