import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TokenBucket } from '../dist/client/rate-limit.js';

test('TokenBucket allows burst up to capacity then throttles', async () => {
  const b = new TokenBucket(3, 10); // burst 3, refill 10/s
  const t0 = Date.now();
  await b.take('fr'); await b.take('fr'); await b.take('fr');
  const burst = Date.now() - t0;
  assert.ok(burst < 30, `burst should be near-instant, was ${burst}ms`);

  const t1 = Date.now();
  await b.take('fr'); // empty bucket, must wait ~100ms for refill
  const wait = Date.now() - t1;
  assert.ok(wait >= 70, `expected ~100ms wait, got ${wait}ms`);
});

test('TokenBucket isolates buckets per country', async () => {
  const b = new TokenBucket(2, 1);
  await b.take('fr'); await b.take('fr');
  const t0 = Date.now();
  await b.take('de');
  await b.take('de');
  const took = Date.now() - t0;
  assert.ok(took < 30, `de bucket should be unaffected by fr; took ${took}ms`);
});
