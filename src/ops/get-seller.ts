import { VintedClient } from '../client/session.js';
import { getSeller } from '../client/endpoints.js';
import type { Country, Seller } from '../client/types.js';

export async function opGetSeller(
  client: VintedClient,
  input: { sellerId: number; country?: Country },
): Promise<Seller> {
  if (!input.sellerId) throw new Error('sellerId is required');
  return getSeller(client, input.sellerId, input.country ?? 'fr');
}
