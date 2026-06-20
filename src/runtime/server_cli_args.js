"use strict";

function parseServerCliArgs(argv = []) {
  const args = Array.from(argv || []).map((arg) => String(arg));
  const parsed = {
    bootstrapArgv: [],
    serverProfileName: "public",
  };

  function takeNext(index, name) {
    const next = args[index + 1];
    if (next === undefined || String(next).startsWith("--")) {
      throw new Error(`Missing value for ${name}`);
    }
    return { value: String(next), nextIndex: index + 1 };
  }

  function setServerProfile(value) {
    const name = String(value || "").trim().toLowerCase();
    if (!/^[a-z0-9_-]+$/.test(name)) {
      throw new Error(`Invalid --profile value: ${name}`);
    }
    parsed.serverProfileName = name;
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--profile") {
      const next = takeNext(index, "--profile");
      setServerProfile(next.value);
      index = next.nextIndex;
      continue;
    }

    if (arg.startsWith("--profile=")) {
      setServerProfile(arg.slice("--profile=".length));
      continue;
    }

    if (arg === "--enable-memory-tools" || arg === "--memory-tools" || arg === "--disable-memory-tools" || arg === "--no-memory-tools" || arg.startsWith("--memory-tools=")) {
      throw new Error("Memory tools are selected by server profile, not by a standalone CLI flag. Use --profile tests for the full test surface.");
    }

    parsed.bootstrapArgv.push(arg);
  }

  return parsed;
}

module.exports = { parseServerCliArgs };
