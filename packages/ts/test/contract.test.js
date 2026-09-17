import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  makePublicItemRequest, mirrorDecision, parseDownloadInfo, parseOfficialJson, parsePublicItem,
} from '../dist/index.js';

const fixtures = JSON.parse(readFileSync(fileURLToPath(new URL('../../../contracts/v1/fixtures.json', import.meta.url)), 'utf8'));

test('contract fixture matches exact IDs, requests, responses and mirror default', () => {
  assert.equal(JSON.parse(makePublicItemRequest().body).package_name, fixtures.packageName);
  const publicItem = parsePublicItem(parseOfficialJson(fixtures.publicResponse));
  const download = parseDownloadInfo(parseOfficialJson(fixtures.downloadResponse));
  assert.equal(publicItem.itemId, fixtures.itemId);
  assert.equal(publicItem.versionCode, fixtures.versionCode);
  assert.equal(download.size, fixtures.apkSize);
  assert.equal(download.md5, fixtures.md5);
  assert.deepEqual(mirrorDecision({ price: publicItem.price, size: download.size }), { eligible: true, reason: 'eligible' });
});
