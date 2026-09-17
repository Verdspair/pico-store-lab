import { open, readFile, stat } from 'node:fs/promises';
import { makeAccountRequest } from '@pico-store/shared/pico';
import { requestJson } from './transport.js';

function requireSuccess(body) {
  if (body?.message !== 'success') {
    const code = body?.data?.error_code ?? 'unknown';
    throw new Error(`PICO account request rejected (${code})`);
  }
  return body.data ?? {};
}

export async function sendCode(email, fetchImpl = fetch) {
  // A lost response might still mean an email was sent; do not duplicate it automatically.
  const response = await requestJson(makeAccountRequest('send-code', email), fetchImpl, 1);
  requireSuccess(response.data);
}

function cookiesFromHeaders(headers) {
  const lines = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : [];
  if (!lines.length && headers.get('set-cookie')) lines.push(headers.get('set-cookie'));
  const cookies = {};
  for (const line of lines) {
    const pair = line.split(';', 1)[0];
    const equals = pair.indexOf('=');
    if (equals > 0) cookies[pair.slice(0, equals)] = pair.slice(equals + 1);
  }
  return cookies;
}

export async function login(email, code, fetchImpl = fetch) {
  const response = await requestJson(makeAccountRequest('login', email, code), fetchImpl, 1);
  const data = requireSuccess(response.data);
  const cookies = cookiesFromHeaders(response.headers);
  const token = response.headers.get('x-tt-token') ?? '';
  if (!token && !cookies.sessionid && !cookies.sessionid_ss) {
    throw new Error('PICO login did not return a usable app session');
  }
  return {
    uid: String(data.user_id_str ?? data.user_id ?? '0'),
    x_tt_token: token,
    cookies,
  };
}

export async function saveAuth(path, auth) {
  const handle = await open(path, 'wx', 0o600);
  try { await handle.writeFile(JSON.stringify(auth)); }
  finally { await handle.close(); }
}

export async function readAuth(path) {
  const mode = (await stat(path)).mode & 0o777;
  if (mode & 0o077) throw new Error('auth file must not be readable by other users');
  const auth = JSON.parse(await readFile(path, 'utf8'));
  if (!auth || (!auth.x_tt_token && !auth.cookies)) throw new Error('invalid auth file');
  return auth;
}
