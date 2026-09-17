# Contributing

[简体中文](CONTRIBUTING.zh-CN.md)

Thanks for helping improve PICO Store Lab. This project is independent of PICO and VRChat. Please keep protocol work evidence-based and make the distinction between verified behavior and hypotheses explicit.

## Before a pull request

1. Open an issue for a large API or architecture change; small fixes can go directly to a PR.
2. Keep one logical change per PR. Use conventional commit subjects such as `feat(rust): ...` or `fix(android): ...`; branches use `feature/…`, `fix/…`, or a corresponding conventional type.
3. Add or update the cross-language fixture in `contracts/v1/fixtures.json` when protocol behavior changes. Update affected SDK tests together.
4. Run the checks for the touched language (see README). CI runs all language jobs.
5. Update both README languages when user-facing behavior changes. Do not claim an APK, headset flow, registry package, or Cloudflare deployment is verified unless it was actually checked.

Do not commit account sessions, verification codes, signed CDN URLs, APKs, private keys, or personal data. Keep tests offline with fixtures and mock transports. Do not add a public APK mirror as a side effect of a protocol or UI change.

## Review standards

- SDK functions should validate the expected item/package and preserve 64-bit IDs exactly.
- Network, persistence, installation, and publishing belong to clients or operators, not pure SDK parsers.
- Error and retry behavior must be explicit. Sending a verification email should not be retried automatically after an uncertain response.
- Python follows PEP 8/257/484/561 with Ruff; TypeScript uses strict compiler settings; Rust passes `fmt` and Clippy warnings-as-errors; Kotlin must compile and pass unit tests.

All contributions are licensed under [MIT](LICENSE). Third-party apps and APKs are not covered by this code license.
