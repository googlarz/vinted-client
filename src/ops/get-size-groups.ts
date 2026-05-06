import { VintedClient } from '../client/session.js';
import { getSizeGroups } from '../client/endpoints.js';
import type { Country } from '../client/types.js';
import type { SizeGroup } from '../client/endpoints.js';

export async function opGetSizeGroups(
  client: VintedClient,
  args: { country?: Country },
): Promise<SizeGroup[]> {
  return getSizeGroups(client, args.country ?? 'fr');
}
