"""Cross-language contract tests for the Python SDK."""

import json
import unittest
from pathlib import Path

from pico_store_lab import (
    PICO_ITEM_ID,
    PicoAuth,
    StoreTarget,
    make_download_info_request,
    make_public_item_request,
    make_search_request,
    mirror_decision,
    parse_download_info,
    parse_official_json,
    parse_public_item,
    parse_search_results,
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
        arguments = build_parser().parse_args(
            [
                "--locale",
                "zh-CN",
                "status",
                "--item-id",
                PICO_ITEM_ID,
                "--package",
                "com.vrchat.android",
            ]
        )
        self.assertEqual(arguments.locale, "zh-CN")
        self.assertEqual(arguments.command, "status")

    def test_selected_target_changes_request_and_validation(self) -> None:
        """A second app uses its own exact ID and package throughout the flow."""
        target = StoreTarget("7270207384512020485", "com.google.android.apps.youtube.vr.pico")
        request = make_public_item_request(target=target, timestamp=1)
        self.assertIn(target.package_name, request.body)
        response = {
            "code": 0,
            "data": {
                "item_id": int(target.item_id),
                "package_name": target.package_name,
                "version_code": 123,
                "name": "YouTube VR",
            },
        }
        self.assertEqual(parse_public_item(response, target).item_id, target.item_id)
        with self.assertRaises(ValueError):
            parse_public_item(response)

    def test_search_uses_exact_item_id(self) -> None:
        """Search normalization must skip bundles and preserve 64-bit IDs."""
        request = make_search_request("YouTube")
        self.assertIn("/api/app/v2/search/aggregation", request.url)
        result = parse_search_results(
            parse_official_json(
                '{"code":0,"data":{"search_list":[{"items":['
                '{"item_id":7270207384512020485,"package_name":'
                '"com.google.android.apps.youtube.vr.pico","name":"YouTube VR"},'
                '{"item_id":7574402934302343167,"name":"Bundle"}]}]}}'
            )
        )
        self.assertEqual([item.item_id for item in result.items], ["7270207384512020485"])


if __name__ == "__main__":
    unittest.main()
