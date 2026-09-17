import assert from 'node:assert/strict';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { login, readAuth, saveAuth, sendCode } from '../src/account.js';

test('app email code request and login preserve session without logging secrets', async () => {
  await sendCode('person@example.com', async () => Response.json({ message: 'success', data: {} }));
  const headers = new Headers();
  headers.append('Set-Cookie', 'sessionid=abc123; Path=/; HttpOnly');
  headers.append('Set-Cookie', 'uid_tt=456; Path=/; HttpOnly');
  const auth = await login('person@example.com', 'ABC123', async () =>
    new Response('{"message":"success","data":{"user_id":7288745304105664518}}', { headers }));
  assert.equal(auth.uid, '7288745304105664518');
  assert.equal(auth.cookies.sessionid, 'abc123');

  const directory = await mkdtemp(join(tmpdir(), 'pico-auth-test-'));
  try {
    const path = join(directory, 'auth.json');
    await saveAuth(path, auth);
    assert.equal((await stat(path)).mode & 0o777, 0o600);
    assert.deepEqual(await readAuth(path), auth);
    await assert.rejects(saveAuth(path, auth), { code: 'EEXIST' });
  } finally { await rm(directory, { recursive: true }); }
});
