# PICO Store Lab — Python SDK

Typed, standard-library-only PICO store protocol helpers and `pico-store-py` CLI. This package is part of [PICO Store Lab](https://github.com/nkanf-dev/pico-store-lab). It is prepared for a later PyPI release; the first public distribution is on GitHub only.

```python
from pico_store_lab import make_public_item_request, parse_public_item

request = make_public_item_request()
print(request.url)
```

Use `pico-store-py --help` for the CLI. Email sessions remain private; SDK functions do not make network requests implicitly.
