import { makePublicItemRequest, parseOfficialJson, parsePublicItem } from '@pico-store/shared/pico';
import { readReleaseState, recordReleaseFailure, recordReleaseSuccess } from './store.js';

export async function checkForRelease(env, fetchImpl = fetch, now = () => new Date()) {
  if (!env.DB) throw new Error('D1 DB binding is required for release tracking');
  const startedAt = now().toISOString();
  let product;
  try {
    const request = makePublicItemRequest();
    const response = await fetchImpl(request.url, { ...request, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('PICO public item HTTP error');
    product = parsePublicItem(parseOfficialJson(await response.text()));
  } catch {
    await recordReleaseFailure(env.DB, startedAt, now().toISOString());
    return { ok: false, state: await readReleaseState(env.DB) };
  }
  await recordReleaseSuccess(env.DB, product, now().toISOString());
  return { ok: true, state: await readReleaseState(env.DB) };
}

export default {
  async scheduled(_controller, env) {
    await checkForRelease(env);
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/releases') {
      if (request.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });
      if (!env.DB) return Response.json({ error: 'release_database_not_configured' }, { status: 503 });
      try {
        const state = await readReleaseState(env.DB);
        return Response.json(state ?? { stale: true, releases: [], latestVersionCode: null }, {
          headers: { 'Cache-Control': 'no-store' },
        });
      } catch {
        return Response.json({ error: 'release_database_unavailable' }, { status: 503 });
      }
    }
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Not Found', { status: 404 });
  },
};
