"""Typed protocol builders and validators for PICO's official store APIs."""

from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass, field
from typing import Literal
from urllib.parse import urlencode

PICO_ITEM_ID = "7288745304105664518"
PICO_PACKAGE = "com.vrchat.android"
STORE_HOST = "https://appstore-us.picoxr.com"
ACCOUNT_HOST = "https://matrix-us.picovr.com"
OFFICIAL_STORE_URL = f"https://store-global.picoxr.com/jp/detail/1/{PICO_ITEM_ID}"
STORE_VERSION = "400900005"
DEVICE_NAME = "A9210"


@dataclass(frozen=True, slots=True)
class RequestSpec:
    """A transport-independent HTTP request."""

    url: str
    method: Literal["POST"]
    headers: dict[str, str]
    body: str


@dataclass(frozen=True, slots=True)
class StoreTarget:
    """An exact PICO item and its Android package."""

    item_id: str
    package_name: str
    name: str = ""

    def __post_init__(self) -> None:
        """Validate the exact identifier and Android package pair."""
        if (
            re.fullmatch(r"[0-9]{1,20}", self.item_id) is None
            or re.fullmatch(r"[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+", self.package_name) is None
        ):
            raise ValueError("valid PICO item ID and package name required")


DEFAULT_TARGET = StoreTarget(PICO_ITEM_ID, PICO_PACKAGE, "VRChat")


@dataclass(frozen=True, slots=True)
class SearchItem:
    """An installable app in an official search result."""

    item_id: str
    package_name: str
    name: str
    version_code: int | None
    price: str


@dataclass(frozen=True, slots=True)
class SearchResults:
    """Normalized first search page and optional continuation cursor."""

    items: list[SearchItem]
    next_id: int | None


@dataclass(frozen=True, slots=True)
class PicoAuth:
    """PICO account session for download metadata requests."""

    uid: str = "0"
    x_tt_token: str = ""
    cookies: dict[str, str] = field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class PublicItem:
    """Validated public listing for a selected PICO package."""

    item_id: str
    package_name: str
    name: str
    version_code: int
    price: str
    currency: str
    icon_url: str | None
    official_url: str


@dataclass(frozen=True, slots=True)
class DownloadInfo:
    """Validated official APK metadata."""

    item_id: str
    package_name: str
    version_code: int
    version: str
    size: int
    md5: str
    url: str


def parse_official_json(text: str) -> object:
    """Parse JSON without losing the official 64-bit decimal IDs."""
    return json.loads(text)


def _object(value: object) -> dict[str, object]:
    if not isinstance(value, dict) or not all(isinstance(key, str) for key in value):
        raise ValueError("invalid PICO response")
    return value


def _store_url(
    path: str,
    *,
    uid: str = "0",
    language: str = "ja",
    zone: str = "Asia/Shanghai",
    timestamp: int | None = None,
) -> str:
    params = {
        "manifest_version_code": STORE_VERSION,
        "device_name": DEVICE_NAME,
        "uid": uid,
        "app_id": "314431",
        "app_language": language,
        "client_type": "1",
        "zone_name": zone,
        "timestamp": str(int(time.time()) if timestamp is None else timestamp),
    }
    return f"{STORE_HOST}{path}?{urlencode(params)}"


def make_public_item_request(
    *,
    target: StoreTarget = DEFAULT_TARGET,
    language: str = "ja",
    zone: str = "Asia/Shanghai",
    timestamp: int | None = None,
) -> RequestSpec:
    """Build the verified public item-info POST request."""
    return RequestSpec(
        _store_url("/api/app/v1/item/info", language=language, zone=zone, timestamp=timestamp),
        "POST",
        {"Content-Type": "application/json", "Locale": language},
        json.dumps({"package_name": target.package_name}, separators=(",", ":")),
    )


def make_search_request(
    word: str, *, next_id: int = 1, language: str = "ja", timestamp: int | None = None
) -> RequestSpec:
    """Search the official PICO catalog for app names."""
    if not word.strip() or len(word) > 100 or next_id < 1:
        raise ValueError("valid search word and page required")
    return RequestSpec(
        _store_url("/api/app/v2/search/aggregation", language=language, timestamp=timestamp),
        "POST",
        {"Content-Type": "application/json", "Locale": language},
        json.dumps(
            {"word": word.strip(), "pageable": {"next_id": next_id, "size": 20}},
            separators=(",", ":"),
        ),
    )


def parse_search_results(response: object) -> SearchResults:
    """Keep exact decimal IDs and omit non-installable bundle results."""
    root = _object(response)
    if root.get("code") != 0:
        raise ValueError("PICO search failed")
    groups = _object(root.get("data")).get("search_list")
    if not isinstance(groups, list):
        raise ValueError("PICO search failed")
    items: list[SearchItem] = []
    seen: set[str] = set()
    next_id: int | None = None
    for group_value in groups:
        group = _object(group_value)
        members = group.get("items")
        if not isinstance(members, list):
            continue
        for value in members:
            item = _object(value)
            item_id = str(item.get("item_id", ""))
            package_name = item.get("package_name")
            if not isinstance(package_name, str) or item_id in seen:
                continue
            try:
                StoreTarget(item_id, package_name)
            except ValueError:
                continue
            seen.add(item_id)
            version = item.get("version_code")
            items.append(
                SearchItem(
                    item_id,
                    package_name,
                    str(item.get("name") or package_name),
                    version if isinstance(version, int) and not isinstance(version, bool) else None,
                    str(item.get("price") if item.get("price") is not None else ""),
                )
            )
        cursor = group.get("next_id")
        if group.get("has_more") and isinstance(cursor, int) and cursor > 0 and next_id is None:
            next_id = cursor
    return SearchResults(items, next_id)


def parse_public_item(response: object, target: StoreTarget = DEFAULT_TARGET) -> PublicItem:
    """Validate that a public response belongs to the expected item and package."""
    root = _object(response)
    if root.get("code") != 0:
        raise ValueError(f"PICO item lookup failed: {root.get('code', 'invalid response')}")
    data = _object(root.get("data"))
    if (
        str(data.get("item_id")) != target.item_id
        or data.get("package_name") != target.package_name
    ):
        raise ValueError("PICO returned an unexpected item or package")
    version = data.get("version_code")
    if isinstance(version, bool) or not isinstance(version, int) or version <= 0:
        raise ValueError("PICO returned an invalid version code")
    icon = data.get("icon")
    return PublicItem(
        target.item_id,
        target.package_name,
        str(data.get("name") or target.name or target.package_name),
        version,
        str(data.get("price") if data.get("price") is not None else ""),
        str(data.get("currency") if data.get("currency") is not None else ""),
        icon if isinstance(icon, str) and icon.startswith("https://") else None,
        f"https://store-global.picoxr.com/global/detail/1/{target.item_id}",
    )


def encode_account_field(value: str) -> str:
    """Encode a PICO Matrix form field using UTF-8 XOR-5 then hexadecimal."""
    return "".join(f"{byte ^ 5:02x}" for byte in value.encode("utf-8"))


def make_account_request(
    kind: Literal["send-code", "login"], email: str, code: str | None = None
) -> RequestSpec:
    """Build a PICO email verification or login request."""
    if re.fullmatch(r"\S+@\S+\.\S+", email) is None:
        raise ValueError("valid email required")
    if kind not in ("send-code", "login") or (kind == "login" and not code):
        raise ValueError("invalid account action or missing verification code")
    path = (
        "/passport/email/send_code/" if kind == "send-code" else "/passport/app/email/code_login/"
    )
    query = urlencode(
        {
            "multi_login": "1",
            "account_sdk_source": "app",
            "passport-sdk-version": "30490",
            "aid": "308733",
            "device_platform": "android",
        }
    )
    fields = (
        {
            "email": encode_account_field(email),
            "type": encode_account_field("13"),
            "email_logic_type": "0",
            "mix_mode": "1",
        }
        if kind == "send-code"
        else {
            "email": encode_account_field(email),
            "ect_type": "13",
            "code": encode_account_field(code or ""),
            "mix_mode": "1",
            "email_logic_type": "0",
        }
    )
    return RequestSpec(
        f"{ACCOUNT_HOST}{path}?{query}",
        "POST",
        {"Content-Type": "application/x-www-form-urlencoded"},
        urlencode(fields),
    )


def make_download_info_request(
    auth: PicoAuth,
    *,
    target: StoreTarget = DEFAULT_TARGET,
    language: str = "ja",
    zone: str = "Asia/Shanghai",
    timestamp: int | None = None,
) -> RequestSpec:
    """Build an authenticated download-info request without rounding the item ID."""
    if not auth.x_tt_token and not auth.cookies:
        raise ValueError("authenticated PICO session required")
    headers = {"Content-Type": "application/json", "Locale": language}
    if auth.x_tt_token:
        headers["X-Tt-Token"] = auth.x_tt_token
    if auth.cookies:
        headers["Cookie"] = "; ".join(f"{key}={value}" for key, value in auth.cookies.items())
    return RequestSpec(
        _store_url(
            "/api/app/v1/download/info",
            uid=auth.uid,
            language=language,
            zone=zone,
            timestamp=timestamp,
        ),
        "POST",
        headers,
        f'{{"item_id":{target.item_id},"package_name":"{target.package_name}"}}',
    )


def parse_download_info(response: object, target: StoreTarget = DEFAULT_TARGET) -> DownloadInfo:
    """Reject incomplete, non-HTTPS, or mismatched official APK metadata."""
    root = _object(response)
    if root.get("code") != 0:
        raise ValueError(f"PICO download info failed: {root.get('code', 'invalid response')}")
    data = _object(root.get("data"))
    package = _object(data.get("package"))
    if (
        str(data.get("item_id")) != target.item_id
        or package.get("package_name") != target.package_name
    ):
        raise ValueError("PICO returned an unexpected download package")
    version = package.get("version_code")
    size = package.get("size")
    md5 = package.get("md5")
    url = package.get("path")
    if (
        isinstance(version, bool)
        or not isinstance(version, int)
        or version <= 0
        or isinstance(size, bool)
        or not isinstance(size, int)
        or size <= 0
        or not isinstance(md5, str)
        or re.fullmatch(r"[a-fA-F0-9]{32}", md5) is None
        or not isinstance(url, str)
        or not url.startswith("https://")
    ):
        raise ValueError("PICO returned incomplete APK metadata")
    return DownloadInfo(
        target.item_id,
        target.package_name,
        version,
        str(package.get("version") or ""),
        size,
        md5.lower(),
        url,
    )
