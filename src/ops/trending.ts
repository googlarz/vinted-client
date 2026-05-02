import { VintedClient } from '../client/session.js';
import { searchItems } from '../client/endpoints.js';
import type { Country, Item } from '../client/types.js';

export interface TrendingResult {
  country: Country;
  items: Item[];
}

export async function opTrending(
  client: VintedClient,
  input: { country?: Country; categoryId?: number; limit?: number },
): Promise<TrendingResult> {
  const country = input.country ?? 'fr';
  const r = await searchItems(client, {
    query: '',
    country,
    categoryId: input.categoryId,
    perPage: Math.min(input.limit ?? 20, 100),
    sortBy: 'newest_first',
  });
  return { country, items: r.items };
}
