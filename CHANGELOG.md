# Changelog

All notable changes follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and semantic versioning.

## [0.1.1] - 2026-09-18

### Fixed

- Recheck account entitlement after a free claim that committed but returned no order ID; all four SDKs retain the ownership-before-download rule.
- Show the owned paid-app download state after sign-in, track real download progress, support system/light/dark themes with readable input text, and permit mixed-case verification codes on Android.

### Availability

- The Android client was tested on a PICO device by the user; these specific fixes are build-tested and await a fresh on-device check.
- Registry publication status is recorded in the GitHub Release and global project notes.

## [0.1.0] - 2026-09-18

### Added

- Python, TypeScript, Rust, and Kotlin SDKs for catalog search, account sign-in, item lookup, free-offer acquisition, authenticated download metadata, and verified APK downloads.
- Configurable store request profiles for device identity, language, region, and endpoints.
- Rust desktop and Python command-line clients.
- Native Kotlin/Jetpack Compose Android storefront with search, favorites, account sign-in, official listing details, and system-confirmed installation. Downloads are retained in `Downloads/PICO Store Lab`.
- English and Chinese documentation and Android UI.
- Cloudflare catalog and public release metadata at `pico.kanglives.top`.

### Availability

- Source and binary artifacts are published on GitHub. Package registries are not yet used.
- The Android client was subsequently tested on a PICO device by the user, who reported the issues addressed above.
