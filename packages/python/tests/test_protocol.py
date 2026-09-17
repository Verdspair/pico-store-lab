"""Cross-language contract tests for the Python SDK."""

import json
import unittest
from pathlib import Path

from pico_store_lab import (
    PICO_ITEM_ID,
    PicoAuth,
    make_download_info_request,
    make_public_item_request,
    mirror_decision,
    parse_download_info,
    parse_official_json,
    parse_public_item,
)
from pico_store_lab.cli import build_parser

FIXTURES = json.loads(
    (Path(__file__).resolve().parents[3] / "contracts/v1/fixtures.json").read_text(encoding="utf-8")
)


class ProtocolContractTests(unittest.TestCase):
    """Exercise the shared fixture and negative protocol cases."""

    def test_public_request_and_exact_item(self) -> None:
        """Keep the official URL shape and exact 64-bit item ID."""
        request = make_public_item_request(timestamp=1)
        self.assertEqual(json.loads(request.body)["package_name"], FIXTURES["packageName"])
        item = parse_public_item(parse_official_json(FIXTURES["publicResponse"]))
        self.assertEqual(item.item_id, PICO_ITEM_ID)
        self.assertEqual(item.version_code, FIXTURES["versionCode"])
        self.assertIn("device_name=A9210", request.url)

    def test_download_and_mirror_policy(self) -> None:
        """Validate APK metadata before applying the default mirror policy."""
        info = parse_download_info(parse_official_json(FIXTURES["downloadResponse"]))
        self.assertEqual(info.md5, FIXTURES["md5"])
        self.assertTrue(mirror_decision(price="0", size=info.size).eligible)
        self.assertEqual(mirror_decision(price="1", size=info.size).reason, "not_free")
        request = make_download_info_request(PicoAuth(cookies={"sessionid": "secret"}))
        self.assertIn(PICO_ITEM_ID, request.body)
        self.assertIn("sessionid=secret", request.headers["Cookie"])

    def test_reject_wrong_package(self) -> None:
        """Never accept a similarly shaped response for another application."""
        response = parse_official_json(FIXTURES["publicResponse"])
        response["data"]["package_name"] = "com.example.wrong"
        with self.assertRaises(ValueError):
            parse_public_item(response)

    def test_cli_has_language_and_status(self) -> None:
        """Expose an English/Chinese CLI without initiating network requests."""
        arguments = build_parser().parse_args(["--locale", "zh-CN", "status"])
        self.assertEqual(arguments.locale, "zh-CN")
        self.assertEqual(arguments.command, "status")


if __name__ == "__main__":
    unittest.main()
