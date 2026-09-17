"""Render project SVGs into a compact visual-review contact sheet.

The command uses the system's librsvg renderer. It performs structural SVG
checks before rendering and writes only to an ignored local build directory.
"""

from __future__ import annotations

import argparse
import html
import subprocess
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = (("logo", 256, 256), ("banner", 1440, 480))


def render_asset(name: str, width: int, height: int, output: Path) -> Path:
    """Validate and render one version-controlled SVG asset."""
    source = ROOT / "assets" / "brand" / f"{name}.svg"
    root = ET.parse(source).getroot()
    if root.tag != "{http://www.w3.org/2000/svg}svg":
        raise ValueError(f"{source} is not an SVG root")
    if root.attrib.get("width") != str(width) or root.attrib.get("height") != str(
        height
    ):
        raise ValueError(f"{source} has unexpected dimensions")
    destination = output / f"{name}.png"
    with destination.open("wb") as stream:
        subprocess.run(
            ["rsvg-convert", "-w", str(width), "-h", str(height), str(source)],
            check=True,
            stdout=stream,
        )
    return destination


def main() -> None:
    """Render brand assets and write a reviewable local HTML index."""
    parser = argparse.ArgumentParser(description="Render SVG branding for visual QA")
    parser.add_argument("--output", type=Path, default=ROOT / "build" / "visual-qa")
    output = parser.parse_args().output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    rendered = [
        render_asset(name, width, height, output) for name, width, height in ASSETS
    ]
    cards = "\n".join(
        f'<figure><img src="{html.escape(path.name)}" alt="{html.escape(path.stem)}">'
        f"<figcaption>{html.escape(path.stem)}</figcaption></figure>"
        for path in rendered
    )
    page = (
        '<!doctype html><html lang="en"><meta charset="utf-8">'
        "<title>PICO Store Lab — visual QA</title>"
        "<style>body{font:16px sans-serif;background:#e9e9e1;color:#171915;"
        "padding:2rem;}figure{margin:0 0 2rem;border:1px solid #171915;"
        "padding:1rem;background:#f1f0e8;}"
        "img{display:block;max-width:100%;height:auto;}figcaption{margin-top:.7rem}</style>"
        f"<h1>PICO Store Lab / visual QA</h1>{cards}</html>"
    )
    (output / "index.html").write_text(page, encoding="utf-8")
    print(output / "index.html")


if __name__ == "__main__":
    main()
