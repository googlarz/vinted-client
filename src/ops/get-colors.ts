import { VintedClient } from '../client/session.js';
import { getColors } from '../client/endpoints.js';
import type { Country } from '../client/types.js';
import type { ColorHit } from '../client/endpoints.js';

export async function opGetColors(
  client: VintedClient,
  args: { country?: Country },
): Promise<ColorHit[]> {
  return getColors(client, args.country ?? 'fr');
}
