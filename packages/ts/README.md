# PICO Store Lab — TypeScript SDK

Strictly typed PICO store client, protocol builders, response validators, release transitions, and mirror policy. The SDK powers the Website in this monorepo; the full client uses Node.js for verified file downloads and accepts a custom request transport.

```ts
import { PicoStoreClient } from '@nkanf-dev/pico-store-sdk/client';

const client = new PicoStoreClient();
const target = (await client.search('YouTube VR')).items[0];
await client.item(target);
await client.sendCode(email);
const auth = await client.login(email, codeFromUser);
await client.download(target, auth, './selected-app.apk');
```

`email` and `codeFromUser` come from your app's UI. The high-level client performs network requests only when its methods are called. You can inject a transport; the low-level protocol API stays public. This first release distributes source and build artifacts through GitHub. npm registry publication is planned for a later pass.

Device installation remains an Android system operation; see the [player guide](https://github.com/nkanf-dev/pico-store-lab#player-guide).
