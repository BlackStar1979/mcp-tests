"use strict";

class CliArgumentError extends Error {
  constructor(code, argument) {
    super(`${code}: --${argument}`);
    this.name = "CliArgumentError";
    this.code = code;
    this.argument = argument;
  }
}

function parseCliArgs(argv, {
  valueOptions = [],
  repeatableValueOptions = [],
  flagOptions = [],
  allowEmptyValueOptions = [],
} = {}) {
  const repeatableValues = new Set(repeatableValueOptions);
  const allowedValues = new Set([...valueOptions, ...repeatableValueOptions]);
  const allowedFlags = new Set(flagOptions);
  const allowedEmptyValues = new Set(allowEmptyValueOptions);
  const values = new Map();
  const flags = new Set();

  for (let index = 0; index < argv.length; index += 1) {
    const token = String(argv[index] || "");
    if (!token.startsWith("--") || token === "--") {
      throw new CliArgumentError("cli_argument_unexpected_positional", token || "<empty>");
    }

    const body = token.slice(2);
    const equalsIndex = body.indexOf("=");
    const name = equalsIndex >= 0 ? body.slice(0, equalsIndex) : body;

    if (allowedValues.has(name)) {
      if (values.has(name) && !repeatableValues.has(name)) {
        throw new CliArgumentError("cli_argument_duplicate", name);
      }
      const hasNext = index + 1 < argv.length;
      const value = equalsIndex >= 0 ? body.slice(equalsIndex + 1) : (hasNext ? String(argv[index + 1]) : "");
      if (
        (equalsIndex < 0 && (!hasNext || value.startsWith("--")))
        || (!value && !allowedEmptyValues.has(name))
      ) {
        throw new CliArgumentError("cli_argument_value_missing", name);
      }
      if (equalsIndex < 0) index += 1;
      if (repeatableValues.has(name)) {
        values.set(name, [...(values.get(name) || []), value]);
      } else {
        values.set(name, value);
      }
      continue;
    }

    if (allowedFlags.has(name)) {
      if (equalsIndex >= 0) throw new CliArgumentError("cli_argument_flag_value_not_allowed", name);
      if (flags.has(name)) throw new CliArgumentError("cli_argument_duplicate", name);
      flags.add(name);
      continue;
    }

    throw new CliArgumentError("cli_argument_unknown", name || "<empty>");
  }

  return {
    hasValue(name) {
      return values.has(name);
    },
    value(name, fallback = "") {
      if (!values.has(name)) return fallback;
      const stored = values.get(name);
      return Array.isArray(stored) ? stored.at(-1) : stored;
    },
    values(name) {
      if (!values.has(name)) return [];
      const stored = values.get(name);
      return Array.isArray(stored) ? [...stored] : [stored];
    },
    flag(name) {
      return flags.has(name);
    },
  };
}

module.exports = { CliArgumentError, parseCliArgs };
