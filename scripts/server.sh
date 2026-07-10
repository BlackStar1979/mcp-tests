#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

check_existing_server() {
  local port="$1"
  local profile_name="$2"
  local auth_mode="$3"
  if [[ -z "$port" ]]; then
    return 1
  fi
  local health_json=""
  health_json="$(curl -fsS --max-time 2 "http://127.0.0.1:${port}/healthz" 2>/dev/null || true)"
  if [[ -z "$health_json" ]]; then
    return 1
  fi
  node -e '
const data = JSON.parse(process.argv[1]);
const profileName = process.argv[2];
const authMode = process.argv[3];
const expectedProfile = profileName === "tests" ? "internal" : profileName;
const ok = data
  && data.status === "ok"
  && data.server === "mcp-tests-response-shape"
  && data.auth
  && data.auth.mode === authMode
  && data.profile === expectedProfile;
if (!ok) process.exit(1);
console.log(JSON.stringify({
  ok: true,
  auth: data.auth.mode,
  profile: data.profile,
  tools: data.tools_count
}));
' "$health_json" "$profile_name" "$auth_mode"
}

PROFILE="${MCP_SUPERVISOR_PROFILE:-public}"
AUTH="${MCP_SUPERVISOR_AUTH:-none}"
PORT="${MCP_SUPERVISOR_PORT:-}"
TOKEN_FILE="${MCP_SUPERVISOR_TOKEN_FILE:-}"
OAUTH_SECRET_FILE="${MCP_SUPERVISOR_OAUTH_SECRET_FILE:-}"
RESTART_CODES="${MCP_SUPERVISOR_RESTART_CODES:-42 43 44}"
DELAY_SECONDS="${MCP_SUPERVISOR_RESTART_DELAY_SECONDS:-1}"
RESTART_TRIGGER="${MCP_TEST_ENABLE_RESTART_TRIGGER:-1}"
TRIGGER_FILE="${MCP_TEST_RESTART_TRIGGER_FILE:-$ROOT_DIR/_control/restart-request.json}"
FORWARD_ARGS=()

while [[ $# -gt 0 ]]; do
  key="$1"
  value=""
  case "$key" in
    --*=*) value="${key#*=}"; key="${key%%=*}" ;;
    --*) if [[ $# -gt 1 && "$2" != --* ]]; then value="$2"; shift; else value="1"; fi ;;
  esac
  case "$key" in
    --profile) PROFILE="$value" ;;
    --auth) AUTH="$value" ;;
    --port) PORT="$value" ;;
    --token-file) TOKEN_FILE="$value" ;;
    --oauth-secret-file) OAUTH_SECRET_FILE="$value" ;;
    --restart-trigger) RESTART_TRIGGER="$value" ;;
    --trigger-file) TRIGGER_FILE="$value" ;;
    --restart-codes) RESTART_CODES="$value" ;;
    --restart-delay-seconds) DELAY_SECONDS="$value" ;;
    *) FORWARD_ARGS+=("$1"); if [[ -n "$value" && "$value" != "1" ]]; then FORWARD_ARGS+=("$value"); fi ;;
  esac
  shift
done

export MCP_TEST_ENABLE_RESTART_TRIGGER="$RESTART_TRIGGER"
export MCP_TEST_RESTART_TRIGGER_FILE="$TRIGGER_FILE"
mkdir -p "$(dirname "$MCP_TEST_RESTART_TRIGGER_FILE")"

ARGS=(server.js --profile "$PROFILE" --auth "$AUTH")
if [[ -n "$PORT" ]]; then ARGS+=(--port "$PORT"); fi
if [[ -n "$TOKEN_FILE" ]]; then ARGS+=(--token-file "$TOKEN_FILE"); fi
if [[ "$AUTH" == "oauth21" ]]; then
  if [[ -z "$OAUTH_SECRET_FILE" ]]; then
    echo "OAuth21 requires --oauth-secret-file or MCP_SUPERVISOR_OAUTH_SECRET_FILE." >&2
    exit 2
  fi
  ARGS+=(--oauth-secret-file "$OAUTH_SECRET_FILE")
fi
ARGS+=("${FORWARD_ARGS[@]}")

if [[ -n "$PORT" ]]; then
  EXISTING_JSON="$(check_existing_server "$PORT" "$PROFILE" "$AUTH" 2>/dev/null || true)"
  if [[ -n "$EXISTING_JSON" ]]; then
    echo "Serwer MCP już działa na 127.0.0.1:${PORT}. Nie uruchamiam duplikatu."
    echo "Healthz: ${EXISTING_JSON}"
    echo "Jeżeli chcesz wykonać kontrolowany restart istniejącego procesu, użyj scripts/request-restart.js albo zapisz trigger file."
    exit 0
  fi
fi

stop_requested=0
child_pid=""
trap 'stop_requested=1; if [[ -n "$child_pid" ]]; then kill -TERM "$child_pid" 2>/dev/null || true; fi' INT TERM

while true; do
  echo "Uruchamianie serwera MCP HTTP..."
  node "${ARGS[@]}" &
  child_pid=$!
  wait "$child_pid"
  exitCode=$?
  child_pid=""
  echo "Proces zakończony z kodem: $exitCode"
  if [[ "$stop_requested" -eq 1 ]]; then exit 0; fi
  case " $RESTART_CODES " in
    *" $exitCode "*) echo "Kontrolowany restart MCP, kod: $exitCode"; sleep "$DELAY_SECONDS" ;;
    *) echo "Brak restartu dla kodu: $exitCode"; exit "$exitCode" ;;
  esac
done
