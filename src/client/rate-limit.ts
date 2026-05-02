import type { Country } from './types.js';

interface Bucket {
  tokens: number;
  lastRefill: number;
}

export class TokenBucket {
  private buckets = new Map<Country, Bucket>();

  constructor(
    private capacity: number,
    private refillPerSec: number,
  ) {}

  async take(country: Country): Promise<void> {
    while (true) {
      const b = this.buckets.get(country) ?? { tokens: this.capacity, lastRefill: Date.now() };
      const now = Date.now();
      const elapsed = (now - b.lastRefill) / 1000;
      const refilled = Math.min(this.capacity, b.tokens + elapsed * this.refillPerSec);
      if (refilled >= 1) {
        this.buckets.set(country, { tokens: refilled - 1, lastRefill: now });
        return;
      }
      // wait until at least 1 token will be available
      const waitMs = Math.ceil(((1 - refilled) / this.refillPerSec) * 1000);
      await sleep(waitMs);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
