"use strict";

function createRequestAbortSignal({ req, auditLog = () => {}, requestId } = {}) {
  const controller = new AbortController();

  function abort(reason) {
    if (controller.signal.aborted) return;
    controller.abort(reason);
    auditLog("request_cancelled_by_client", {
      request_id: requestId,
      reason,
    });
  }

  if (req && typeof req.on === "function") {
    req.on("aborted", () => abort("request_aborted"));
    req.on("close", () => {
      if (req.aborted === true) abort("request_closed_after_abort");
    });
  }

  return controller.signal;
}

module.exports = {
  createRequestAbortSignal,
};
