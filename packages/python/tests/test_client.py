"""Full-flow client orchestration without contacting a live account."""

import json
import unittest
from email.message import Message
from pathlib import Path

from pico_store_lab import PicoAuth, PicoStoreClient, StoreConfig, StoreResponse, StoreTarget

FIXTURE = json.loads(
    (Path(__file__).resolve().parents[3] / "contracts/v1/fixtures.json").read_text()
)


class ClientTests(unittest.TestCase):
    """The SDK owns capabilities used by the CLI."""

    def test_complete_metadata_and_session_flow(self) -> None:
        """Search, item, code, login and download metadata compose correctly."""
        paths: list[str] = []

        def transport(spec: object, retries: int) -> StoreResponse:
            self.assertGreater(retries, 0)
            path = spec.url.split("?", 1)[0]  # type: ignore[attr-defined]
            paths.append(path)
            headers = Message()
            if path.endswith("code_login/"):
                headers.add_header("Set-Cookie", "sessionid=abc; Path=/")
                headers.add_header("x-tt-token", "token")
                return StoreResponse(
                    {"message": "success", "data": {"user_id_str": "123"}}, headers
                )
            if path.endswith("send_code/"):
                return StoreResponse({"message": "success"}, headers)
            if path.endswith("search/aggregation"):
                item = {"item_id": FIXTURE["itemId"], "package_name": FIXTURE["packageName"]}
                return StoreResponse(
                    {"code": 0, "data": {"search_list": [{"items": [item]}]}}, headers
                )
            if path.endswith("item/info"):
                return StoreResponse(json.loads(FIXTURE["publicResponse"]), headers)
            return StoreResponse(json.loads(FIXTURE["downloadResponse"]), headers)

        client = PicoStoreClient(transport)
        result = client.search("sample")
        target = StoreTarget(result.items[0].item_id, result.items[0].package_name)
        self.assertEqual(client.item(target).version_code, FIXTURE["versionCode"])
        client.send_code("test@example.com")
        auth = client.login("test@example.com", "123456")
        self.assertEqual(auth.cookies["sessionid"], "abc")
        self.assertEqual(client.download_info(target, auth).size, FIXTURE["apkSize"])
        self.assertEqual(len(paths), 5)

    def test_free_offer_precedes_download_metadata_with_custom_device(self) -> None:
        """Configured request identity is used throughout the free acquisition flow."""
        paths: list[list[str]] = []
        owned = False

        def transport(spec: object, retries: int) -> StoreResponse:
            nonlocal owned
            self.assertGreater(retries, 0)
            self.assertIn("device_name=CustomDevice", spec.url)  # type: ignore[attr-defined]
            path = spec.url.split("?", 1)[0]  # type: ignore[attr-defined]
            paths.append(path.rsplit("/", 3)[-3:])
            if path.endswith("item/info"):
                return StoreResponse(
                    {
                        "code": 0,
                        "data": {
                            "item_id": FIXTURE["itemId"],
                            "package_name": FIXTURE["packageName"],
                            "name": "Sample",
                            "version_code": FIXTURE["versionCode"],
                            "price": "0",
                            "currency": "JPY",
                            "entitlement_status": 1 if owned else 2,
                            "is_offer_exist": True,
                        },
                    },
                    Message(),
                )
            if path.endswith("item/price"):
                self.assertTrue(json.loads(spec.body)["is_free_entitlment"])  # type: ignore[attr-defined]
                owned = True
                return StoreResponse({"code": 0, "data": {"free": True, "order_id": 42}}, Message())
            return StoreResponse(json.loads(FIXTURE["downloadResponse"]), Message())

        client = PicoStoreClient(
            transport, StoreConfig(device_name="CustomDevice", web_region="us")
        )
        target = StoreTarget(FIXTURE["itemId"], FIXTURE["packageName"])
        auth = PicoAuth("123", "token")
        self.assertIn("/us/detail/", client.ensure_entitlement(target, auth).official_url)
        self.assertEqual(client.download_info(target, auth).version_code, FIXTURE["versionCode"])
        self.assertEqual(
            [parts[-2:] for parts in paths],
            [
                ["item", "info"],
                ["item", "price"],
                ["item", "info"],
                ["download", "info"],
            ],
        )

    def test_missing_order_id_rechecks_committed_entitlement(self) -> None:
        """A committed free claim remains usable if its response lacks an order ID."""
        owned = False

        def transport(spec: object, retries: int) -> StoreResponse:
            nonlocal owned
            if spec.url.split("?", 1)[0].endswith("item/info"):  # type: ignore[attr-defined]
                return StoreResponse(
                    {
                        "code": 0,
                        "data": {
                            "item_id": FIXTURE["itemId"],
                            "package_name": FIXTURE["packageName"],
                            "name": "Sample",
                            "version_code": FIXTURE["versionCode"],
                            "price": "0",
                            "currency": "JPY",
                            "entitlement_status": 1 if owned else 2,
                            "is_offer_exist": True,
                        },
                    },
                    Message(),
                )
            owned = True
            return StoreResponse({"code": 0, "data": {"free": True}}, Message())

        client = PicoStoreClient(transport)
        target = StoreTarget(FIXTURE["itemId"], FIXTURE["packageName"])
        item = client.ensure_entitlement(target, PicoAuth("123", "token"))
        self.assertEqual(item.entitlement_status, 1)


if __name__ == "__main__":
    unittest.main()
