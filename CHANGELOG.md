# Changelog

All notable changes follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and semantic versioning.

## [0.1.1] - 2026-09-18

### Fixed

- Android email-code entry accepts letters and digits with the text keyboard.
- Android app discovery uses a storefront layout with official covers, icons, screenshots, descriptions, and app information when supplied by PICO.
- The Android client explains that catalog listings and account download availability can differ by region.
- Kotlin SDK exposes the same official listing metadata to client developers.

## [0.1.0] - 2026-09-18

### Added

- Native Python, TypeScript, Rust, and Kotlin SDKs with shared contract fixtures.
- Rust Desktop CLI and Python CLI with public search, exact item selection, account login and verified downloads.
- Kotlin-backed on-device Android client with search, recommendations, favorites and selected-app installation.
- English/Chinese README and client UI, CI, contribution/security/release policies, and visual identity.
- Public Cloudflare app catalog at `pico.kanglives.top` with search, favorites and daily D1-backed version checks.

### Known limitations

- GitHub is the first artifact distribution channel; package registries and public APK mirroring are deferred.
- Android runtime behavior has not been validated on a connected headset for this release.
- Recommendations start with a small seed set; broader discovery uses PICO's public search interface.
