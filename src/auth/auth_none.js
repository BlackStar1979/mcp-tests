function createNoneAuth() {
  return {
    mode: "none",
    enabled: false,
    requiresAuth: false,
    tokenFileConfigured: false,
    tokenLoaded: false,
    tokenLength: 0,
    tokenSha256Prefix: "",
    authenticate() {
      return {
        ok: true,
        status: 200,
        error: "",
        mode: "none",
      };
    },
    status() {
      return {
        mode: "none",
        enabled: false,
        requires_auth: false,
        token_file_configured: false,
        token_loaded: false,
        token_length: 0,
        token_sha256_prefix: "",
      };
    },
  };
}

module.exports = {
  createNoneAuth,
};
