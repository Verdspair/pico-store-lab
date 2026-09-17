export const PICO_ITEM_ID = '7288745304105664518';
export const PICO_PACKAGE = 'com.vrchat.android';
export const STORE_HOST = 'https://appstore-us.picoxr.com';
export const ACCOUNT_HOST = 'https://matrix-us.picovr.com';
export const OFFICIAL_STORE_URL = `https://store-global.picoxr.com/jp/detail/1/${PICO_ITEM_ID}`;

const STORE_VERSION = '400900005';
const DEVICE_NAME = 'A9210';

export interface RequestSpec {
  url: string;
  method: 'POST';
  headers: Record<string, string>;
  body: string;
}

export interface StoreOptions {
  uid?: string;
  language?: string;
  zone?: string;
}

export interface PicoAuth {
  uid?: string;
  x_tt_token?: string;
  cookies?: Record<string, string>;
}

export interface PublicItem {
  itemId: string;
  packageName: string;
  name: string;
  versionCode: number;
  price: string;
  currency: string;
  iconUrl: string | null;
  officialUrl: string;
}

export interface DownloadInfo {
  itemId: string;
  packageName: string;
  versionCode: number;
  version: string;
  size: number;
  md5: string;
  url: string;
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid PICO response');
  return value as Record<string, unknown>;
}

export function parseOfficialJson(text: string): unknown {
  // PICO IDs exceed JS Number.MAX_SAFE_INTEGER; the JSON token source is exact.
  return JSON.parse(text, (key: string, value: unknown, context?: { source?: string }) => {
    if (['item_id', 'user_id', 'uid'].includes(key) && typeof value === 'number') {
      if (!context?.source) throw new Error('lossless ID parsing is unavailable');
      return context.source;
    }
    return value;
  });
}

function storeUrl(path: string, options: StoreOptions = {}): string {
  const url = new URL(path, STORE_HOST);
  const params = {
    manifest_version_code: STORE_VERSION,
    device_name: DEVICE_NAME,
    uid: String(options.uid ?? '0'),
    app_id: '314431',
    app_language: options.language ?? 'ja',
    client_type: '1',
    zone_name: options.zone ?? 'Asia/Shanghai',
    timestamp: String(Math.floor(Date.now() / 1000)),
  };
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

function storeHeaders(language = 'ja'): Record<string, string> {
  return { 'Content-Type': 'application/json', Locale: language };
}

export function makePublicItemRequest(options: StoreOptions = {}): RequestSpec {
  return {
    url: storeUrl('/api/app/v1/item/info', options),
    method: 'POST',
    headers: storeHeaders(options.language),
    body: JSON.stringify({ package_name: PICO_PACKAGE }),
  };
}

function checkItem(data: Record<string, unknown>): void {
  if (String(data.item_id) !== PICO_ITEM_ID || data.package_name !== PICO_PACKAGE) {
    throw new Error('PICO returned an unexpected item or package');
  }
}

export function parsePublicItem(response: unknown): PublicItem {
  const root = object(response);
  if (root.code !== 0) throw new Error(`PICO item lookup failed: ${String(root.code ?? 'invalid response')}`);
  const data = object(root.data);
  checkItem(data);
  if (!Number.isSafeInteger(data.version_code) || (data.version_code as number) <= 0) {
    throw new Error('PICO returned an invalid version code');
  }
  return {
    itemId: PICO_ITEM_ID,
    packageName: PICO_PACKAGE,
    name: String(data.name || 'VRChat'),
    versionCode: data.version_code as number,
    price: String(data.price ?? ''),
    currency: String(data.currency ?? ''),
    iconUrl: typeof data.icon === 'string' && data.icon.startsWith('https://') ? data.icon : null,
    officialUrl: OFFICIAL_STORE_URL,
  };
}

export function encodeAccountField(value: string): string {
  return [...new TextEncoder().encode(value)]
    .map(byte => (byte ^ 5).toString(16).padStart(2, '0')).join('');
}

export function makeAccountRequest(kind: 'send-code' | 'login', email: string, code?: string): RequestSpec {
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('valid email required');
  if (kind === 'login' && !code) throw new Error('verification code required');
  const path = kind === 'send-code' ? '/passport/email/send_code/' : '/passport/app/email/code_login/';
  const url = new URL(path, ACCOUNT_HOST);
  for (const [key, value] of Object.entries({
    multi_login: '1', account_sdk_source: 'app', 'passport-sdk-version': '30490',
    aid: '308733', device_platform: 'android',
  })) url.searchParams.set(key, value);
  const fields: Record<string, string> = kind === 'send-code'
    ? { email: encodeAccountField(email), type: encodeAccountField('13'), email_logic_type: '0', mix_mode: '1' }
    : { email: encodeAccountField(email), ect_type: '13', code: encodeAccountField(code ?? ''), mix_mode: '1', email_logic_type: '0' };
  return { url: url.toString(), method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields).toString() };
}

export function makeDownloadInfoRequest(auth: PicoAuth, options: StoreOptions = {}): RequestSpec {
  if (!auth || (!auth.x_tt_token && !auth.cookies)) throw new Error('authenticated PICO session required');
  const headers = storeHeaders(options.language);
  if (auth.x_tt_token) headers['X-Tt-Token'] = auth.x_tt_token;
  if (auth.cookies) headers.Cookie = Object.entries(auth.cookies).map(([key, value]) => `${key}=${value}`).join('; ');
  return {
    url: storeUrl('/api/app/v1/download/info', { ...options, uid: auth.uid ?? '0' }),
    method: 'POST',
    headers,
    body: `{"item_id":${PICO_ITEM_ID},"package_name":"${PICO_PACKAGE}"}`,
  };
}

export function parseDownloadInfo(response: unknown): DownloadInfo {
  const root = object(response);
  if (root.code !== 0) throw new Error(`PICO download info failed: ${String(root.code ?? 'invalid response')}`);
  const data = object(root.data);
  const pkg = object(data.package);
  if (String(data.item_id) !== PICO_ITEM_ID || pkg.package_name !== PICO_PACKAGE) {
    throw new Error('PICO returned an unexpected download package');
  }
  if (!Number.isSafeInteger(pkg.version_code) || (pkg.version_code as number) <= 0 ||
      !Number.isSafeInteger(pkg.size) || (pkg.size as number) <= 0 ||
      typeof pkg.md5 !== 'string' || !/^[a-f0-9]{32}$/i.test(pkg.md5) ||
      typeof pkg.path !== 'string' || !pkg.path.startsWith('https://')) {
    throw new Error('PICO returned incomplete APK metadata');
  }
  return {
    itemId: PICO_ITEM_ID, packageName: PICO_PACKAGE,
    versionCode: pkg.version_code as number, version: String(pkg.version ?? ''),
    size: pkg.size as number, md5: pkg.md5.toLowerCase(), url: pkg.path,
  };
}
