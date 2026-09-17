import { makePublicItemRequest, makeSearchRequest, parseOfficialJson, parsePublicItem, parseSearchResults } from '@nkanf-dev/pico-store-sdk/pico';
import catalog from '../../../contracts/v1/catalog.json' with { type: 'json' };
import { readReleaseState, recordReleaseFailure, recordReleaseSuccess } from './store.js';

export async function checkForRelease(env, fetchImpl = fetch, now = () => new Date(), target = catalog[0]) {
  if (!env.DB) throw new Error('D1 DB binding is required for release tracking');
  const startedAt = now().toISOString();
  let product;
  try {
    const request = makePublicItemRequest({}, target);
    const response = await fetchImpl(request.url, { ...request, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('PICO public item HTTP error');
    product = parsePublicItem(parseOfficialJson(await response.text()), target);
  } catch {
    await recordReleaseFailure(env.DB, startedAt, now().toISOString(), target.itemId);
    return { ok: false, state: await readReleaseState(env.DB, target.itemId) };
  }
  await recordReleaseSuccess(env.DB, product, now().toISOString());
  return { ok: true, state: await readReleaseState(env.DB, target.itemId) };
}

export default {
  async scheduled(_controller, env) {
    for (const target of catalog) await checkForRelease(env, fetch, () => new Date(), target);
  },

  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/search') {
      if (request.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });
      const word = url.searchParams.get('q')?.trim() ?? '';
      if (!word || word.length > 100) return Response.json({ error: 'invalid_search_query' }, { status: 400 });
      try {
        const spec = makeSearchRequest(word);
        const upstream = await fetch(spec.url, { ...spec, signal: AbortSignal.timeout(15000) });
        if (!upstream.ok) throw new Error('upstream search unavailable');
        return Response.json(parseSearchResults(parseOfficialJson(await upstream.text())), {
          headers: { 'Cache-Control': 'public, max-age=60' },
        });
      } catch {
        return Response.json({ error: 'search_unavailable' }, { status: 502 });
      }
    }
    if (url.pathname === '/api/item') {
      if (request.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });
      const target = { itemId: url.searchParams.get('itemId') ?? '', packageName: url.searchParams.get('package') ?? '' };
      try {
        const spec = makePublicItemRequest({}, target);
        const upstream = await fetch(spec.url, { ...spec, signal: AbortSignal.timeout(15000) });
        if (!upstream.ok) throw new Error('upstream item unavailable');
        return Response.json(parsePublicItem(parseOfficialJson(await upstream.text()), target), {
          headers: { 'Cache-Control': 'public, max-age=60' },
        });
      } catch {
        return Response.json({ error: 'item_unavailable' }, { status: 502 });
      }
    }
    if (url.pathname === '/api/releases' || url.pathname === '/api/catalog') {
      if (request.method !== 'GET') return new Response('Method Not Allowed', { status: 405 });
      if (!env.DB) return Response.json({ error: 'release_database_not_configured' }, { status: 503 });
      try {
        const selected = catalog.find(item => item.itemId === url.searchParams.get('itemId')) ?? catalog[0];
        const state = url.pathname === '/api/catalog'
          ? await Promise.all(catalog.map(async item => ({ ...item, state: await readReleaseState(env.DB, item.itemId) })))
          : await readReleaseState(env.DB, selected.itemId);
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
