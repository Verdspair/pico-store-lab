import assert from 'node:assert/strict';
import test from 'node:test';
import { PICO_ITEM_ID } from '@pico-store/shared/pico';
import { openLocalD1 } from '../src/local-db.js';
import worker, { checkForRelease } from '../src/worker.js';
import { readReleaseState, recordReleaseFailure, recordReleaseSuccess } from '../src/store.js';

const product = {
  itemId: PICO_ITEM_ID, packageName: 'com.vrchat.android', name: 'VRChat',
  price: '0', officialUrl: 'https://store-global.picoxr.com/jp/detail/1/7288745304105664518',
  versionCode: 972240,
};

function publicResponse(versionCode = 972240) {
  const body = `{"code":0,"data":{"item_id":${PICO_ITEM_ID},"package_name":"com.vrchat.android","name":"VRChat","price":"0","version_code":${versionCode}}}`;
  return new Response(body, { status: 200 });
}

test('scheduled check stores and serves a public release snapshot', async () => {
  const db = openLocalD1();
  try {
    const env = { DB: db };
    const result = await checkForRelease(env, async () => publicResponse(), () => new Date('2026-09-18T01:00:00Z'));
    assert.equal(result.ok, true);
    assert.equal(result.state.latestVersionCode, 972240);
    await checkForRelease(env, async () => publicResponse(), () => new Date('2026-09-19T01:00:00Z'));
    const response = await worker.fetch(new Request('https://example.test/api/releases'), env);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).releases.length, 1);
  } finally { db.close(); }
});

test('atomic writes retain higher version and prevent an old failure from hiding success', async () => {
  const db = openLocalD1();
  try {
    await recordReleaseSuccess(db, product, '2026-09-18T01:00:00Z');
    await recordReleaseSuccess(db, { ...product, versionCode: 980000 }, '2026-09-18T02:00:00Z');
    await recordReleaseSuccess(db, product, '2026-09-18T02:30:00Z');
    await recordReleaseFailure(db, '2026-09-18T01:30:00Z', '2026-09-18T03:00:00Z');
    const state = await readReleaseState(db);
    assert.equal(state.latestVersionCode, 980000);
    assert.deepEqual(state.releases.map(release => release.versionCode), [972240, 980000]);
    assert.equal(state.stale, false);
    await recordReleaseFailure(db, '2026-09-18T03:30:00Z', '2026-09-18T04:00:00Z');
    assert.equal((await readReleaseState(db)).stale, true);
  } finally { db.close(); }
});

test('unconfigured release database does not claim a live result', async () => {
  const response = await worker.fetch(new Request('https://example.test/api/releases'), {});
  assert.equal(response.status, 503);
});
