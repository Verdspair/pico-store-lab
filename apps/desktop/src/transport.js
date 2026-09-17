import { parseOfficialJson } from '@pico-store/shared/pico';

export async function requestJson(request, fetchImpl = fetch, retries = 3) {
  let error;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchImpl(request.url, { ...request, signal: AbortSignal.timeout(25000) });
      if (!response.ok) {
        if (response.status < 500 && response.status !== 429) {
          throw new Error(`PICO HTTP ${response.status}`);
        }
        error = new Error(`PICO temporary HTTP ${response.status}`);
      } else {
        return { data: parseOfficialJson(await response.text()), headers: response.headers };
      }
    } catch (caught) {
      error = caught;
      if (String(caught.message).startsWith('PICO HTTP ')) throw caught;
    }
    if (attempt < retries) await new Promise(resolve => setTimeout(resolve, Math.min(attempt * 1000, 5000)));
  }
  throw new Error(`PICO request failed after ${retries} attempt(s): ${error?.message ?? 'network error'}`);
}
