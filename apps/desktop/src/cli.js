#!/usr/bin/env node
import { stdin, stderr, stdout } from 'node:process';
import { readFile } from 'node:fs/promises';
import {
  makeDownloadInfoRequest, makePublicItemRequest,
  parseDownloadInfo, parsePublicItem,
} from '@pico-store/shared/pico';
import { login, readAuth, saveAuth, sendCode } from './account.js';
import { downloadApk } from './download.js';
import { requestJson } from './transport.js';
import { syncLocalMirror } from './sync.js';

function option(name) {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`${name} is required`);
  return process.argv[index + 1];
}

function promptCode() {
  if (!stdin.isTTY || !stdin.setRawMode) throw new Error('login requires an interactive terminal');
  stderr.write('PICO app verification code: ');
  return new Promise((resolve, reject) => {
    let code = '';
    const wasRaw = stdin.isRaw;
    stdin.setRawMode(true);
    stdin.resume();
    const finish = (error) => {
      stdin.off('data', onData);
      stdin.setRawMode(wasRaw);
      stdin.pause();
      stderr.write('\n');
      error ? reject(error) : resolve(code);
    };
    const onData = chunk => {
      for (const byte of chunk) {
        if (byte === 13 || byte === 10) return finish();
        if (byte === 3) return finish(new Error('cancelled'));
        if (byte === 127 || byte === 8) code = code.slice(0, -1);
        else if (byte >= 32 && byte <= 126 && code.length < 32) code += String.fromCharCode(byte);
      }
    };
    stdin.on('data', onData);
  });
}

async function main() {
  const command = process.argv[2];
  if (command === 'status') {
    const response = await requestJson(makePublicItemRequest());
    stdout.write(`${JSON.stringify(parsePublicItem(response.data), null, 2)}\n`);
  } else if (command === 'send-code') {
    await sendCode(option('--email'));
    stdout.write('PICO app verification email sent.\n');
  } else if (command === 'login') {
    const email = option('--email');
    const path = option('--auth-file');
    const auth = await login(email, await promptCode());
    await saveAuth(path, auth);
    stdout.write(`Private session saved: ${path}\n`);
  } else if (command === 'download') {
    const auth = await readAuth(option('--auth-file'));
    const path = option('--output');
    const response = await requestJson(makeDownloadInfoRequest(auth));
    const info = parseDownloadInfo(response.data);
    const result = await downloadApk(info, path);
    stdout.write(`${JSON.stringify({ packageName: info.packageName, version: info.version, versionCode: info.versionCode, ...result }, null, 2)}\n`);
  } else if (command === 'sync') {
    const auth = await readAuth(option('--auth-file'));
    const config = JSON.parse(await readFile(option('--config'), 'utf8'));
    stdout.write(`${JSON.stringify(await syncLocalMirror(config, auth), null, 2)}\n`);
  } else {
    throw new Error('usage: pico-store <status|send-code|login|download|sync> [--email ADDRESS] [--auth-file PATH] [--output APK] [--config JSON]');
  }
}

main().catch(error => { stderr.write(`error: ${error.message}\n`); process.exitCode = 1; });
