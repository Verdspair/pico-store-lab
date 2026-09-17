# PICO Store Lab — Kotlin SDK

Android-compatible Kotlin client for search, item lookup, email sign-in, authenticated download metadata and verified APK acquisition. Protocol builders, validators, mirror policy and a replaceable transport are public. The PICO Android client includes this module directly. Maven publication is planned for a later release pass; the first source release is on GitHub.

```kotlin
val client = PicoStoreClient()
val found = client.search("YouTube VR").first()
val target = StoreTarget(found.itemId, found.packageName)
client.item(target)
client.sendCode(email)
val auth = client.login(email, codeFromUser)
client.download(target, auth, File("selected-app.apk"))
```

Your UI supplies `email` and `codeFromUser`. To install the verified APK on a headset, request Android's normal package-installer confirmation; see the [player guide](https://github.com/nkanf-dev/pico-store-lab#player-guide).
