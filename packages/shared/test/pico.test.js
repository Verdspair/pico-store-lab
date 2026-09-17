import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACCOUNT_HOST,
  PICO_ITEM_ID,
  PICO_PACKAGE,
  encodeAccountField,
  makeAccountRequest,
  makeDownloadInfoRequest,
  makePublicItemRequest,
  parseDownloadInfo,
  parseOfficialJson,
  parsePublicItem,
} from '../src/pico.js';

test('public item request uses the verified overseas store shape', () => {
  const request = makePublicItemRequest();
  assert.equal(request.method, 'POST');
  assert.equal(new URL(request.url).pathname, '/api/app/v1/item/info');
  assert.equal(new URL(request.url).searchParams.get('device_name'), 'A9210');
  assert.deepEqual(JSON.parse(request.body), { package_name: PICO_PACKAGE });
});

test('public item response accepts only the requested product', () => {
  const item = parsePublicItem({ code: 0, data: {
    item_id: PICO_ITEM_ID, package_name: PICO_PACKAGE, name: 'VRChat',
    version_code: 972240, price: '0', is_offer_exist: true,
  }});
  assert.equal(item.versionCode, 972240);
  assert.equal(item.price, '0');
  assert.throws(() => parsePublicItem({ code: 0, data: { ...item, item_id: 42 } }));
});

test('official JSON keeps the 64-bit item ID exact', () => {
  const parsed = parseOfficialJson('{"data":{"item_id":7288745304105664518}}');
  assert.equal(parsed.data.item_id, PICO_ITEM_ID);
});

test('account fields follow the Matrix XOR-5 encoding', () => {
  assert.equal(encodeAccountField('13'), '3436');
  const request = makeAccountRequest('send-code', 'person@example.com');
  assert.equal(new URL(request.url).host, new URL(ACCOUNT_HOST).host);
  assert.equal(new URLSearchParams(request.body).get('type'), '3436');
  const login = makeAccountRequest('login', 'person@example.com', 'ABC123');
  assert.equal(new URLSearchParams(login.body).get('ect_type'), '13');
  assert.notEqual(new URLSearchParams(login.body).get('code'), 'ABC123');
});

test('authenticated download request and response reject wrong packages', () => {
  const request = makeDownloadInfoRequest({ uid: '123', cookies: { sessionid: 'secret' } });
  assert.equal(new URL(request.url).pathname, '/api/app/v1/download/info');
  assert.equal(request.headers.Cookie, 'sessionid=secret');
  const response = { code: 0, data: { item_id: PICO_ITEM_ID, package: {
    package_name: PICO_PACKAGE, path: 'https://cdn.example.test/app.apk',
    size: 333887069, md5: '30de936aef365fb14a7d6e8d3cd1a5ec',
    version_code: 972240, version: '2026.3.2p2',
  } } };
  assert.equal(parseDownloadInfo(response).versionCode, 972240);
  assert.throws(() => parseDownloadInfo({ ...response, data: { ...response.data, package: { ...response.data.package, package_name: 'com.other' } } }));
});
