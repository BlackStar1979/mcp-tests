"use strict";

const { formatStartupReport } = require("../startup_report");

function buildStartupReport({
  serverName,
  serverVersion,
  connectorShapeVersion,
  outputMode,
  startupReportVersion,
  labelsVersion,
  host,
  port,
  publicBaseUrl,
  maxFetchTextChars,
  auditLogPath,
  tools,
}) {
  return {
    serverName,
    serverVersion,
    connectorShapeVersion,
    outputMode,
    startupReportVersion,
    labelsVersion,
    host,
    port,
    publicBaseUrl,
    maxFetchTextChars,
    auditLogPath,
    tools,
  };
}

function printStartupReport(report, logger = console.log) {
  for (const line of formatStartupReport(report)) {
    logger(line);
  }
}

module.exports = {
  buildStartupReport,
  printStartupReport,
};
