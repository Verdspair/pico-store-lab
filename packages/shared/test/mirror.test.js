import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_MIRROR_POLICY, mirrorDecision } from '../src/mirror.js';

test('default selects free APKs below the size threshold', () => {
  assert.equal(DEFAULT_MIRROR_POLICY.enabled, true);
  assert.equal(mirrorDecision({ price: '0', size: 333878865 }).eligible, true);
  assert.equal(mirrorDecision({ price: '1', size: 333878865 }).eligible, false);
  assert.equal(mirrorDecision({ price: '0', size: DEFAULT_MIRROR_POLICY.maxBytes + 1 }).eligible, false);
});

test('operator can disable mirroring or change price and size rules', () => {
  assert.equal(mirrorDecision({ price: '0', size: 1 }, { enabled: false }).reason, 'disabled');
  assert.equal(mirrorDecision({ price: '2', size: 700000000 }, { freeOnly: false, maxBytes: 800000000 }).eligible, true);
});
