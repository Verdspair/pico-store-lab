# PICO Store Lab — Rust SDK

Typed PICO store client for search, item lookup, email sign-in, authenticated download metadata and verified APK acquisition. Protocol builders, response validators, mirror policy and a replaceable transport are public. The Desktop CLI calls this SDK.

First public source release: GitHub. crates.io publication is planned for a later release pass.

```rust
use pico_store_lab::{PicoStoreClient, StoreTarget};

let client = PicoStoreClient::default();
let found = client.search("YouTube VR", 1)?.items.remove(0);
let target = StoreTarget::new(&found.item_id, &found.package_name, "")?;
client.item(&target)?;
client.send_code(&email)?;
let auth = client.login(&email, &code_from_user)?;
client.download(&target, &auth, std::path::Path::new("selected-app.apk"))?;
```

Your UI supplies `email` and `code_from_user`. For command-line usage, see the [player guide](https://github.com/nkanf-dev/pico-store-lab#player-guide).
