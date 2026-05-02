import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VintedClient } from '../dist/client/session.js';
import { opSearch } from '../dist/ops/search.js';

const RUN = process.env.INTEGRATION === '1';

test('live search hits Vinted', { skip: !RUN && 'set INTEGRATION=1 to run' }, async () => {
  const client = new VintedClient();
  const r = await opSearch(client, { query: 'nike', country: 'fr', perPage: 5 });
  assert.ok(r.items.length > 0, 'expected at least one item');
  assert.ok(r.items[0].id, 'item missing id');
});
