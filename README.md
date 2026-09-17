# PICO Store Lab

Independent PICO storefront experiment in one monorepo. The first tracked item is the **native PICO VRChat build** (`com.vrchat.android`), not the Google Play mobile build.

| Part | Current capability |
| --- | --- |
| `packages/shared` | Exact 64-bit item IDs, official PICO request/response shapes, release transitions, and configurable mirror-selection policy |
| `apps/website` | Constructivist release page, Cloudflare Worker + D1 daily version tracker, local SQLite preview |
| `apps/desktop` | Command-line client: status, PICO email login, resumable verified APK download |
| `apps/android` | On-device PICO client: public status, in-memory email login, verified APK download, Android-confirmed installation |

The website is not deployed and does not host APKs. Mirroring is a configurable policy primitive, **not yet a running mirror pipeline**. By default it selects free items below 512 MiB; the operator can alter or disable that rule. An R2 bucket, credentials, and explicit deployment configuration will be required before any public APK distribution. This project does not enforce a copyright/licensing gate, but users operating a public mirror are responsible for permission to redistribute packages. No personal credentials or APK files are committed.

## Quick start

Requires Node.js 25+. At the repository root:

```sh
npm install --offline --ignore-scripts
npm test
node apps/desktop/src/cli.js status
node apps/website/src/dev.js
```

The local website is served at `http://127.0.0.1:8787/` and stores release state under ignored `apps/website/.local/`. If your network needs a proxy, launch Node with `NODE_USE_ENV_PROXY=1 HTTPS_PROXY=http://127.0.0.1:7890` or equivalent. Desktop commands:

```sh
node apps/desktop/src/cli.js send-code --email you@example.com
node apps/desktop/src/cli.js login --email you@example.com --auth-file ./private.auth.json
node apps/desktop/src/cli.js download --auth-file ./private.auth.json --output ./vrchat-pico.apk
```

The login command prompts for the verification code in the terminal and saves a private `0600` session file. The download checks the official MD5. Keep the auth file private and remove it when finished.

## PICO Android build

Requires Android SDK 35, Java 17, and the included Gradle 8.9 wrapper. From `apps/android`:

```sh
JAVA_HOME=/path/to/jdk-17 ANDROID_HOME=/path/to/android-sdk ./gradlew --offline assembleDebug
```

The debug APK is generated at `apps/android/app/build/outputs/apk/debug/app-debug.apk`. The shared PICO protocol source is copied from `packages/shared` at build time; the Android client does not maintain a fork of it. Installation of downloaded apps always goes through Android's system confirmation, and the first attempt may open the unknown-app source setting. The client does not persist the PICO session across restarts. This build has been compiled but not yet tried on a headset in the current connection state.

## Cloudflare deployment boundary

`apps/website/wrangler.jsonc` includes a daily cron and static assets. Create a D1 database, apply `apps/website/migrations/0001_release_tracking.sql`, then add the real D1 binding ID to Wrangler before deployment. Do not publish an APK by merely putting it in `public/`; the intended mirror path needs a separately configured R2 bucket and verification pipeline. Release checks keep the highest known version, deduplicate history, and leave the last successful data visible when the upstream check fails.

PICO Store Lab is not affiliated with PICO or VRChat. Product names and app rights belong to their respective owners.
