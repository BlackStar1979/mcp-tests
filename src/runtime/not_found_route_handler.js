"use strict";

function handleNotFoundRoute({ res, jsonResponse }) {
  return jsonResponse(res, 404, {
    error: "Not found",
  });
}

module.exports = {
  handleNotFoundRoute,
};
