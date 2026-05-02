import { test } from 'node:test';
import assert from 'node:assert/strict';
import { opCompare } from '../dist/ops/compare.js';

class StubClient {
  constructor(pricesByCountry) { this.pricesByCountry = pricesByCountry; }
  async apiGet(country, path) {
    const prices = this.pricesByCountry[country] ?? [];
    return {
      items: prices.map((p, i) => ({
        id: i + 1, title: `t${i}`,
        price: { amount: String(p), currency_code: 'EUR' },
        user: { id: i + 1, login: `u${i}` },
      })),
      pagination: { total_entries: prices.length },
    };
  }
}

test('opCompare computes median, spread, best buy/sell', async () => {
  const c = new StubClient({
    fr: [10, 20, 30],
    de: [50, 60, 70],
    it: [25, 25, 25],
  });
  const r = await opCompare(c, { query: 'x', countries: ['fr', 'de', 'it'] });
  assert.equal(r.bestBuyCountry, 'fr');
  assert.equal(r.bestSellCountry, 'de');
  assert.equal(r.countries.length, 3);
  const fr = r.countries.find((s) => s.country === 'fr');
  assert.equal(fr.medianPrice, 20);
  assert.equal(fr.minPrice, 10);
  assert.equal(fr.maxPrice, 30);
  // spread = (60 - 20) / 20 * 100 = 200
  assert.equal(r.arbitrageSpreadPct, 200);
});

test('opCompare drops countries with no items', async () => {
  const c = new StubClient({ fr: [10], de: [] });
  const r = await opCompare(c, { query: 'x', countries: ['fr', 'de'] });
  assert.equal(r.countries.length, 1);
  assert.equal(r.countries[0].country, 'fr');
});

test('opCompare returns empty when nothing found', async () => {
  const c = new StubClient({});
  const r = await opCompare(c, { query: 'x', countries: ['fr'] });
  assert.equal(r.countries.length, 0);
  assert.equal(r.bestBuyCountry, null);
  assert.equal(r.arbitrageSpreadPct, 0);
});

test('opCompare validates query', async () => {
  await assert.rejects(() => opCompare(new StubClient({}), { query: '   ' }), /query is required/);
});
