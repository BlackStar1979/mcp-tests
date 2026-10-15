from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

API_BASE = "https://api.github.com"
API_VERSION = "2026-03-10"
DEFAULT_MAX_BYTES = 1_048_576
DEFAULT_TIMEOUT_SECONDS = 30.0
MUTATING_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})
SENSITIVE_KEYS = frozenset({"authorization", "credential", "password", "secret", "token"})


def default_token_file() -> Path:
    home = Path(os.environ.get("USERPROFILE") or Path.home())
    return home / ".romion" / "gh_token.json"


def load_token(token_file: str | os.PathLike[str]) -> str:
    path = Path(token_file).expanduser()
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise ValueError(f"credential file does not exist: {path}") from error
    except json.JSONDecodeError as error:
        raise ValueError(f"credential file is not valid JSON: {path}") from error
    if not isinstance(payload, dict):
        raise ValueError("credential file must contain a JSON object")
    token = payload.get("token")
    if not isinstance(token, str) or not token.strip():
        raise ValueError("credential file must contain a non-empty token string")
    return token.strip()


def normalize_endpoint(endpoint: str) -> str:
    raw = str(endpoint or "").strip()
    if not raw.startswith("/") or raw.startswith("//"):
        raise ValueError("endpoint must be an absolute API path beginning with one slash")
    parsed = urllib.parse.urlsplit(raw)
    if parsed.scheme or parsed.netloc or parsed.fragment:
        raise ValueError("endpoint must not contain a scheme, host, or fragment")
    decoded_path = urllib.parse.unquote(parsed.path)
    if any(part == ".." for part in decoded_path.split("/")):
        raise ValueError("endpoint path traversal is forbidden")
    normalized_path = urllib.parse.quote(decoded_path, safe="/%:@-._~!$&'()*+,;=")
    return urllib.parse.urlunsplit(("", "", normalized_path, parsed.query, ""))


def redact(value: Any, token: str = "", key: str = "") -> Any:
    if key.lower() in SENSITIVE_KEYS:
        return "[REDACTED]"
    if isinstance(value, dict):
        return {str(item_key): redact(item_value, token, str(item_key)) for item_key, item_value in value.items()}
    if isinstance(value, list):
        return [redact(item, token) for item in value]
    if isinstance(value, tuple):
        return [redact(item, token) for item in value]
    if isinstance(value, str) and token:
        return value.replace(token, "[REDACTED]")
    return value


def _encode_payload(data: Any) -> bytes | None:
    if data is None:
        return None
    return json.dumps(data, ensure_ascii=False, separators=(",", ":")).encode("utf-8")


def _response_headers(headers: Any) -> dict[str, str]:
    if hasattr(headers, "items"):
        return {str(key).lower(): str(value) for key, value in headers.items()}
    return {}


def _decode_body(raw: bytes, headers: dict[str, str], truncated: bool) -> Any:
    text = raw.decode("utf-8", errors="replace")
    if not truncated and "json" in headers.get("content-type", "").lower():
        try:
            return json.loads(text) if text else None
        except json.JSONDecodeError:
            pass
    return text


def request_json(
    *,
    method: str,
    endpoint: str,
    token: str,
    data: Any = None,
    confirm: bool = False,
    opener: Any = None,
    timeout: float = DEFAULT_TIMEOUT_SECONDS,
    max_bytes: int = DEFAULT_MAX_BYTES,
) -> dict[str, Any]:
    normalized_method = str(method or "GET").upper()
    if normalized_method not in {"GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"}:
        raise ValueError(f"unsupported HTTP method: {normalized_method}")
    if normalized_method in MUTATING_METHODS and not confirm:
        raise PermissionError("mutating GitHub requests require confirm=True")
    if not isinstance(token, str) or not token:
        raise ValueError("a non-empty credential is required")
    if not isinstance(max_bytes, int) or max_bytes < 1 or max_bytes > 16_777_216:
        raise ValueError("max_bytes must be between 1 and 16777216")
    normalized_endpoint = normalize_endpoint(endpoint)
    body = _encode_payload(data)
    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}",
        "User-Agent": "mcp-tests-github-api-helper/1",
        "X-GitHub-Api-Version": API_VERSION,
    }
    if body is not None:
        headers["Content-Type"] = "application/json; charset=utf-8"
    request = urllib.request.Request(
        f"{API_BASE}{normalized_endpoint}",
        data=body,
        headers=headers,
        method=normalized_method,
    )
    transport = opener or urllib.request.build_opener()
    try:
        response = transport.open(request, timeout=float(timeout))
    except urllib.error.HTTPError as error:
        response = error
    with response:
        raw = response.read(max_bytes + 1)
        truncated = len(raw) > max_bytes
        bounded = raw[:max_bytes]
        response_headers = _response_headers(response.headers)
        status = int(getattr(response, "status", getattr(response, "code", 0)) or 0)
    return {
        "status": status,
        "method": normalized_method,
        "endpoint": normalized_endpoint,
        "returned_bytes": len(bounded),
        "truncated": truncated,
        "headers": {
            key: value
            for key, value in response_headers.items()
            if key in {"content-type", "etag", "link", "x-github-request-id", "x-ratelimit-limit", "x-ratelimit-remaining", "x-ratelimit-reset"}
        },
        "body": _decode_body(bounded, response_headers, truncated),
    }


def _read_data(args: argparse.Namespace) -> Any:
    sources = sum(bool(value) for value in (args.data_file, args.data_json, args.data_stdin))
    if sources > 1:
        raise ValueError("use only one of --data-file, --data-json, or --data-stdin")
    if args.data_file:
        return json.loads(Path(args.data_file).read_text(encoding="utf-8"))
    if args.data_json:
        return json.loads(args.data_json)
    if args.data_stdin:
        return json.load(sys.stdin)
    return None


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Bounded GitHub REST helper using a local credential file.")
    parser.add_argument("endpoint", help="GitHub API path, for example /user or /repos/OWNER/REPO")
    parser.add_argument("--method", default="GET", choices=["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"])
    parser.add_argument("--token-file", default=str(default_token_file()))
    parser.add_argument("--data-file")
    parser.add_argument("--data-json")
    parser.add_argument("--data-stdin", action="store_true")
    parser.add_argument("--confirm", action="store_true", help="Required for POST, PUT, PATCH, and DELETE.")
    parser.add_argument("--timeout", type=float, default=DEFAULT_TIMEOUT_SECONDS)
    parser.add_argument("--max-bytes", type=int, default=DEFAULT_MAX_BYTES)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    token = ""
    try:
        token = load_token(args.token_file)
        payload = _read_data(args)
        result = request_json(
            method=args.method,
            endpoint=args.endpoint,
            token=token,
            data=payload,
            confirm=args.confirm,
            timeout=args.timeout,
            max_bytes=args.max_bytes,
        )
        print(json.dumps(redact(result, token), ensure_ascii=False, indent=2))
        return 0 if 200 <= int(result["status"]) < 400 else 1
    except Exception as error:
        safe_error = redact({"error": str(error), "type": type(error).__name__}, token)
        print(json.dumps(safe_error, ensure_ascii=False), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
