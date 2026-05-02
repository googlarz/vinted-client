import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveBrandIds } from '../dist/ops/brands.js';

class FakeClient {
  constructor(byKeyword) { this.byKeyword = byKeyword; this.calls = 0; }
  async apiGet(_country, path) {
    this.calls++;
    const m = path.match(/keyword=([^&]+)/);
    const kw = decodeURIComponent(m?.[1] ?? '').toLowerCase();
    return { brands: this.byKeyword[kw] ?? [] };
  }
}

test('resolveBrandIds picks exact title match over first hit', async () => {
  const c = new FakeClient({
    nike: [
      { id: 99, title: 'Nikee', slug: 'nikee' },
      { id: 53, title: 'Nike', slug: 'nike' },
    ],
  });
  const r = await resolveBrandIds(c, ['Nike']);
  assert.deepEqual(r.ids, [53]);
  assert.equal(r.resolved[0].title, 'Nike');
});

test('resolveBrandIds falls back to first hit when no exact', async () => {
  const c = new FakeClient({
    'air max': [{ id: 7, title: 'Nike Air Max', slug: 'nike-air-max' }],
  });
  const r = await resolveBrandIds(c, ['Air Max']);
  assert.deepEqual(r.ids, [7]);
});

test('resolveBrandIds returns unresolved for unknown', async () => {
  const c = new FakeClient({});
  const r = await resolveBrandIds(c, ['no_such_brand_zzz']);
  assert.deepEqual(r.ids, []);
  assert.deepEqual(r.unresolved, ['no_such_brand_zzz']);
});

test('resolveBrandIds caches by country+name', async () => {
  // Unique brand name to avoid cross-test cache hits (cache is module-scoped)
  const c = new FakeClient({ '_cachetest_brand': [{ id: 999, title: '_cachetest_brand', slug: 'x' }] });
  await resolveBrandIds(c, ['_cachetest_brand'], 'de');
  await resolveBrandIds(c, ['_CacheTest_Brand'], 'de');
  await resolveBrandIds(c, ['_CACHETEST_BRAND'], 'de');
  assert.equal(c.calls, 1);
});
