# Security policy

## Supported versions

Security fixes are applied to the latest release line. Pre-1.0 APIs may change while preserving documented security boundaries.

## Reporting

Please use [GitHub's private vulnerability report](https://github.com/nkanf-dev/pico-store-lab/security/advisories/new) when available. Do not publish account tokens, session files, verification codes, signed download links, or exploit details in a public issue. If private reporting is unavailable, open a public issue containing only a request for a private reporting channel, not the vulnerability details.

## Boundaries

The Android client requests system confirmation for APK installation. SDK parsers do not grant account access, install packages, or upload mirrors. APK integrity checks use the MD5 value returned by the official API because that is the value available from that source; MD5 is not a substitute for Android signature validation or an independent publisher signature. Keep client and headset software current.
