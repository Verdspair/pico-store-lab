"""Small bilingual command-line client built on the Python SDK."""

from __future__ import annotations

import argparse
import getpass
import hashlib
import json
import os
import sys
import time
from email.message import Message
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from pico_store_lab.protocol import (
    PicoAuth,
    RequestSpec,
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

MESSAGES = {
    "en": {
        "sent": "PICO verification email sent.",
        "saved": "Private session saved to {path}",
        "downloaded": "Verified APK saved to {path}",
        "error": "Error: {message}",
    },
    "zh-CN": {
        "sent": "PICO 验证码邮件已发送。",
        "saved": "私有会话已保存到 {path}",
        "downloaded": "已校验 APK，保存到 {path}",
        "error": "错误：{message}",
    },
}


def _message(locale: str, key: str, **values: str) -> str:
    return MESSAGES[locale][key].format(**values)


def _request(spec: RequestSpec, *, retries: int = 3) -> tuple[object, Message]:
    """Send one official protocol request, retrying only when explicitly requested."""
    last_error: Exception | None = None
    for attempt in range(retries):
        request = Request(
            spec.url, data=spec.body.encode("utf-8"), headers=spec.headers, method=spec.method
        )
        try:
            with urlopen(request, timeout=25) as response:  # noqa: S310 - SDK builds allowlisted URLs
                body = response.read(4 * 1024 * 1024 + 1)
                if len(body) > 4 * 1024 * 1024:
                    raise RuntimeError("PICO response exceeds 4 MiB")
                return parse_official_json(body.decode()), response.headers
        except HTTPError as error:
            if error.code < 500 and error.code != 429:
                raise RuntimeError(f"PICO HTTP {error.code}") from error
            last_error = error
        except URLError as error:
            last_error = error
        if attempt + 1 < retries:
            time.sleep(min(attempt + 1, 5))
    raise RuntimeError(f"PICO request failed: {last_error}")


def _require_account_success(body: object) -> dict[str, object]:
    if not isinstance(body, dict) or body.get("message") != "success":
        raise RuntimeError("PICO account request rejected")
    data = body.get("data")
    return data if isinstance(data, dict) else {}


def _save_auth(path: Path, auth: PicoAuth) -> None:
    handle = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(handle, "w", encoding="utf-8") as stream:
        json.dump({"uid": auth.uid, "x_tt_token": auth.x_tt_token, "cookies": auth.cookies}, stream)


def _read_auth(path: Path) -> PicoAuth:
    if path.stat().st_mode & 0o077:
        raise ValueError("auth file must not be readable by other users")
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict) or not isinstance(data.get("cookies", {}), dict):
        raise ValueError("invalid auth file")
    auth = PicoAuth(
        str(data.get("uid", "0")),
        str(data.get("x_tt_token", "")),
        {str(key): str(value) for key, value in data.get("cookies", {}).items()},
    )
    if not auth.x_tt_token and not auth.cookies:
        raise ValueError("invalid auth file")
    return auth


def _download(url: str, expected_md5: str, output: Path) -> None:
    if not url.startswith("https://") or output.suffix.lower() != ".apk":
        raise ValueError("HTTPS APK URL and .apk output are required")
    temporary = output.with_name(f"{output.stem}.part.apk")
    last_error: Exception | None = None
    for attempt in range(8):
        digest = hashlib.md5()  # noqa: S324 - PICO supplies MD5 as its APK integrity token
        try:
            with urlopen(url, timeout=60) as response:  # noqa: S310 - validated HTTPS URL
                with temporary.open("wb") as stream:
                    while chunk := response.read(65536):
                        digest.update(chunk)
                        stream.write(chunk)
            if digest.hexdigest() != expected_md5:
                temporary.unlink(missing_ok=True)
                raise ValueError("APK digest mismatch")
            temporary.replace(output)
            return
        except (OSError, URLError) as error:
            last_error = error
            if attempt + 1 < 8:
                time.sleep(min(attempt + 1, 5))
    raise RuntimeError(f"APK download failed: {last_error}")


def build_parser() -> argparse.ArgumentParser:
    """Create the stable CLI argument parser."""
    parser = argparse.ArgumentParser(prog="pico-store-py", description="PICO Store Lab Python CLI")
    parser.add_argument("--locale", choices=("en", "zh-CN"), default="en")
    sub = parser.add_subparsers(dest="command", required=True)
    search = sub.add_parser("search", help="Search official PICO apps")
    search.add_argument("word")
    status = sub.add_parser("status", help="Show an official PICO item")
    status.add_argument("--item-id", required=True)
    status.add_argument("--package", required=True)
    send = sub.add_parser("send-code", help="Send a PICO email code")
    send.add_argument("--email", required=True)
    login = sub.add_parser("login", help="Save a private PICO session")
    login.add_argument("--email", required=True)
    login.add_argument("--auth-file", required=True, type=Path)
    download = sub.add_parser("download", help="Download and verify an official APK")
    download.add_argument("--auth-file", required=True, type=Path)
    download.add_argument("--output", required=True, type=Path)
    download.add_argument("--item-id", required=True)
    download.add_argument("--package", required=True)
    return parser


def main(argv: list[str] | None = None) -> int:
    """Run one command; return a process exit status without leaking credentials."""
    args = build_parser().parse_args(argv)
    try:
        if args.command == "search":
            body, _ = _request(make_search_request(args.word))
            result = parse_search_results(body)
            print(
                json.dumps(
                    [
                        {
                            "name": item.name,
                            "itemId": item.item_id,
                            "packageName": item.package_name,
                            "versionCode": item.version_code,
                        }
                        for item in result.items
                    ],
                    indent=2,
                )
            )
        elif args.command == "status":
            target = StoreTarget(args.item_id, args.package)
            body, _ = _request(make_public_item_request(target=target))
            item = parse_public_item(body, target)
            print(
                json.dumps(
                    {
                        "name": item.name,
                        "versionCode": item.version_code,
                        "price": item.price,
                        "officialUrl": item.official_url,
                    },
                    indent=2,
                )
            )
        elif args.command == "send-code":
            body, _ = _request(make_account_request("send-code", args.email), retries=1)
            _require_account_success(body)
            print(_message(args.locale, "sent"))
        elif args.command == "login":
            code = getpass.getpass("PICO email code: ")
            body, headers = _request(make_account_request("login", args.email, code), retries=1)
            data = _require_account_success(body)
            cookies = {}
            for line in headers.get_all("Set-Cookie", []):
                pair = line.split(";", 1)[0].split("=", 1)
                if len(pair) == 2:
                    cookies[pair[0]] = pair[1]
            auth = PicoAuth(
                str(data.get("user_id_str") or data.get("user_id") or "0"),
                str(headers.get("x-tt-token", "")),
                cookies,
            )
            if not auth.x_tt_token and not auth.cookies:
                raise RuntimeError("PICO login returned no usable session")
            _save_auth(args.auth_file, auth)
            print(_message(args.locale, "saved", path=str(args.auth_file)))
        elif args.command == "download":
            target = StoreTarget(args.item_id, args.package)
            body, _ = _request(
                make_download_info_request(_read_auth(args.auth_file), target=target)
            )
            info = parse_download_info(body, target)
            _download(info.url, info.md5, args.output)
            print(_message(args.locale, "downloaded", path=str(args.output)))
    except (OSError, ValueError, RuntimeError) as error:
        print(_message(args.locale, "error", message=str(error)), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
