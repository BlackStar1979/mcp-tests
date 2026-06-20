"use strict";

function toolResult(outputMode, payload) {
  const result = {
    content: [
      {
        type: "text",
        text: JSON.stringify(payload),
      },
    ],
  };

  if (outputMode === "structured") {
    result.structuredContent = payload;
  }

  return result;
}

module.exports = {
  toolResult,
};
