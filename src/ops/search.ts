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
  const PREFETCH = 3; // pages to keep in-flight concurrently

  const seen = new Set<number>();
  const items: SearchResult['items'] = [];
  let nextPage = p.page ?? 1;
  let totalCount = 0;

  // Sliding window of in-flight page requests
  const pending: Array<Promise<SearchResult>> = [];

  const enqueue = () => {
    while (pending.length < PREFETCH && nextPage <= maxPages && items.length < maxItems) {
      pending.push(searchItems(client, { ...p, perPage, page: nextPage++ }));
    }
  };

  enqueue();

  while (pending.length > 0) {
    const r = await pending.shift()!;
    if (r.totalCount > totalCount) totalCount = r.totalCount;
    if (!r.items.length) {
      pending.length = 0; // drain: no point fetching further pages
      break;
    }

    let added = 0;
    for (const it of r.items) {
      if (seen.has(it.id)) continue;
      seen.add(it.id);
      items.push(it);
      added++;
      if (items.length >= maxItems) break;
    }
    if (items.length >= maxItems || added === 0) {
      pending.length = 0; // hit limit or end of stream — discard remaining in-flight
      break;
    }

    enqueue(); // top up the window
  }

  return { totalCount: totalCount || items.length, page: 1, items };
}
