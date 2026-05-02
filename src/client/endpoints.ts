import {
  CONDITION_ID, DOMAIN, SORT_VALUE,
  type Country, type Item, type ItemDetail, type SearchParams, type SearchResult, type Seller,
} from './types.js';
import { VintedClient } from './session.js';

function buildSearchPath(p: SearchParams): string {
  const qs = new URLSearchParams();
  qs.set('search_text', p.query);
  qs.set('page', String(p.page ?? 1));
  qs.set('per_page', String(Math.min(p.perPage ?? 20, 100)));
  qs.set('order', SORT_VALUE[p.sortBy ?? 'relevance']);
  if (p.priceMin !== undefined) qs.set('price_from', String(p.priceMin));
  if (p.priceMax !== undefined) qs.set('price_to', String(p.priceMax));
  if (p.categoryId) qs.set('catalog_ids', String(p.categoryId));
  if (p.brandIds?.length) qs.set('brand_ids', p.brandIds.join(','));
  if (p.condition?.length) {
    qs.set('status_ids', p.condition.map((c) => CONDITION_ID[c]).join(','));
  }
  return `/api/v2/catalog/items?${qs.toString()}`;
}

export async function searchItems(client: VintedClient, p: SearchParams): Promise<SearchResult> {
  const country = p.country ?? 'fr';
  const data = await client.apiGet<{
    items: any[];
    pagination?: { total_entries?: number };
  }>(country, buildSearchPath(p));

  const items: Item[] = (data.items ?? []).map((i) => ({
    id: Number(i.id),
    title: String(i.title ?? ''),
    price: String(i.price?.amount ?? i.price ?? ''),
    currency: String(i.price?.currency_code ?? i.currency ?? ''),
    brand: i.brand_title ?? i.brand,
    size: i.size_title ?? i.size,
    condition: i.status,
    url: i.url ?? `https://${DOMAIN[country]}/items/${i.id}`,
    favouriteCount: i.favourite_count,
    photoUrl: i.photo?.url ?? i.photos?.[0]?.url,
    seller: {
      id: Number(i.user?.id ?? 0),
      username: String(i.user?.login ?? i.user?.username ?? ''),
    },
  }));

  return {
    totalCount: data.pagination?.total_entries ?? items.length,
    page: p.page ?? 1,
    items,
  };
}

export async function getItem(
  client: VintedClient,
  itemId: number,
  country: Country = 'fr',
): Promise<ItemDetail> {
  // Path A: official API (often gated by DataDome)
  try {
    const data = await client.apiGet<{ item: any }>(country, `/api/v2/items/${itemId}/details`);
    const i = data.item ?? data;
    return {
      id: Number(i.id),
      title: String(i.title ?? ''),
      price: String(i.price?.amount ?? i.price ?? ''),
      currency: String(i.price?.currency_code ?? i.currency ?? ''),
      brand: i.brand_dto?.title ?? i.brand,
      size: i.size_title ?? i.size,
      condition: i.status,
      description: i.description,
      photos: (i.photos ?? []).map((p: any) => p.full_size_url ?? p.url).filter(Boolean),
      createdAt: i.created_at_ts ?? i.created_at,
      url: i.url ?? `https://${DOMAIN[country]}/items/${itemId}`,
      favouriteCount: i.favourite_count,
      seller: {
        id: Number(i.user?.id ?? 0),
        username: String(i.user?.login ?? i.user?.username ?? ''),
      },
      raw: i,
    };
  } catch (err) {
    // Path B: public HTML page → parse JSON-LD
    return getItemFromHtml(client, itemId, country, err);
  }
}

async function getItemFromHtml(
  client: VintedClient,
  itemId: number,
  country: Country,
  apiErr: unknown,
): Promise<ItemDetail> {
  const url = `https://${DOMAIN[country]}/items/${itemId}`;
  const { status, body } = await client.fetchHtml(url);
  if (status >= 400) {
    const apiMsg = apiErr instanceof Error ? apiErr.message : String(apiErr);
    throw new Error(`Item ${itemId}: API failed (${apiMsg}); HTML fallback returned ${status}.`);
  }
  const ldMatch = body.match(/<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/);
  if (!ldMatch) throw new Error(`Item ${itemId}: no JSON-LD on page`);
  const ld = JSON.parse(ldMatch[1]);

  const titleMatch = body.match(/<title>([^<]+)<\/title>/);

  return {
    id: itemId,
    title: String(ld.name ?? titleMatch?.[1] ?? ''),
    price: String(ld.offers?.price ?? ''),
    currency: String(ld.offers?.priceCurrency ?? ''),
    brand: ld.brand?.name,
    condition: ld.offers?.itemCondition?.replace(/.*\//, '').replace(/Condition$/, ''),
    description: ld.description,
    photos: ld.image ? (Array.isArray(ld.image) ? ld.image : [ld.image]) : [],
    url: ld.offers?.url ?? url,
    seller: { id: 0, username: '' },
    raw: { source: 'html-jsonld', ld },
  };
}

export async function getSeller(
  client: VintedClient,
  sellerId: number,
  country: Country = 'fr',
): Promise<Seller> {
  const data = await client.apiGet<{ user: any }>(country, `/api/v2/users/${sellerId}`);
  const u = data.user ?? data;
  return {
    id: Number(u.id),
    username: String(u.login ?? u.username ?? ''),
    itemCount: u.item_count,
    feedbackReputation: u.feedback_reputation,
    feedbackCount: u.feedback_count,
    countryCode: u.country_code,
    profileUrl: `https://${DOMAIN[country]}/member/${u.id}`,
    raw: u,
  };
}

export interface ItemSlim { price: number; currency: string; }

export async function searchSlim(
  client: VintedClient,
  query: string,
  country: Country,
  perPage = 20,
): Promise<ItemSlim[]> {
  const r = await searchItems(client, { query, country, perPage, sortBy: 'relevance' });
  return r.items
    .map((i) => ({ price: Number(i.price), currency: i.currency }))
    .filter((x) => Number.isFinite(x.price) && x.price > 0);
}
