#!/usr/bin/env node
"use strict";

const path = require("node:path");
const cp = require("node:child_process");
const { CliArgumentError, parseCliArgs } = require("./cli_args");

const MARKER = "wait_for_client_entry_path";
const Repo = path.resolve(__dirname, "..", "..");
const ReportScript = path.join(__dirname, "client_entry_path_report.js");

function clampInteger(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

function isoAtOrAfter(value, threshold) {
  const left = String(value || "").trim();
  const right = String(threshold || "").trim();
  if (!left || !right) return false;
  return left >= right;
}

function buildReportArgs({ auditLogPath, clientName, evidenceScope, maxAgeDays, limit }) {
  const args = [ReportScript];
  if (auditLogPath) args.push(`--audit-log=${auditLogPath}`);
  if (clientName) args.push(`--client-name=${clientName}`);
  if (evidenceScope) args.push(`--evidence-scope=${evidenceScope}`);
  if (maxAgeDays !== null && maxAgeDays !== undefined && maxAgeDays !== "") args.push(`--max-age-days=${maxAgeDays}`);
  if (limit) args.push(`--limit=${limit}`);
  return args;
}

function runReport(args, env) {
  const stdout = cp.execFileSync(process.execPath, args, {
    cwd: Repo,
    env,
    encoding: "utf8",
  });
  return JSON.parse(stdout);
}

function selectMatchingClient(report, clientName, clientVersion) {
  const items = Array.isArray(report?.latest_matching_clients_any_window)
    ? report.latest_matching_clients_any_window
    : [];
  return items.find((item) => {
    if (clientName && item.client_name !== clientName) return false;
    if (clientVersion && item.client_version !== clientVersion) return false;
    return true;
  }) || null;
}

function freshEntryForClient(item, startedAt) {
  if (!item) return null;
  if (isoAtOrAfter(item.latest_server_discover_ts, startedAt)) {
    return {
      entry_path: "server_discover",
      observed_ts: item.latest_server_discover_ts,
      status: item.status || "server_discover_only",
    };
  }
  if (isoAtOrAfter(item.latest_initialize_ts, startedAt)) {
    return {
      entry_path: "initialize",
      observed_ts: item.latest_initialize_ts,
      status: item.status || "initialize_only",
    };
  }
  return null;
}

function fail(code, error, extra = {}) {
  console.error(JSON.stringify({ success: false, marker: MARKER, error, ...extra }, null, 2));
  process.exit(code);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2), {
    valueOptions: ["audit-log", "client-name", "client-version", "evidence-scope", "max-age-days", "timeout-ms", "poll-ms", "limit"],
  });
  const auditLogPath = args.value("audit-log", process.env.MCP_TEST_AUDIT_LOG || "");
  const clientName = args.value("client-name", "");
  const clientVersion = args.value("client-version", "");
  const evidenceScope = args.value("evidence-scope", "operational");
  const maxAgeDaysRaw = args.value("max-age-days", "");
  const maxAgeDays = maxAgeDaysRaw === "" ? "" : clampInteger(maxAgeDaysRaw, "", 0, 3650);
  const timeoutMs = clampInteger(args.value("timeout-ms", "30000"), 30000, 100, 900000);
  const pollMs = clampInteger(args.value("poll-ms", "1000"), 1000, 50, 60000);
  const limit = clampInteger(args.value("limit", "10"), 10, 1, 50);
  const startedAt = new Date().toISOString();

  if (!clientName) {
    fail(2, "Missing required --client-name option.");
  }

  const env = {
    ...process.env,
    ...(auditLogPath ? { MCP_TEST_AUDIT_LOG: auditLogPath } : {}),
  };
  const reportArgs = buildReportArgs({ auditLogPath, clientName, evidenceScope, maxAgeDays, limit });
  const deadline = Date.now() + timeoutMs;
  let attempts = 0;
  let lastReport = null;

  while (Date.now() <= deadline) {
    attempts += 1;
    lastReport = runReport(reportArgs, env);
    const matchingClient = selectMatchingClient(lastReport, clientName, clientVersion);
    const freshEntry = freshEntryForClient(matchingClient, startedAt);
    if (matchingClient && freshEntry) {
      console.log(JSON.stringify({
        success: true,
        marker: MARKER,
        mode: "wait-for-client-entry-path",
        started_at: startedAt,
        attempts,
        observed_entry: freshEntry,
        matching_client: matchingClient,
        report: lastReport,
      }, null, 2));
      return;
    }
    await wait(pollMs);
  }

  console.log(JSON.stringify({
    success: false,
    marker: MARKER,
    mode: "wait-for-client-entry-path",
    status: "timeout",
    started_at: startedAt,
    attempts,
    timeout_ms: timeoutMs,
    poll_ms: pollMs,
    client_name: clientName,
    client_version: clientVersion || null,
    evidence_scope: evidenceScope,
    max_age_days: maxAgeDays === "" ? null : maxAgeDays,
    last_report: lastReport,
  }, null, 2));
  process.exit(3);
}

main().catch((error) => {
  fail(error instanceof CliArgumentError ? 2 : 1, error && error.message ? error.message : String(error), {
    error_code: error instanceof CliArgumentError ? error.code : "unexpected_error",
    argument: error instanceof CliArgumentError ? error.argument : null,
  });
});
