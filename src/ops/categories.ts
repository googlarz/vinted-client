import { VintedClient } from '../client/session.js';
import { getCategories } from '../client/endpoints.js';
import type { Country, CategoryHit } from '../client/types.js';

export async function opCategories(
  client: VintedClient,
  args: { country?: Country; query?: string },
): Promise<CategoryHit[]> {
  const cats = await getCategories(client, args.country ?? 'fr');
  if (args.query) {
    const q = args.query.toLowerCase();
    return cats.filter((c) => c.title.toLowerCase().includes(q));
  }
  return cats;
}
