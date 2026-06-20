function typeOfValue(value) {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  if (Number.isInteger(value)) return "integer";
  return typeof value;
}

function schemaTypes(schema) {
  if (!schema || typeof schema !== "object") return [];
  if (Array.isArray(schema.type)) return schema.type;
  if (typeof schema.type === "string") return [schema.type];
  return [];
}

function typeMatches(value, schema) {
  const types = schemaTypes(schema);
  if (!types.length) return true;
  const actual = typeOfValue(value);
  return types.some((type) => {
    if (type === "number") return actual === "number" || actual === "integer";
    if (type === "integer") return actual === "integer";
    return actual === type;
  });
}

function addIssue(issues, path, message, detail = {}) {
  issues.push({ path, message, ...detail });
}

function validateAgainstSchema(value, schema, path = "$", options = {}) {
  const issues = [];
  const maxDepth = Number.isInteger(options.maxDepth) ? options.maxDepth : 8;

  function visit(current, currentSchema, currentPath, depth) {
    if (!currentSchema || typeof currentSchema !== "object") return;
    if (!typeMatches(current, currentSchema)) {
      addIssue(issues, currentPath, "type mismatch", {
        expected: schemaTypes(currentSchema),
        actual: typeOfValue(current),
      });
      return;
    }

    if (depth >= maxDepth) return;

    const types = schemaTypes(currentSchema);
    const objectLike = types.includes("object") || currentSchema.properties || currentSchema.required;
    if (objectLike && current && typeof current === "object" && !Array.isArray(current)) {
      const props = currentSchema.properties && typeof currentSchema.properties === "object" ? currentSchema.properties : {};
      const required = Array.isArray(currentSchema.required) ? currentSchema.required : [];

      for (const key of required) {
        if (!Object.prototype.hasOwnProperty.call(current, key)) {
          addIssue(issues, `${currentPath}.${key}`, "required property missing");
        }
      }

      if (currentSchema.additionalProperties === false) {
        for (const key of Object.keys(current)) {
          if (!Object.prototype.hasOwnProperty.call(props, key)) {
            addIssue(issues, `${currentPath}.${key}`, "additional property not declared");
          }
        }
      }

      for (const [key, childSchema] of Object.entries(props)) {
        if (Object.prototype.hasOwnProperty.call(current, key)) {
          visit(current[key], childSchema, `${currentPath}.${key}`, depth + 1);
        }
      }
      return;
    }

    const arrayLike = types.includes("array") || currentSchema.items;
    if (arrayLike && Array.isArray(current) && currentSchema.items && typeof currentSchema.items === "object") {
      const limit = Math.min(current.length, Number.isInteger(options.maxArrayItems) ? options.maxArrayItems : 200);
      for (let i = 0; i < limit; i += 1) {
        visit(current[i], currentSchema.items, `${currentPath}[${i}]`, depth + 1);
      }
    }
  }

  visit(value, schema, path, 0);
  return {
    success: issues.length === 0,
    issue_count: issues.length,
    issues,
  };
}

function assertMatchesSchema(value, schema, label = "payload", options = {}) {
  const result = validateAgainstSchema(value, schema, "$", options);
  if (!result.success) {
    const first = result.issues[0];
    throw new Error(`${label} does not match output schema: ${first.path} ${first.message}`);
  }
  return result;
}

module.exports = {
  assertMatchesSchema,
  validateAgainstSchema,
};
