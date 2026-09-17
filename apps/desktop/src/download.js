import { createReadStream } from 'node:fs';
import { open, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';

export async function fileMd5(path) {
  const hash = createHash('md5');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

async function sizeIfExists(path) {
  try { return (await stat(path)).size; }
  catch (error) { if (error.code === 'ENOENT') return 0; throw error; }
}

export async function downloadApk(metadata, path, fetchImpl = fetch, retries = 8) {
  if (new URL(metadata.url).protocol !== 'https:') throw new Error('APK URL must use HTTPS');
  if (!path.toLowerCase().endsWith('.apk')) throw new Error('output path must end in .apk');
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const start = await sizeIfExists(path);
    if (start > metadata.size) throw new Error('existing partial APK exceeds metadata size');
    if (start && await fileMd5(path) === metadata.md5) {
      return { path, size: start, expectedSize: metadata.size, md5: metadata.md5 };
    }
    const headers = start ? { Range: `bytes=${start}-` } : {};
    try {
      const response = await fetchImpl(metadata.url, { headers, signal: AbortSignal.timeout(60000) });
      if (response.status === 416) throw new Error('CDN ended before the advertised size');
      if (start && (response.status !== 206 || !response.headers.get('content-range')?.startsWith(`bytes ${start}-`))) {
        throw new Error('CDN refused a safe resume range');
      }
      if (!start && !response.ok) throw new Error(`CDN HTTP ${response.status}`);
      const handle = await open(path, start ? 'a' : 'w');
      try {
        for await (const chunk of response.body) {
          let offset = 0;
          while (offset < chunk.length) {
            const { bytesWritten } = await handle.write(chunk, offset, chunk.length - offset);
            if (!bytesWritten) throw new Error('APK write made no progress');
            offset += bytesWritten;
          }
        }
      } finally { await handle.close(); }
      const actual = await sizeIfExists(path);
      if (actual && await fileMd5(path) === metadata.md5) {
        return { path, size: actual, expectedSize: metadata.size, md5: metadata.md5 };
      }
      if (actual >= metadata.size) throw new Error('APK digest mismatch');
    } catch (error) {
      if (attempt === retries || /safe resume|digest mismatch|exceeds metadata/.test(error.message)) throw error;
    }
    if (attempt < retries) await new Promise(resolve => setTimeout(resolve, Math.min(attempt * 1000, 5000)));
  }
  throw new Error('APK download incomplete');
}
