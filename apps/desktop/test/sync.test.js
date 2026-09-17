import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { PICO_ITEM_ID } from '@pico-store/shared/pico';
import { syncLocalMirror } from '../src/sync.js';

const bytes = Buffer.from('PK\x03\x04verified-pico-apk');
const md5 = createHash('md5').update(bytes).digest('hex');
const auth = { uid: '42', cookies: { sessionid: 'private' } };

function fakeFetch(url) {
  if (url.includes('/item/info')) return Promise.resolve(new Response(
    `{"code":0,"data":{"item_id":${PICO_ITEM_ID},"package_name":"com.vrchat.android","name":"VRChat","version_code":972240,"price":"0"}}`
  ));
  if (url.includes('/download/info')) return Promise.resolve(new Response(
    `{"code":0,"data":{"item_id":${PICO_ITEM_ID},"package":{"package_name":"com.vrchat.android","path":"https://cdn.example.test/app.apk","size":${bytes.length + 8204},"md5":"${md5}","version_code":972240,"version":"2026.3.2p2"}}}`
  ));
  if (url === 'https://cdn.example.test/app.apk') return Promise.resolve(new Response(bytes));
  throw new Error('unexpected request');
}

test('local sync selects a free APK, verifies it, and is idempotent', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pico-mirror-test-'));
  try {
    const config = { mirrorDir: directory, mirror: { maxBytes: 1024 * 1024 } };
    const first = await syncLocalMirror(config, auth, fakeFetch);
    assert.equal(first.status, 'mirrored');
    assert.deepEqual(await readFile(first.path), bytes);
    const again = await syncLocalMirror(config, auth, fakeFetch);
    assert.equal(again.status, 'already_verified');
    const skipped = await syncLocalMirror({ ...config, mirror: { enabled: false } }, auth, fakeFetch);
    assert.equal(skipped.reason, 'disabled');
  } finally { await rm(directory, { recursive: true }); }
});
