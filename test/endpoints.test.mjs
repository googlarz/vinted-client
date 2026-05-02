import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import {
  searchItems, getItem, getSeller, searchSlim,
} from '../dist/client/endpoints.js';

const here = dirname(fileURLToPath(import.meta.url));
const fx = (n) => JSON.parse(readFileSync(resolve(here, 'fixtures', n), 'utf8'));

class FakeClient {
  constructor(byPath) { this.byPath = byPath; this.calls = []; }
  async apiGet(country, path) {
    this.calls.push({ country, path });
    for (const [pattern, payload] of Object.entries(this.byPath)) {
      if (path.startsWith(pattern)) return payload;
    }
    throw new Error(`unmocked: ${path}`);
  }
}

test('searchItems maps payload + builds query', async () => {
  const c = new FakeClient({ '/api/v2/catalog/items': fx('search.json') });
  const r = await searchItems(c, {
    query: 'nike', country: 'fr', priceMin: 10, priceMax: 100,
    condition: ['good'], sortBy: 'price_low_to_high', perPage: 50,
  });
  assert.equal(r.totalCount, 2);
  assert.equal(r.items.length, 2);
  assert.equal(r.items[0].id, 1001);
  assert.equal(r.items[0].price, '45.00');
  assert.equal(r.items[0].currency, 'EUR');
  assert.equal(r.items[0].seller.username, 'alice');

  const path = c.calls[0].path;
  assert.match(path, /search_text=nike/);
  assert.match(path, /price_from=10/);
  assert.match(path, /price_to=100/);
  assert.match(path, /order=price_asc/);
  assert.match(path, /status_ids=3/);
  assert.match(path, /per_page=50/);
});

test('searchItems clamps perPage to 100', async () => {
  const c = new FakeClient({ '/api/v2/catalog/items': fx('search.json') });
  await searchItems(c, { query: 'x', perPage: 999 });
  assert.match(c.calls[0].path, /per_page=100/);
});

test('getItem maps detailed payload', async () => {
  const c = new FakeClient({ '/api/v2/items/1001': fx('item.json') });
  const r = await getItem(c, 1001, 'fr');
  assert.equal(r.id, 1001);
  assert.equal(r.brand, 'Nike');
  assert.equal(r.photos.length, 2);
  assert.equal(r.description, 'Used pair, very clean.');
  assert.equal(r.seller.id, 5001);
});

test('getSeller maps payload', async () => {
  const c = new FakeClient({ '/api/v2/users/5001': fx('seller.json') });
  const r = await getSeller(c, 5001, 'fr');
  assert.equal(r.username, 'alice');
  assert.equal(r.itemCount, 42);
  assert.equal(r.feedbackReputation, 0.98);
  assert.equal(r.profileUrl, 'https://www.vinted.fr/member/5001');
});

test('searchSlim filters non-numeric prices', async () => {
  const c = new FakeClient({
    '/api/v2/catalog/items': {
      items: [
        { id: 1, title: 'a', price: { amount: '20.00', currency_code: 'EUR' }, user: { id: 1, login: 'a' } },
        { id: 2, title: 'b', price: { amount: '0', currency_code: 'EUR' }, user: { id: 2, login: 'b' } },
        { id: 3, title: 'c', price: { amount: 'NaN', currency_code: 'EUR' }, user: { id: 3, login: 'c' } },
      ],
      pagination: { total_entries: 3 },
    },
  });
  const r = await searchSlim(c, 'x', 'fr', 10);
  assert.equal(r.length, 1);
  assert.equal(r[0].price, 20);
});
