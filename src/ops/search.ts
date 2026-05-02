import { VintedClient } from '../client/session.js';
import { searchItems } from '../client/endpoints.js';
import type { SearchParams, SearchResult } from '../client/types.js';

export async function opSearch(client: VintedClient, p: SearchParams): Promise<SearchResult> {
  if (!p.query?.trim()) throw new Error('query is required');
  return searchItems(client, p);
}

export async function opSearchAll(
  client: VintedClient,
  p: SearchParams & { maxItems?: number; maxPages?: number },
): Promise<SearchResult> {
  if (!p.query?.trim()) throw new Error('query is required');
  const perPage = Math.min(p.perPage ?? 96, 100);
  const maxItems = p.maxItems ?? 1000;
  const maxPages = p.maxPages ?? 25;

  const seen = new Set<number>();
  const items: SearchResult['items'] = [];
  let page = p.page ?? 1;
  let totalCount = 0;

  while (page <= maxPages && items.length < maxItems) {
    const r = await searchItems(client, { ...p, perPage, page });
    if (r.totalCount > totalCount) totalCount = r.totalCount;
    if (!r.items.length) break;

    let added = 0;
    for (const it of r.items) {
      if (seen.has(it.id)) continue;
      seen.add(it.id);
      items.push(it);
      added++;
      if (items.length >= maxItems) break;
    }
    if (added === 0) break; // no new items → end of stream
    page++;
  }

  return { totalCount: totalCount || items.length, page: 1, items };
}
