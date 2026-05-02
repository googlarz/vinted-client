import { test } from 'node:test';
import assert from 'node:assert/strict';
import { opSearchAll } from '../dist/ops/search.js';

function makePages(pages) {
  return {
    apiGet: async (_country, path) => {
      const m = path.match(/[?&]page=(\d+)/);
      const page = Number(m?.[1] ?? 1);
      const items = pages[page - 1] ?? [];
      return {
        items: items.map((id) => ({
          id, title: `t${id}`,
          price: { amount: '10', currency_code: 'EUR' },
          user: { id, login: `u${id}` },
        })),
        pagination: { total_entries: pages.flat().length },
      };
    },
  };
}

test('opSearchAll walks pages and dedupes', async () => {
  const c = makePages([[1, 2, 3], [3, 4, 5], [6]]); // 3 appears twice
  const r = await opSearchAll(c, { query: 'x', perPage: 3 });
  assert.deepEqual(r.items.map((i) => i.id), [1, 2, 3, 4, 5, 6]);
});

test('opSearchAll stops at maxItems', async () => {
  const c = makePages([[1, 2, 3], [4, 5, 6], [7, 8, 9]]);
  const r = await opSearchAll(c, { query: 'x', perPage: 3, maxItems: 4 });
  assert.equal(r.items.length, 4);
});

test('opSearchAll stops on empty page', async () => {
  const c = makePages([[1, 2], []]);
  const r = await opSearchAll(c, { query: 'x', perPage: 2 });
  assert.equal(r.items.length, 2);
});

test('opSearchAll stops when no new items added (loop guard)', async () => {
  const c = makePages([[1, 2, 3], [1, 2, 3]]);
  const r = await opSearchAll(c, { query: 'x', perPage: 3 });
  assert.equal(r.items.length, 3);
});
