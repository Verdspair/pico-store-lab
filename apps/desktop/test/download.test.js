import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { downloadApk } from '../src/download.js';

const bytes = Buffer.from('PK\x03\x04pico-test-apk');
const md5 = createHash('md5').update(bytes).digest('hex');
const metadata = { url: 'https://cdn.example.test/app.apk', size: bytes.length + 8204, md5 };

test('official digest can validate a CDN file smaller than advertised metadata size', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pico-download-test-'));
  try {
    const path = join(directory, 'test.apk');
    const result = await downloadApk(metadata, path, async () => new Response(bytes), 1);
    assert.equal(result.size, bytes.length);
    assert.deepEqual(await readFile(path), bytes);
  } finally { await rm(directory, { recursive: true }); }
});

test('download safely resumes a partial APK with a matching content range', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pico-download-test-'));
  try {
    const path = join(directory, 'test.apk');
    await writeFile(path, bytes.subarray(0, 5));
    const result = await downloadApk(metadata, path, async (_url, options) => {
      assert.equal(options.headers.Range, 'bytes=5-');
      return new Response(bytes.subarray(5), { status: 206, headers: { 'Content-Range': `bytes 5-${bytes.length - 1}/${bytes.length}` } });
    }, 1);
    assert.equal(result.md5, md5);
    assert.deepEqual(await readFile(path), bytes);
  } finally { await rm(directory, { recursive: true }); }
});
