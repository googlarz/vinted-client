import { VintedClient } from '../client/session.js';
import { getSellerItems } from '../client/endpoints.js';
import type { Country, SearchResult } from '../client/types.js';

export async function opSellerItems(
  client: VintedClient,
  args: { sellerId: number; country?: Country; limit?: number; page?: number },
): Promise<SearchResult> {
  return getSellerItems(client, args.sellerId, args.country ?? 'fr', args.limit ?? 20, args.page ?? 1);
}
