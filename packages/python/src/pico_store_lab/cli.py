"""Small bilingual command-line client built on the Python SDK."""

from __future__ import annotations

import argparse
import getpass
import json
import os
import sys
from pathlib import Path

from pico_store_lab.client import PicoStoreClient
from pico_store_lab.protocol import PicoAuth, StoreTarget

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
    client = PicoStoreClient()
    try:
        if args.command == "search":
            result = client.search(args.word)
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
            item = client.item(target)
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
            client.send_code(args.email)
            print(_message(args.locale, "sent"))
        elif args.command == "login":
            code = getpass.getpass("PICO email code: ")
            auth = client.login(args.email, code)
            _save_auth(args.auth_file, auth)
            print(_message(args.locale, "saved", path=str(args.auth_file)))
        elif args.command == "download":
            target = StoreTarget(args.item_id, args.package)
            client.download(target, _read_auth(args.auth_file), args.output)
            print(_message(args.locale, "downloaded", path=str(args.output)))
    except (OSError, ValueError, RuntimeError) as error:
        print(_message(args.locale, "error", message=str(error)), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
