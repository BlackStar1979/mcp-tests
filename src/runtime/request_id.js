"use strict";

function createRequestIdGenerator() {
  let requestCounter = 0;

  return function nextRequestId() {
    requestCounter += 1;
    return `${Date.now().toString(36)}-${requestCounter}`;
  };
}

module.exports = {
  createRequestIdGenerator,
};
