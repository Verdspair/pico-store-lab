"""Full-flow client orchestration without contacting a live account."""

import json
import unittest
from email.message import Message
from pathlib import Path

from pico_store_lab import PicoStoreClient, StoreResponse, StoreTarget

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


if __name__ == "__main__":
    unittest.main()
