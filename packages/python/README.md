# PICO Store Lab — Python SDK

Typed, standard-library-only PICO store client and `pico-store-py` CLI. This package is part of [PICO Store Lab](https://github.com/nkanf-dev/pico-store-lab). It is prepared for a later PyPI release; the first public distribution is on GitHub only.

```python
from pathlib import Path
from pico_store_lab import PicoStoreClient, StoreTarget

client = PicoStoreClient()
found = client.search("YouTube VR").items[0]
target = StoreTarget(found.item_id, found.package_name)
client.item(target)
client.send_code(email)
auth = client.login(email, code_from_user)
client.download(target, auth, Path("selected-app.apk"))
```

`email` and `code_from_user` come from your app's UI. `PicoStoreClient` performs the requests and verified download; pass a custom transport if you need different HTTP behavior. Low-level builders and parsers remain public. Use `pico-store-py --help` for the smaller CLI surface.

The [player guide](https://github.com/nkanf-dev/pico-store-lab#player-guide) gives the complete `search` → `status` → `send-code` → `login` → `download` command sequence, including device installation.
