import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PicoStoreClient } from '../dist/client.js';
import { parseOfficialJson } from '../dist/pico.js';

const fixture = JSON.parse(readFileSync(new URL('../../../contracts/v1/fixtures.json', import.meta.url)));

test('SDK composes search, item, account and download metadata', async () => {
  const seen = [];
  const client = new PicoStoreClient({}, async (request, retries) => {
    assert.ok(retries > 0);
    seen.push(request.url);
    const headers = new Headers();
    if (request.url.includes('code_login')) {
      headers.append('Set-Cookie', 'sessionid=abc; Path=/');
      headers.set('x-tt-token', 'token');
      return { data: { message: 'success', data: { user_id_str: '123' } }, headers };
    }
    if (request.url.includes('send_code')) return { data: { message: 'success' }, headers };
    if (request.url.includes('search/aggregation')) return { data: { code: 0, data: { search_list: [
      { items: [{ item_id: fixture.itemId, package_name: fixture.packageName }] },
    ] } }, headers };
    if (request.url.includes('item/info')) return { data: parseOfficialJson(fixture.publicResponse), headers };
    return { data: parseOfficialJson(fixture.downloadResponse), headers };
  });
  const result = await client.search('sample');
  const target = result.items[0];
  assert.equal(target.itemId, fixture.itemId);
  assert.equal((await client.item(target)).versionCode, fixture.versionCode);
  await client.sendCode('test@example.com');
  const auth = await client.login('test@example.com', '123456');
  assert.equal(auth.cookies.sessionid, 'abc');
  assert.equal((await client.downloadInfo(target, auth)).size, fixture.apkSize);
  assert.equal(seen.length, 5);
});

test('SDK uses configured identity and acquires a free offer before download metadata', async () => {
  const calls = [];
  let owned = false;
  const target = { itemId: fixture.itemId, packageName: fixture.packageName, name: 'Sample' };
  const client = new PicoStoreClient({ deviceName: 'CustomDevice', language: 'en', zone: 'UTC', webRegion: 'us' }, async request => {
    const url = new URL(request.url);
    calls.push(url.pathname);
    assert.equal(url.searchParams.get('device_name'), 'CustomDevice');
    assert.equal(url.searchParams.get('app_language'), 'en');
    const headers = new Headers();
    if (url.pathname.endsWith('/item/info')) return { data: {
      code: 0, data: { item_id: fixture.itemId, package_name: fixture.packageName,
        name: 'Sample', version_code: fixture.versionCode, price: '0', currency: 'JPY',
        entitlement_status: owned ? 1 : 2, is_offer_exist: true },
    }, headers };
    if (url.pathname.endsWith('/item/price')) {
      assert.equal(JSON.parse(request.body).is_free_entitlment, true);
      owned = true;
      return { data: { code: 0, data: { free: true, order_id: '42' } }, headers };
    }
    return { data: parseOfficialJson(fixture.downloadResponse), headers };
  });
  const auth = { uid: '123', x_tt_token: 'token' };
  assert.equal((await client.ensureEntitlement(target, auth)).officialUrl,
    `https://store-global.picoxr.com/us/detail/1/${fixture.itemId}`);
  assert.equal((await client.downloadInfo(target, auth)).versionCode, fixture.versionCode);
  assert.deepEqual(calls, ['/api/app/v1/item/info', '/api/app/v1/item/price',
    '/api/app/v1/item/info', '/api/app/v1/download/info']);
});

test('missing order ID rechecks committed entitlement', async () => {
  let owned = false;
  const target = { itemId: fixture.itemId, packageName: fixture.packageName, name: 'Sample' };
  const client = new PicoStoreClient({}, async request => {
    const headers = new Headers();
    if (request.url.includes('/item/info')) return { data: { code: 0, data: {
      item_id: fixture.itemId, package_name: fixture.packageName, name: 'Sample',
      version_code: fixture.versionCode,
      price: '0', currency: 'JPY', entitlement_status: owned ? 1 : 2, is_offer_exist: true,
    } }, headers };
    owned = true;
    return { data: { code: 0, data: { free: true } }, headers };
  });
  assert.equal((await client.ensureEntitlement(target, { uid: '123', x_tt_token: 'token' })).entitlementStatus, 1);
});
