"use strict";

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function typeMatches(value, expected) {
  if (expected === "array") return Array.isArray(value);
  if (expected === "integer") return Number.isInteger(value);
  if (expected === "number") return typeof value === "number" && Number.isFinite(value);
  if (expected === "object") return isObject(value);
  return typeof value === expected;
}

function validateString(value, schema, path, errors) {
  if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${path} shorter than minLength`);
  if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(`${path} longer than maxLength`);
  if (schema.pattern) {
    try {
      if (!new RegExp(schema.pattern).test(value)) errors.push(`${path} does not match pattern`);
    } catch {
      errors.push(`${path} has invalid schema pattern`);
    }
  }
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) errors.push(`${path} not in enum`);
}

function validateNumber(value, schema, path, errors) {
  if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${path} below minimum`);
  if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${path} above maximum`);
}

const DEFAULT_VALIDATION_LIMITS = {
  maxDepth: 12,
  maxArrayItems: 100,
  maxObjectKeys: 100,
  maxStringLength: 10000,
};

function checkValueBudget(value, path, errors, depth, limits) {
  if (depth > limits.maxDepth) {
    errors.push(`${path} exceeds max depth`);
    return false;
  }
  if (typeof value === "string" && value.length > limits.maxStringLength) {
    errors.push(`${path} exceeds max string length`);
    return false;
  }
  if (Array.isArray(value) && value.length > limits.maxArrayItems) {
    errors.push(`${path} exceeds max array items`);
    return false;
  }
  if (isObject(value) && Object.keys(value).length > limits.maxObjectKeys) {
    errors.push(`${path} exceeds max object keys`);
    return false;
  }
  return true;
}

function validateValue(value, schema, path, errors, depth = 0, limits = DEFAULT_VALIDATION_LIMITS) {
  if (!checkValueBudget(value, path, errors, depth, limits)) return;
  if (!schema || typeof schema !== "object") return;
  if (schema.anyOf || schema.oneOf) {
    const variants = schema.anyOf || schema.oneOf;
    const matched = variants.some((variant) => {
      const local = [];
      validateValue(value, variant, path, local, depth + 1, limits);
      return local.length === 0;
    });
    if (!matched) errors.push(`${path} does not match any allowed schema`);
    return;
  }
  if (schema.type && !typeMatches(value, schema.type)) {
    errors.push(`${path} must be ${schema.type}`);
    return;
  }
  if (schema.type === "string") validateString(value, schema, path, errors);
  if (schema.type === "number" || schema.type === "integer") validateNumber(value, schema, path, errors);
  if (schema.type === "array" && schema.items && Array.isArray(value)) {
    value.forEach((item, index) => validateValue(item, schema.items, `${path}[${index}]`, errors, depth + 1, limits));
  }
  if (schema.type === "object" && isObject(value)) {
    validateObjectAgainstSchema(value, schema, path, errors, depth + 1, limits);
  }
}

function validateObjectAgainstSchema(args, schema, path, errors, depth = 0, limits = DEFAULT_VALIDATION_LIMITS) {
  if (!checkValueBudget(args, path, errors, depth, limits)) return;
  const properties = isObject(schema.properties) ? schema.properties : {};
  const required = Array.isArray(schema.required) ? schema.required : [];
  for (const key of required) {
    if (!Object.prototype.hasOwnProperty.call(args, key)) errors.push(`${path}.${key} is required`);
  }
  if (schema.additionalProperties === false) {
    for (const key of Object.keys(args)) {
      if (!Object.prototype.hasOwnProperty.call(properties, key)) errors.push(`${path}.${key} is not allowed`);
    }
  }
  for (const [key, child] of Object.entries(properties)) {
    if (Object.prototype.hasOwnProperty.call(args, key)) validateValue(args[key], child, `${path}.${key}`, errors, depth + 1, limits);
  }
}

function validateToolInput(toolName, args, inputSchema, limits = DEFAULT_VALIDATION_LIMITS) {
  const errors = [];
  if (!isObject(inputSchema) || inputSchema.type !== "object") {
    return { ok: false, errors: [`${toolName} inputSchema is not an object schema`] };
  }
  if (!isObject(args)) {
    return { ok: false, errors: [`${toolName} arguments must be an object`] };
  }
  validateObjectAgainstSchema(args, inputSchema, "arguments", errors, 0, limits);
  return { ok: errors.length === 0, errors };
}

module.exports = { DEFAULT_VALIDATION_LIMITS, validateToolInput };
