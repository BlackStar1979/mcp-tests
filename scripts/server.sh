#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PROFILE="${MCP_SUPERVISOR_PROFILE:-public}"
AUTH="${MCP_SUPERVISOR_AUTH:-none}"
RESTART_CODES="${MCP_SUPERVISOR_RESTART_CODES:-42 43 44}"
DELAY_SECONDS="${MCP_SUPERVISOR_RESTART_DELAY_SECONDS:-1}"

export MCP_TEST_ENABLE_RESTART_TRIGGER="${MCP_TEST_ENABLE_RESTART_TRIGGER:-1}"
export MCP_TEST_RESTART_TRIGGER_FILE="${MCP_TEST_RESTART_TRIGGER_FILE:-$ROOT_DIR/_control/restart-request.json}"
mkdir -p "$(dirname "$MCP_TEST_RESTART_TRIGGER_FILE")"

ARGS=(server.js --profile "$PROFILE" --auth "$AUTH")
if [[ -n "${MCP_SUPERVISOR_PORT:-}" ]]; then ARGS+=(--port "$MCP_SUPERVISOR_PORT"); fi
if [[ -n "${MCP_SUPERVISOR_TOKEN_FILE:-}" ]]; then ARGS+=(--token-file "$MCP_SUPERVISOR_TOKEN_FILE"); fi
if [[ "$AUTH" == "oauth21" ]]; then
  if [[ -z "${MCP_SUPERVISOR_OAUTH_SECRET_FILE:-}" ]]; then
    echo "MCP_SUPERVISOR_OAUTH_SECRET_FILE is required for oauth21." >&2
    exit 2
  fi
  ARGS+=(--oauth-secret-file "$MCP_SUPERVISOR_OAUTH_SECRET_FILE")
fi
ARGS+=("$@")

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
