# PICO Store Lab — TypeScript SDK

Strictly typed PICO store protocol builders, response validators, release transitions, and mirror policy. The SDK is transport-independent and powers the Website in this monorepo.

```ts
import { makeSearchRequest, parseOfficialJson, parseSearchResults } from '@nkanf-dev/pico-store-sdk';

const spec = makeSearchRequest('YouTube VR');
const response = await fetch(spec.url, spec);
const results = parseSearchResults(parseOfficialJson(await response.text()));
console.log(results.items[0]);
```

This first release distributes source and build artifacts through GitHub. npm registry publication is planned for a later pass. The SDK does not make requests or store credentials by itself.

For a complete email sign-in → authorized download → installation example, use the [player guide](https://github.com/nkanf-dev/pico-store-lab#player-guide) and the Rust/Python CLIs or Android client. Search results supply exact item IDs and package names for subsequent item and download requests.
