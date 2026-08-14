"use strict";

function processJobOwnerRequired() {
  const error = new Error("Authenticated process job owner is required.");
  error.code = "process_job_owner_required";
  return error;
}

function resolveProcessJobOwner(context = {}) {
  const owner = String(
    context.authResult?.clientId
      || context.authResult?.client_id
      || ""
  ).trim();
  if (!owner) throw processJobOwnerRequired();
  return owner;
}

module.exports = {
  processJobOwnerRequired,
  resolveProcessJobOwner,
};
