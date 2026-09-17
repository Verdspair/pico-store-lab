# PICO Store Lab — TypeScript SDK

Strictly typed PICO store protocol builders, response validators, release transitions, and mirror policy. The SDK is transport-independent and powers the Website in this monorepo.

```ts
import { makePublicItemRequest, parseOfficialJson, parsePublicItem } from '@nkanf-dev/pico-store-sdk';

const spec = makePublicItemRequest();
const response = await fetch(spec.url, spec);
const item = parsePublicItem(parseOfficialJson(await response.text()));
console.log(item.versionCode);
```

This first release distributes source and build artifacts through GitHub. npm registry publication is planned for a later pass. The SDK does not make requests or store credentials by itself.
