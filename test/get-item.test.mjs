import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseItemRef } from '../dist/ops/get-item.js';

test('parseItemRef from URL detects country', () => {
  assert.deepEqual(parseItemRef({ url: 'https://www.vinted.fr/items/12345-nike-tee' }), { id: 12345, country: 'fr' });
  assert.deepEqual(parseItemRef({ url: 'https://www.vinted.co.uk/items/777-foo' }), { id: 777, country: 'uk' });
  assert.deepEqual(parseItemRef({ url: 'https://www.vinted.de/items/9-bar' }), { id: 9, country: 'de' });
});

test('parseItemRef from id uses default fr', () => {
  assert.deepEqual(parseItemRef({ itemId: 42 }), { id: 42, country: 'fr' });
  assert.deepEqual(parseItemRef({ itemId: 42, country: 'pl' }), { id: 42, country: 'pl' });
});

test('parseItemRef rejects empty input', () => {
  assert.throws(() => parseItemRef({}), /itemId or url/);
});

test('parseItemRef rejects bogus URL', () => {
  assert.throws(() => parseItemRef({ url: 'https://example.com/items/1' }), /Invalid Vinted URL/);
});
