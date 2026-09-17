import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PICO_ITEM_ID } from '@nkanf-dev/pico-store-sdk/pico';
import { openLocalD1 } from '../src/local-db.js';
import worker, { checkForRelease } from '../src/worker.js';
import { readReleaseState, recordReleaseFailure, recordReleaseSuccess } from '../src/store.js';

const product = {
  itemId: PICO_ITEM_ID, packageName: 'com.vrchat.android', name: 'VRChat',
  price: '0', officialUrl: 'https://store-global.picoxr.com/jp/detail/1/7288745304105664518',
  versionCode: 972240,
};

test('player path links the website to the repo, guide, and client release', () => {
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const script = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const english = readFileSync(new URL('../../../README.md', import.meta.url), 'utf8');
  const chinese = readFileSync(new URL('../../../README.zh-CN.md', import.meta.url), 'utf8');
  assert.match(html, /href="https:\/\/github\.com\/nkanf-dev\/pico-store-lab"/);
  assert.match(html, /id="guide-link"/);
  assert.match(html, /href="https:\/\/github\.com\/nkanf-dev\/pico-store-lab\/releases\/latest"/);
  assert.match(script, /README\.zh-CN\.md#player-guide/);
  for (const guide of [english, chinese]) {
    assert.match(guide, /<a id="player-guide"><\/a>/);
    assert.match(guide, /send-code --email you@example\.com/);
    assert.match(guide, /search 'YouTube VR'/);
    assert.match(guide, /download --item-id 7270207384512020485/);
  }
});

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

test('tracking stays independent for a second catalog app', async () => {
  const db = openLocalD1();
  const target = { itemId: '7270207384512020485', packageName: 'com.google.android.apps.youtube.vr.pico', name: 'YouTube VR' };
  try {
    const env = { DB: db };
    const response = () => new Response('{"code":0,"data":{"item_id":7270207384512020485,"package_name":"com.google.android.apps.youtube.vr.pico","name":"YouTube VR","version_code":18713000,"price":"0"}}');
    await checkForRelease(env, async () => response(), () => new Date('2026-09-18T02:00:00Z'), target);
    assert.equal((await readReleaseState(db, target.itemId)).latestVersionCode, 18713000);
    assert.equal(await readReleaseState(db), null);
    const api = await worker.fetch(new Request('https://example.test/api/catalog'), env);
    const entries = await api.json();
    assert.equal(entries.length, 3);
    assert.equal(entries[1].state.name, 'YouTube VR');
  } finally { db.close(); }
});

test('atomic writes retain higher version and prevent an old failure from hiding success', async () => {
  const db = openLocalD1();
  try {
    await recordReleaseSuccess(db, product, '2026-09-18T01:00:00Z');
    await recordReleaseSuccess(db, { ...product, versionCode: 980000 }, '2026-09-18T02:00:00Z');
    await recordReleaseSuccess(db, { ...product, name: 'Outdated metadata' }, '2026-09-18T02:30:00Z');
    await recordReleaseFailure(db, '2026-09-18T01:30:00Z', '2026-09-18T03:00:00Z');
    const state = await readReleaseState(db);
    assert.equal(state.latestVersionCode, 980000);
    assert.equal(state.name, 'VRChat');
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
