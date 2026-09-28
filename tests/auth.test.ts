import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeSession, encodeSession, hashLoginToken, newLoginToken } from '../src/lib/auth/token';
import { hashPassword, verifyPassword } from '../src/lib/auth/password';

const SECRET = 'x'.repeat(40);

test('a session round-trips and expires', () => {
  const value = encodeSession({ userId: 'u1', exp: 2_000 }, SECRET);
  assert.deepEqual(decodeSession(value, SECRET, 1_000), { userId: 'u1', exp: 2_000 });
  assert.equal(decodeSession(value, SECRET, 3_000), null);
});

test('a tampered or foreign session is rejected', () => {
  const value = encodeSession({ userId: 'u1', exp: 2_000 }, SECRET);
  const [, sig] = value.split('.');
  const forged = `${Buffer.from(JSON.stringify({ userId: 'u2', exp: 2_000 })).toString('base64url')}.${sig}`;
  assert.equal(decodeSession(forged, SECRET, 1_000), null);
  assert.equal(decodeSession(value, 'y'.repeat(40), 1_000), null);
  assert.equal(decodeSession('garbage', SECRET, 1_000), null);
  assert.equal(decodeSession(undefined, SECRET, 1_000), null);
});

test('login tokens are stored only as their hash', () => {
  const { token, hash } = newLoginToken();
  assert.notEqual(token, hash);
  assert.equal(hashLoginToken(token), hash);
});

test('passwords verify only with the right password', async () => {
  const stored = await hashPassword('correct horse battery');
  assert.equal(await verifyPassword('correct horse battery', stored), true);
  assert.equal(await verifyPassword('wrong horse battery', stored), false);
  assert.equal(await verifyPassword('anything', null), false);
});
