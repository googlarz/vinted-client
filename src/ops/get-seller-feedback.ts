import { VintedClient } from '../client/session.js';
import { getSellerFeedback } from '../client/endpoints.js';
import type { Country } from '../client/types.js';
import type { FeedbackResult } from '../client/endpoints.js';

export async function opGetSellerFeedback(
  client: VintedClient,
  args: { sellerId: number; country?: Country; limit?: number; page?: number },
): Promise<FeedbackResult> {
  return getSellerFeedback(client, args.sellerId, args.country ?? 'fr', args.limit ?? 20, args.page ?? 1);
}
