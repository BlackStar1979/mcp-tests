"use strict";

function classifyClientFamily(clientName, clientVersion) {
  const name = String(clientName || "");
  const version = String(clientVersion || "");
  const lower = name.toLowerCase();

  if (
    lower === "codex-mcp-client"
    || lower === "openai-mcp"
    || lower === "anthropic/claudeai"
    || lower === "anthropic/toolbox"
  ) {
    return {
      client_class: "operational_known",
      evidence_weight: "high",
      rationale: "Known operational client family.",
    };
  }

  if (
    lower.includes("smoke")
    || lower.includes("probe")
    || lower.includes("test")
    || /^step\d+/i.test(name)
    || lower === "claude"
  ) {
    return {
      client_class: "synthetic_validation",
      evidence_weight: "low",
      rationale: "Synthetic, probe, smoke, or validation client family.",
    };
  }

  return {
    client_class: "unknown",
    evidence_weight: "medium",
    rationale: version ? "Unclassified client family." : "Unclassified client family with missing version context.",
  };
}

function summarizeClientFamilies(entries, currentServerStartId, clientNameFilter = "", currentOnly = true) {
  const grouped = new Map();
  for (const entry of entries || []) {
    const event = String((entry && entry.event) || "");
    if (event !== "initialize_received" && event !== "server_discover_received") continue;
    const serverStartId = String(entry.server_start_id || "");
    if (currentOnly && currentServerStartId && serverStartId !== currentServerStartId) continue;
    const clientName = String(entry.client_name || "");
    const clientVersion = String(entry.client_version || "");
    if (clientNameFilter && clientName !== clientNameFilter) continue;
    const key = `${clientName}\u0000${clientVersion}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        client_name: clientName,
        client_version: clientVersion,
        initialize_received: 0,
        server_discover_received: 0,
        latest_initialize_ts: "",
        latest_server_discover_ts: "",
        protocol_versions: new Set(),
      });
    }
    const item = grouped.get(key);
    if (entry.protocol_version) item.protocol_versions.add(String(entry.protocol_version));
    if (event === "initialize_received") {
      item.initialize_received += 1;
      item.latest_initialize_ts = String(entry.ts || item.latest_initialize_ts || "");
    } else {
      item.server_discover_received += 1;
      item.latest_server_discover_ts = String(entry.ts || item.latest_server_discover_ts || "");
    }
  }
  return [...grouped.values()]
    .map((item) => ({
      ...item,
      protocol_versions: [...item.protocol_versions].sort(),
      ...classifyClientFamily(item.client_name, item.client_version),
      status:
        item.initialize_received > 0 && item.server_discover_received > 0
          ? "mixed"
          : item.initialize_received > 0
            ? "initialize_only"
            : "server_discover_only",
    }))
    .sort((a, b) => {
      const aTs = a.latest_server_discover_ts || a.latest_initialize_ts || "";
      const bTs = b.latest_server_discover_ts || b.latest_initialize_ts || "";
      return bTs.localeCompare(aTs) || a.client_name.localeCompare(b.client_name) || a.client_version.localeCompare(b.client_version);
    });
}

function buildRetirementEvidenceSummary(diagnostics, latestMatchingClientsAnyWindow = []) {
  const operationalClients = latestMatchingClientsAnyWindow.filter((item) => item.client_class === "operational_known");
  const syntheticClients = latestMatchingClientsAnyWindow.filter((item) => item.client_class === "synthetic_validation");
  const operationalInitializeOnly = operationalClients.filter((item) => item.status === "initialize_only");
  const operationalServerDiscoverOnly = operationalClients.filter((item) => item.status === "server_discover_only");
  const operationalMixed = operationalClients.filter((item) => item.status === "mixed");
  const syntheticServerDiscoverOnly = syntheticClients.filter((item) => item.status === "server_discover_only");

  let status = "insufficient_evidence";
  let blocker = "Need clearer evidence separation between operational clients and validation traffic.";
  let nextAction = "Capture a fresh reconnect for the operational client family you actually care about and re-run this report.";

  if (diagnostics?.initialize_retirement_readiness?.status === "stale_entry_window") {
    status = "hold_stale_current_window";
    blocker = "The current runtime slice is stale for entry-path purposes.";
    nextAction = diagnostics.initialize_retirement_readiness.next_action;
  } else if (operationalInitializeOnly.length > 0 || operationalMixed.length > 0) {
    status = "blocked_by_operational_initialize_clients";
    blocker = "At least one known operational client family still uses legacy initialize in retained evidence.";
    nextAction = "Do not reopen initialize retirement. Preserve compatibility and gather fresh server/discover evidence for the same operational family.";
  } else if (operationalServerDiscoverOnly.length > 0) {
    status = "operational_server_discover_candidate";
    blocker = "Operational evidence is compatible with retirement review, but explicit authorization is still required.";
    nextAction = "Preserve the operational server/discover-only evidence, confirm useful no-handshake flow on the same runtime, and prepare an authorization-backed retirement package.";
  } else if (syntheticServerDiscoverOnly.length > 0) {
    status = "synthetic_server_discover_only";
    blocker = "Observed server/discover-only evidence comes only from synthetic validation clients.";
    nextAction = "Do not treat synthetic server/discover traffic as retirement evidence; capture a fresh reconnect from an operational client family.";
  }

  return {
    status,
    blocker,
    next_action: nextAction,
    operational_known_clients_seen: operationalClients.length,
    synthetic_validation_clients_seen: syntheticClients.length,
    operational_initialize_only_clients: operationalInitializeOnly.map((item) => `${item.client_name} ${item.client_version}`),
    operational_server_discover_only_clients: operationalServerDiscoverOnly.map((item) => `${item.client_name} ${item.client_version}`),
    operational_mixed_clients: operationalMixed.map((item) => `${item.client_name} ${item.client_version}`),
    synthetic_server_discover_only_clients: syntheticServerDiscoverOnly.map((item) => `${item.client_name} ${item.client_version}`),
  };
}

module.exports = {
  classifyClientFamily,
  summarizeClientFamilies,
  buildRetirementEvidenceSummary,
};
