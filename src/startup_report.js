const { buildToolLabelsSync } = require("./tool_labels");

function colorize(text, status, useColor) {
  if (!useColor) return text;
  if (status === "enabled" || status === "active") return `\u001b[32m${text}\u001b[0m`;
  if (status === "disabled" || status === "inactive" || status === "invalid" || status === "error") return `\u001b[31m${text}\u001b[0m`;
  if (status === "candidate" || status === "quarantined") return `\u001b[33m${text}\u001b[0m`;
  return text;
}

function formatLabel(label, useColor) {
  const statusText = colorize(`[${label.status}]`, label.status, useColor);
  const suffix = label.plugin_id ? ` (${label.plugin_id})` : "";
  return `  ${statusText} ${label.name}${suffix}`;
}

function formatStartupReport(context) {
  const {
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
    pluginLabels,
    useColor = Boolean(process.stdout && process.stdout.isTTY),
  } = context;

  const labels = buildToolLabelsSync(tools || []);
  if (Array.isArray(pluginLabels)) labels.plugins = pluginLabels;

  const lines = [];
  lines.push(`${serverName} v${serverVersion}`);
  lines.push(`Local:  http://${host}:${port}/mcp`);
  lines.push(`Health: http://${host}:${port}/healthz`);
  lines.push(`Public: ${publicBaseUrl}/mcp`);
  lines.push(`connectorShapeVersion=${connectorShapeVersion}`);
  lines.push(`outputMode=${outputMode}`);
  lines.push(`startupReportVersion=${startupReportVersion}`);
  lines.push(`labelsVersion=${labelsVersion}`);
  lines.push(`fetchTextCapChars=${maxFetchTextChars}`);
  lines.push(`auditLog=${auditLogPath}`);
  lines.push("Public MCP tools:");
  for (const label of labels.public) lines.push(formatLabel(label, useColor));
  lines.push("Authorized MCP tools:");
  for (const label of labels.internal) lines.push(formatLabel(label, useColor));
  lines.push("Plugins:");
  if (labels.plugins.length === 0) {
    lines.push(`  ${colorize("[inactive]", "inactive", useColor)} (none)`);
  } else {
    for (const label of labels.plugins) lines.push(formatLabel(label, useColor));
  }
  return lines;
}

module.exports = {
  colorize,
  formatStartupReport,
};
