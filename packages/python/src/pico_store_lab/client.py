"""Composable network client for the complete PICO store acquisition flow."""

from __future__ import annotations

import hashlib
import os
import time
from collections.abc import Callable
from dataclasses import dataclass
from email.message import Message
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from pico_store_lab.protocol import (
    DownloadInfo,
    PicoAuth,
    PublicItem,
    RequestSpec,
    SearchResults,
    StoreTarget,
    make_account_request,
    make_download_info_request,
    make_public_item_request,
    make_search_request,
    parse_download_info,
    parse_official_json,
    parse_public_item,
    parse_search_results,
)


@dataclass(frozen=True, slots=True)
class StoreResponse:
    """Decoded API payload and raw response headers."""

    data: object
    headers: Message


Transport = Callable[[RequestSpec, int], StoreResponse]


def send_request(spec: RequestSpec, retries: int = 3) -> StoreResponse:
    """Send a protocol request with bounded retries for transient failures."""
    if retries < 1:
        raise ValueError("at least one request attempt required")
    last_error: Exception | None = None
    for attempt in range(retries):
        request = Request(
            spec.url, data=spec.body.encode("utf-8"), headers=spec.headers, method=spec.method
        )
        try:
            with urlopen(request, timeout=25) as response:  # noqa: S310 - SDK selects official URLs
                body = response.read(4 * 1024 * 1024 + 1)
                if len(body) > 4 * 1024 * 1024:
                    raise RuntimeError("PICO response exceeds 4 MiB")
                return StoreResponse(parse_official_json(body.decode()), response.headers)
        except HTTPError as error:
            if error.code < 500 and error.code != 429:
                raise RuntimeError(f"PICO HTTP {error.code}") from error
            last_error = error
        except URLError as error:
            last_error = error
        if attempt + 1 < retries:
            time.sleep(min(attempt + 1, 5))
    raise RuntimeError(f"PICO request failed: {last_error}")


def _account_data(response: StoreResponse) -> dict[str, object]:
    data = response.data
    if not isinstance(data, dict) or data.get("message") != "success":
        raise RuntimeError("PICO account request rejected")
    body = data.get("data")
    return body if isinstance(body, dict) else {}


def download_verified_apk(info: DownloadInfo, output: Path, retries: int = 8) -> Path:
    """Download official APK bytes and verify the provided MD5 before publishing a file."""
    if retries < 1:
        raise ValueError("at least one download attempt required")
    if output.suffix.lower() != ".apk" or output.exists():
        raise ValueError("new .apk output path required")
    temporary = output.with_name(f"{output.stem}.part.apk")
    last_error: Exception | None = None
    for attempt in range(retries):
        digest = hashlib.md5()  # noqa: S324 - official APK metadata supplies MD5
        try:
            with urlopen(info.url, timeout=60) as response:  # noqa: S310 - validated HTTPS URL
                with temporary.open("wb") as stream:
                    while chunk := response.read(65536):
                        digest.update(chunk)
                        stream.write(chunk)
            if digest.hexdigest() != info.md5:
                temporary.unlink(missing_ok=True)
                raise ValueError("APK digest mismatch")
            os.link(temporary, output)
            temporary.unlink()
            return output
        except (OSError, URLError) as error:
            last_error = error
            if attempt + 1 < retries:
                time.sleep(min(attempt + 1, 5))
    raise RuntimeError(f"APK download failed: {last_error}")


class PicoStoreClient:
    """High-level SDK interface; callers may replace transport at any point."""

    def __init__(self, transport: Transport = send_request) -> None:
        """Use the standard HTTP transport unless one is injected."""
        self.transport = transport

    def search(self, word: str, next_id: int = 1) -> SearchResults:
        """Search the official public app catalog."""
        response = self.transport(make_search_request(word, next_id=next_id), 3)
        return parse_search_results(response.data)

    def item(self, target: StoreTarget) -> PublicItem:
        """Read and validate public metadata for the selected app."""
        response = self.transport(make_public_item_request(target=target), 3)
        return parse_public_item(response.data, target)

    def send_code(self, email: str) -> None:
        """Send one PICO email verification code."""
        _account_data(self.transport(make_account_request("send-code", email), 1))

    def login(self, email: str, code: str) -> PicoAuth:
        """Exchange the email code for the caller's PICO account session."""
        response = self.transport(make_account_request("login", email, code), 1)
        data = _account_data(response)
        cookies: dict[str, str] = {}
        for line in response.headers.get_all("Set-Cookie", []):
            key, separator, value = line.split(";", 1)[0].partition("=")
            if separator:
                cookies[key] = value
        auth = PicoAuth(
            str(data.get("user_id_str") or data.get("user_id") or "0"),
            str(response.headers.get("x-tt-token", "")),
            cookies,
        )
        if not auth.x_tt_token and not auth.cookies:
            raise RuntimeError("PICO login returned no usable session")
        return auth

    def download_info(self, target: StoreTarget, auth: PicoAuth) -> DownloadInfo:
        """Read download metadata authorized for the caller's own account."""
        response = self.transport(make_download_info_request(auth, target=target), 3)
        return parse_download_info(response.data, target)

    def download(self, target: StoreTarget, auth: PicoAuth, output: Path) -> Path:
        """Get and verify an official APK in one call."""
        return download_verified_apk(self.download_info(target, auth), output)
