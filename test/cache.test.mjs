import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TtlCache } from '../dist/client/cache.js';

test('TtlCache returns set values until TTL', async () => {
  const c = new TtlCache(50);
  c.set('a', 1);
  assert.equal(c.get('a'), 1);
  await new Promise((r) => setTimeout(r, 70));
  assert.equal(c.get('a'), undefined);
});

test('TtlCache evicts oldest beyond maxSize', () => {
  const c = new TtlCache(60_000, 3);
  c.set('a', 1); c.set('b', 2); c.set('c', 3); c.set('d', 4);
  assert.equal(c.get('a'), undefined);
  assert.equal(c.get('d'), 4);
  assert.equal(c.size(), 3);
});

test('TtlCache touch on get refreshes LRU position', () => {
  const c = new TtlCache(60_000, 3);
  c.set('a', 1); c.set('b', 2); c.set('c', 3);
  c.get('a'); // touch a
  c.set('d', 4); // should evict b, not a
  assert.equal(c.get('a'), 1);
  assert.equal(c.get('b'), undefined);
});
