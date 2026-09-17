import { mkdir, rename, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import {
  makeDownloadInfoRequest, makePublicItemRequest,
  parseDownloadInfo, parsePublicItem,
} from '@pico-store/shared/pico';
import { mirrorDecision } from '@pico-store/shared/mirror';
import { downloadApk, fileMd5 } from './download.js';
import { requestJson } from './transport.js';

async function existingMd5(path) {
  try { await stat(path); return await fileMd5(path); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

export async function syncLocalMirror(config, auth, fetchImpl = fetch) {
  if (typeof config?.mirrorDir !== 'string' || !config.mirrorDir.trim()) {
    throw new Error('mirrorDir must be an explicit directory in the config');
  }
  const product = parsePublicItem((await requestJson(makePublicItemRequest(), fetchImpl)).data);
  const metadata = parseDownloadInfo((await requestJson(makeDownloadInfoRequest(auth), fetchImpl)).data);
  const decision = mirrorDecision({ price: product.price, size: metadata.size }, config.mirror);
  if (!decision.eligible) return { status: 'skipped', reason: decision.reason, versionCode: metadata.versionCode };
  const directory = resolve(config.mirrorDir);
  const file = `vrchat-pico-${metadata.versionCode}.apk`;
  const path = join(directory, file);
  const currentDigest = await existingMd5(path);
  if (currentDigest === metadata.md5) {
    return { status: 'already_verified', path, versionCode: metadata.versionCode };
  }
  if (currentDigest !== null) throw new Error('existing mirror APK has a different digest');
  await mkdir(directory, { recursive: true });
  const temporary = join(directory, `vrchat-pico-${metadata.versionCode}.part.apk`);
  await downloadApk(metadata, temporary, fetchImpl);
  await rename(temporary, path);
  return { status: 'mirrored', path, versionCode: metadata.versionCode, md5: metadata.md5 };
}
