import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { PicoStoreClient } from '../dist/client.js';
import { parseOfficialJson } from '../dist/pico.js';

const fixture = JSON.parse(readFileSync(new URL('../../../contracts/v1/fixtures.json', import.meta.url)));

test('SDK composes search, item, account and download metadata', async () => {
  const seen = [];
  const client = new PicoStoreClient(async (request, retries) => {
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
