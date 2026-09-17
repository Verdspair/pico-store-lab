# Release procedure

[简体中文](RELEASING.zh-CN.md)

GitHub is the first release channel. PyPI, npm, crates.io, and Maven Central are **not** part of the initial release. Registry names and credentials must be checked in a separate publishing pass.

1. Bump the shared release version in `packages/ts/package.json`, `packages/python/pyproject.toml`, `Cargo.toml`, `packages/kotlin/build.gradle`, and Android `versionName`; update `CHANGELOG.md` and both READMEs.
2. Run all CI checks locally or wait for green CI. Package the Python wheel/sdist, TypeScript tarball, Rust crate dry-run, Kotlin AAR, and Android debug APK. Record exact verified targets; do not describe untested headset installation as complete.
3. Inspect tracked files and Git history for secrets and large binaries; review `npm pack --dry-run`, `cargo package --list`, and Python wheel contents. Never attach auth files, official APKs, signed URLs, or private data.
4. Deploy `apps/website` with Wrangler after applying D1 migrations remotely; verify `https://pico.kanglives.top/` and `/api/releases`. The public endpoint must contain metadata only, not account or download data. If deployment is intentionally deferred, say so in the release notes.
5. Tag the verified commit with `vX.Y.Z` and create a GitHub Release. Attach only SDK/build artifacts with checksums. Ensure release notes separate verified behavior, known limitations, and deferred registry publication.
6. After publication, verify the public repository, tag, release asset list, and checksums from GitHub. A failed step is reported as incomplete; do not silently retry publication in a way that could duplicate releases.

The code license is MIT. It does not grant redistribution rights to PICO or VRChat APKs.
