import { VintedClient } from '../client/session.js';
import { getItem } from '../client/endpoints.js';
import { fetchItemDetailsViaBrowser } from '../client/browser.js';
import type { Country, ItemDetail } from '../client/types.js';
import { COUNTRIES, DOMAIN } from '../client/types.js';

const URL_RE = /vinted\.([a-z.]+)\/.*?(\d+)/i;
const DOMAIN_TO_CC: Record<string, Country> = {
  'fr': 'fr', 'de': 'de', 'co.uk': 'uk', 'it': 'it', 'es': 'es',
  'nl': 'nl', 'pl': 'pl', 'pt': 'pt', 'be': 'be', 'at': 'at',
  'lt': 'lt', 'cz': 'cz', 'sk': 'sk', 'hu': 'hu', 'ro': 'ro',
  'hr': 'hr', 'fi': 'fi', 'dk': 'dk', 'se': 'se',
};

export function parseItemRef(input: { itemId?: number; url?: string; country?: Country }): { id: number; country: Country } {
  if (input.url) {
    const m = input.url.match(URL_RE);
    if (!m) throw new Error(`Invalid Vinted URL: ${input.url}`);
    return { id: Number(m[2]), country: DOMAIN_TO_CC[m[1].toLowerCase()] ?? 'fr' };
  }
  if (input.itemId) {
    const c = input.country ?? 'fr';
    if (!COUNTRIES.includes(c)) throw new Error(`Unknown country: ${c}`);
    return { id: input.itemId, country: c };
  }
  throw new Error('Provide itemId or url');
}

export async function opGetItem(
  client: VintedClient,
  input: { itemId?: number; url?: string; country?: Country; browser?: boolean },
): Promise<ItemDetail> {
  const { id, country } = parseItemRef(input);
  const useBrowser =
    input.browser ?? (process.env.VINTED_BROWSER === '1' || process.env.VINTED_STEALTH === '1');
  if (!useBrowser) return getItem(client, id, country);

  const data: any = await fetchItemDetailsViaBrowser(id, country, { proxyUrl: client.proxyUrl });
  const i = data.item ?? data;
  return {
    id: Number(i.id ?? id),
    title: String(i.title ?? ''),
    price: String(i.price?.amount ?? i.price ?? ''),
    currency: String(i.price?.currency_code ?? i.currency ?? ''),
    brand: i.brand_dto?.title ?? i.brand,
    size: i.size_title ?? i.size,
    condition: i.status,
    description: i.description,
    photos: (i.photos ?? []).map((p: any) => p.full_size_url ?? p.url).filter(Boolean),
    createdAt: i.created_at_ts ?? i.created_at,
    url: i.url ?? `https://${DOMAIN[country]}/items/${id}`,
    favouriteCount: i.favourite_count,
    seller: {
      id: Number(i.user?.id ?? 0),
      username: String(i.user?.login ?? i.user?.username ?? ''),
    },
    raw: i,
  };
}
