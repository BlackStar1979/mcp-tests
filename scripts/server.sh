#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

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
