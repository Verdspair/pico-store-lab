import assert from 'node:assert/strict';
import test from 'node:test';
import { applyReleaseCheck, markReleaseCheckFailed } from '../src/releases.js';

const product = { itemId: 7288745304105664518, packageName: 'com.vrchat.android', name: 'VRChat', versionCode: 972240, price: '0' };

test('first check creates one release and repeat creates none', () => {
  const first = applyReleaseCheck(null, product, '2026-09-18T00:00:00.000Z');
  assert.equal(first.releases.length, 1);
  const repeat = applyReleaseCheck(first, product, '2026-09-19T00:00:00.000Z');
  assert.equal(repeat.releases.length, 1);
  assert.equal(repeat.lastSuccessfulCheckAt, '2026-09-19T00:00:00.000Z');
});

test('only higher version code appends a release', () => {
  const first = applyReleaseCheck(null, product, '2026-09-18T00:00:00.000Z');
  const lower = applyReleaseCheck(first, { ...product, versionCode: 970060 }, '2026-09-19T00:00:00.000Z');
  assert.equal(lower.releases.length, 1);
  const higher = applyReleaseCheck(lower, { ...product, versionCode: 980000 }, '2026-09-20T00:00:00.000Z');
  assert.deepEqual(higher.releases.map(release => release.versionCode), [972240, 980000]);
});

test('upstream failure keeps the last successful release and marks stale', () => {
  const first = applyReleaseCheck(null, product, '2026-09-18T00:00:00.000Z');
  const stale = markReleaseCheckFailed(first, '2026-09-19T00:00:00.000Z');
  assert.equal(stale.latestVersionCode, 972240);
  assert.equal(stale.releases.length, 1);
  assert.equal(stale.stale, true);
  assert.equal(stale.lastSuccessfulCheckAt, first.lastSuccessfulCheckAt);
});
