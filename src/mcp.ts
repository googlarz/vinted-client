#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { VintedClient } from './client/session.js';
import { COUNTRIES } from './client/types.js';
import { opSearch } from './ops/search.js';
import { opGetItem } from './ops/get-item.js';
import { opGetSeller } from './ops/get-seller.js';
import { opCompare } from './ops/compare.js';
import { opTrending } from './ops/trending.js';
import { opBrands, resolveBrandIds } from './ops/brands.js';
import { opCategories } from './ops/categories.js';
import { opSellerItems } from './ops/seller-items.js';
import { opGetSellerFeedback } from './ops/get-seller-feedback.js';
import { opSearchAll } from './ops/search.js';

const TOOLS = [
  {
    name: 'search_items',
    description: 'Search Vinted second-hand listings with rich filters across 19 country sites. Returns a paginated list of items — each with title, price, currency, brand, size, condition, photo URL, item URL, favourite count, and seller info. Use get_categories to discover valid categoryId values and search_brands to resolve brand names to IDs. For comprehensive multi-page results use search_all_items instead.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search keywords, e.g. "Nike Air Max 90" or "levi 501 jeans"' },
        country: { type: 'string', enum: COUNTRIES, default: 'fr', description: 'Vinted country site to search (fr, de, uk, pl, es, nl, be, it, pt, cz, sk, hu, ro, lt, lv, ee, fi, at, se)' },
        priceMin: { type: 'number', description: 'Minimum price in the local currency of the selected country' },
        priceMax: { type: 'number', description: 'Maximum price in the local currency of the selected country' },
        brandIds: { type: 'array', items: { type: 'integer' }, description: 'Numeric Vinted brand IDs from search_brands. Prefer the brand[] parameter for name-based lookup.' },
        brand: { type: 'array', items: { type: 'string' }, description: 'Brand names to filter by, e.g. ["Nike", "Adidas"]. Automatically resolved to IDs via search_brands.' },
        categoryId: { type: 'integer', description: 'Category ID from get_categories (e.g. 4 = women\'s clothing, 5 = men\'s clothing, 1231 = women\'s shoes)' },
        sizeIds: { type: 'array', items: { type: 'integer' }, description: 'Size IDs to filter by. Discover valid IDs by inspecting results from a previous search in the same category.' },
        condition: { type: 'array', items: { type: 'string', enum: ['new_with_tags', 'new_without_tags', 'very_good', 'good', 'satisfactory'] }, description: 'Item condition filter; multiple values are OR-ed together' },
        sortBy: { type: 'string', enum: ['relevance', 'price_low_to_high', 'price_high_to_low', 'newest_first'], description: 'Sort order for results. Defaults to relevance.' },
        perPage: { type: 'integer', description: 'Results per page, 1–96. Defaults to 20.' },
        page: { type: 'integer', description: 'Page number starting at 1' },
        dateFrom: { type: 'string', description: 'Return items listed on or after this date. ISO-8601 format, e.g. "2024-01-01"' },
        dateTo: { type: 'string', description: 'Return items listed on or before this date. ISO-8601 format, e.g. "2024-12-31"' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_item',
    description: 'Fetch complete item details by Vinted item ID (with country) or by a direct Vinted item URL. Returns title, price, currency, brand, size, condition, full description, all photo URLs, creation date, item URL, favourite count, and seller username/ID. Automatically falls back to HTML scraping when the JSON API is unavailable.',
    inputSchema: {
      type: 'object',
      properties: {
        itemId: { type: 'integer', description: 'Numeric Vinted item ID, e.g. 5678901234' },
        url: { type: 'string', description: 'Full Vinted item URL, e.g. "https://www.vinted.fr/items/5678901234-nike-air-max". Country is inferred from the URL automatically.' },
        country: { type: 'string', enum: COUNTRIES, description: 'Country site (required when using itemId; inferred automatically when url is provided)' },
        browser: { type: 'boolean', default: false, description: 'Use headless browser for retrieval. Requires optional Playwright deps; only needed for items blocked by bot detection.' },
      },
    },
  },
  {
    name: 'get_seller',
    description: 'Fetch a seller\'s public profile by their numeric user ID. Returns username, active listing count, feedback reputation score (0–1 float), total feedback count, country code, and profile URL. Use get_seller_feedback to read review texts and star ratings, and get_seller_items to browse their listings.',
    inputSchema: {
      type: 'object',
      properties: {
        sellerId: { type: 'integer', description: 'Numeric Vinted user ID, visible in profile URLs: vinted.fr/member/12345-username' },
        country: { type: 'string', enum: COUNTRIES, default: 'fr', description: 'Country site where the seller is registered' },
      },
      required: ['sellerId'],
    },
  },
  {
    name: 'get_seller_items',
    description: 'List all items currently for sale by a specific seller, paginated. Returns the same fields as search_items (title, price, brand, size, condition, photo URL, item URL). Useful for browsing a seller\'s full catalogue after finding them via search_items or get_seller.',
    inputSchema: {
      type: 'object',
      properties: {
        sellerId: { type: 'integer', description: 'Numeric Vinted user ID' },
        country: { type: 'string', enum: COUNTRIES, default: 'fr', description: 'Country site where the seller is registered' },
        limit: { type: 'integer', default: 20, description: 'Items per page, 1–100' },
        page: { type: 'integer', default: 1, description: 'Page number starting at 1' },
      },
      required: ['sellerId'],
    },
  },
  {
    name: 'compare_prices',
    description: 'Compare prices for a search query across multiple Vinted country sites simultaneously. Returns median, mean, min, max, standard deviation, and sample count per country along with the local currency. Useful for finding the cheapest market to buy a specific item or understanding cross-border price gaps.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Item to compare prices for, e.g. "Levi 501 jeans" or "iPhone 14 case"' },
        countries: { type: 'array', items: { type: 'string', enum: COUNTRIES }, description: 'List of country codes to compare. Defaults to all 19 Vinted countries if omitted.' },
        limit: { type: 'integer', default: 20, description: 'Number of listings to sample per country. Higher values give more accurate statistics (max 96).' },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_brands',
    description: 'Search Vinted\'s brand catalogue by keyword. Returns matching brands with their numeric IDs, slugs, total item counts, and favourite counts. Pass the returned IDs to search_items.brandIds, or use search_items.brand[] to pass names and have them resolved automatically.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Brand name keyword to search for, e.g. "Nike" or "Levi"' },
        country: { type: 'string', enum: COUNTRIES, default: 'fr', description: 'Country site to query (brand catalogues are shared across countries)' },
        limit: { type: 'integer', default: 10, description: 'Maximum number of brand results to return' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_categories',
    description: 'Fetch the full Vinted category tree for a country. Returns a flat list of all categories and subcategories with their numeric IDs, names, parent IDs, and item counts. Pass a categoryId to search_items or search_all_items to restrict results to a department (e.g. women\'s clothing, men\'s shoes, electronics). Results are cached for 1 hour.',
    inputSchema: {
      type: 'object',
      properties: {
        country: { type: 'string', enum: COUNTRIES, default: 'fr', description: 'Country site to fetch categories for (category IDs are consistent across countries)' },
        query: { type: 'string', description: 'Optional keyword filter on category name, e.g. "shoes" or "dress"' },
      },
    },
  },
  {
    name: 'search_all_items',
    description: 'Search Vinted listings and automatically paginate through all results, returning up to maxItems items in a single call. Use this instead of search_items when you need comprehensive results — e.g. "find all Nike shoes under €30" or "list every item in size M from this brand". Pages are fetched concurrently for speed. Returns the same item fields as search_items.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search keywords' },
        country: { type: 'string', enum: COUNTRIES, default: 'fr', description: 'Vinted country site to search' },
        priceMin: { type: 'number', description: 'Minimum price in local currency' },
        priceMax: { type: 'number', description: 'Maximum price in local currency' },
        brandIds: { type: 'array', items: { type: 'integer' }, description: 'Numeric brand IDs from search_brands' },
        brand: { type: 'array', items: { type: 'string' }, description: 'Brand names; automatically resolved to IDs' },
        categoryId: { type: 'integer', description: 'Category ID from get_categories' },
        sizeIds: { type: 'array', items: { type: 'integer' }, description: 'Size IDs to filter by' },
        condition: { type: 'array', items: { type: 'string', enum: ['new_with_tags', 'new_without_tags', 'very_good', 'good', 'satisfactory'] }, description: 'Item condition filter' },
        sortBy: { type: 'string', enum: ['relevance', 'price_low_to_high', 'price_high_to_low', 'newest_first'], description: 'Sort order' },
        maxItems: { type: 'integer', default: 200, description: 'Maximum total items to collect across all pages (default 200, max 1000)' },
        maxPages: { type: 'integer', default: 10, description: 'Maximum number of pages to fetch regardless of maxItems' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_seller_feedback',
    description: 'Fetch paginated buyer and seller feedback reviews for a Vinted user. Each entry includes the review text, star rating (1–5), feedback type (1=negative, 2=neutral, 3=positive), reviewer username, timestamp, and the associated item ID. Use this to assess seller trustworthiness and reliability before making a purchase.',
    inputSchema: {
      type: 'object',
      properties: {
        sellerId: { type: 'integer', description: 'Numeric Vinted user ID (visible in profile URLs: vinted.fr/member/12345-username)' },
        country: { type: 'string', enum: COUNTRIES, default: 'fr', description: 'Country site where the seller is registered' },
        limit: { type: 'integer', default: 20, description: 'Reviews per page, 1–100' },
        page: { type: 'integer', default: 1, description: 'Page number starting at 1' },
      },
      required: ['sellerId'],
    },
  },
  {
    name: 'get_trending',
    description: 'Fetch the newest and trending items on Vinted for a given country, ordered by recency. Optionally scoped to a specific category. Useful for discovering what\'s currently popular, monitoring new arrivals, or finding deals as they are listed.',
    inputSchema: {
      type: 'object',
      properties: {
        country: { type: 'string', enum: COUNTRIES, default: 'fr', description: 'Vinted country site to fetch trending items from' },
        categoryId: { type: 'integer', description: 'Optional category ID from get_categories to restrict results to a specific department' },
        limit: { type: 'integer', default: 20, description: 'Number of trending items to return, 1–96' },
      },
    },
  },
];

function makeServer(): Server {
  const server = new Server(
    { name: 'vinted-cli', version: '1.0.0' },
    { capabilities: { tools: {} } },
  );

  let client: VintedClient | null = null;
  const getClient = () => (client ??= new VintedClient());

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: a = {} } = req.params;
    try {
      const c = getClient();
      let result: unknown;
      switch (name) {
        case 'search_items': {
          const args = a as any;
          if (!args.brandIds && Array.isArray(args.brand) && args.brand.length) {
            const r = await resolveBrandIds(c, args.brand, args.country);
            args.brandIds = r.ids.length ? r.ids : undefined;
          }
          result = await opSearch(c, args);
          break;
        }
        case 'search_brands': result = await opBrands(c, a as any); break;
        case 'get_item': result = await opGetItem(c, a as any); break;
        case 'get_seller': result = await opGetSeller(c, a as any); break;
        case 'get_seller_items': result = await opSellerItems(c, a as any); break;
        case 'compare_prices': result = await opCompare(c, a as any); break;
        case 'get_trending': result = await opTrending(c, a as any); break;
        case 'get_categories': result = await opCategories(c, a as any); break;
        case 'search_all_items': {
          const args = a as any;
          if (!args.brandIds && Array.isArray(args.brand) && args.brand.length) {
            const r = await resolveBrandIds(c, args.brand, args.country);
            args.brandIds = r.ids.length ? r.ids : undefined;
          }
          result = await opSearchAll(c, { ...args, maxItems: args.maxItems ?? 200 });
          break;
        }
        case 'get_seller_feedback': result = await opGetSellerFeedback(c, a as any); break;
        default: throw new Error(`Unknown tool: ${name}`);
      }
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { content: [{ type: 'text', text: `Error: ${msg}` }], isError: true };
    }
  });

  return server;
}

async function main() {
  const transport = process.env.VINTED_MCP_TRANSPORT;
  if (transport === 'http') return startHttp();
  const server = makeServer();
  const stdio = new StdioServerTransport();
  await server.connect(stdio);
}

async function startHttp() {
  const { StreamableHTTPServerTransport } = await import(
    '@modelcontextprotocol/sdk/server/streamableHttp.js'
  );
  const { createServer } = await import('node:http');
  const port = Number(process.env.VINTED_MCP_PORT ?? 3001);
  const host = process.env.VINTED_MCP_HOST ?? '127.0.0.1';
  const path = process.env.VINTED_MCP_PATH ?? '/mcp';

  const httpServer = createServer(async (req, res) => {
    if (!req.url || !req.url.startsWith(path)) {
      res.statusCode = 404; res.end('Not Found'); return;
    }
    const server = makeServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on('close', () => { transport.close().catch(() => {}); server.close().catch(() => {}); });
    await server.connect(transport);
    await transport.handleRequest(req, res);
  });

  await new Promise<void>((resolve) => httpServer.listen(port, host, resolve));
  process.stderr.write(`vinted-mcp listening on http://${host}:${port}${path}\n`);
}

main().catch((e) => {
  process.stderr.write(`fatal: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
