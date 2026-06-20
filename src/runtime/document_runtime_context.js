"use strict";

function createDocumentRuntimeContext({ docs, publicBaseUrl, maxFetchTextChars, connectorShapeVersion }) {
  return function documentRuntimeContext() {
    return {
      docs,
      publicBaseUrl,
      maxFetchTextChars,
      connectorShapeVersion,
    };
  };
}

module.exports = {
  createDocumentRuntimeContext,
};
