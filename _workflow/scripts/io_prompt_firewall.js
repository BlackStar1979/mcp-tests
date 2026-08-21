"use strict";

// Compatibility adapter: runtime policy is the single owner of prompt/content rules.
const {
  INJECTION_PATTERNS,
  IO_PROMPT_FIREWALL_VERSION,
  inspectForPromptInjection,
  validatePromptFirewall,
} = require("../../src/runtime/prompt_content_policy");

module.exports = {
  IO_PROMPT_FIREWALL_VERSION,
  INJECTION_PATTERNS,
  inspectForPromptInjection,
  validatePromptFirewall,
};
