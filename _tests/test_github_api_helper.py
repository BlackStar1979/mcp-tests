from __future__ import annotations

import importlib.util
import io
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "scripts" / "github_api.py"


def load_module():
    spec = importlib.util.spec_from_file_location("github_api", MODULE_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("unable to load github_api helper")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class FakeResponse:
    def __init__(self, body: bytes, status: int = 200, headers: dict[str, str] | None = None):
        self._body = io.BytesIO(body)
        self.status = status
        self.headers = headers or {"content-type": "application/json"}

    def read(self, size: int = -1) -> bytes:
        return self._body.read(size)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class FakeOpener:
    def __init__(self, response: FakeResponse):
        self.response = response
        self.requests = []

    def open(self, request, timeout=0):
        self.requests.append((request, timeout))
        return self.response


class GithubApiHelperTests(unittest.TestCase):
    def setUp(self):
        self.github_api = load_module()

    def test_load_credential_accepts_expected_json_shape(self):
        with tempfile.TemporaryDirectory() as tmp:
            credential_file = Path(tmp) / "credential.json"
            credential_file.write_text(json.dumps({"token": "fixture-value", "scopes": {}}), encoding="utf-8")
            self.assertEqual(self.github_api.load_token(credential_file), "fixture-value")

    def test_load_credential_rejects_empty_or_missing_value(self):
        with tempfile.TemporaryDirectory() as tmp:
            credential_file = Path(tmp) / "credential.json"
            credential_file.write_text("{}", encoding="utf-8")
            with self.assertRaises(ValueError):
                self.github_api.load_token(credential_file)

    def test_normalize_endpoint_rejects_absolute_urls_and_traversal(self):
        for value in ["https://example.invalid/user", "//example.invalid/user", "/repos/a/b/../c", "user"]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                self.github_api.normalize_endpoint(value)
        self.assertEqual(self.github_api.normalize_endpoint("/user?x=1"), "/user?x=1")

    def test_redact_removes_credential_value_recursively(self):
        payload = {
            "credential": "fixture-value",
            "nested": ["fixture-value", {"token": "fixture-value", "safe": "ok"}],
        }
        redacted = self.github_api.redact(payload, "fixture-value")
        rendered = json.dumps(redacted)
        self.assertNotIn("fixture-value", rendered)
        self.assertEqual(redacted["credential"], "[REDACTED]")
        self.assertEqual(redacted["nested"][1]["token"], "[REDACTED]")
        self.assertEqual(redacted["nested"][1]["safe"], "ok")

    def test_mutating_methods_require_explicit_confirmation_before_transport(self):
        opener = FakeOpener(FakeResponse(b"{}"))
        with self.assertRaises(PermissionError):
            self.github_api.request_json(
                method="PATCH",
                endpoint="/repos/example/repo",
                token="fixture-value",
                confirm=False,
                opener=opener,
            )
        self.assertEqual(opener.requests, [])

    def test_request_uses_versioned_json_headers_and_injected_transport(self):
        opener = FakeOpener(FakeResponse(b'{"login":"example"}', headers={"content-type": "application/json"}))
        result = self.github_api.request_json(
            method="GET",
            endpoint="/user",
            token="fixture-value",
            opener=opener,
        )
        self.assertEqual(result["status"], 200)
        self.assertEqual(result["body"], {"login": "example"})
        request, timeout = opener.requests[0]
        headers = {key.lower(): value for key, value in request.header_items()}
        self.assertEqual(headers["accept"], "application/vnd.github+json")
        self.assertEqual(headers["x-github-api-version"], "2026-03-10")
        self.assertGreater(timeout, 0)

    def test_response_is_bounded_and_reports_truncation(self):
        opener = FakeOpener(FakeResponse(b"abcdefghij", headers={"content-type": "text/plain"}))
        result = self.github_api.request_json(
            method="GET",
            endpoint="/zen",
            token="fixture-value",
            opener=opener,
            max_bytes=5,
        )
        self.assertTrue(result["truncated"])
        self.assertEqual(result["returned_bytes"], 5)
        self.assertEqual(result["body"], "abcde")


if __name__ == "__main__":
    unittest.main()
