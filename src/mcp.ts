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

const TOOLS = [
  {
    name: 'search_items',
    description: 'Search Vinted listings with filters across 19 countries. Pass `brand` (string array of names) to auto-resolve to IDs, or `brandIds` directly.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        country: { type: 'string', enum: COUNTRIES, default: 'fr' },
        priceMin: { type: 'number' },
        priceMax: { type: 'number' },
        brandIds: { type: 'array', items: { type: 'integer' } },
        brand: { type: 'array', items: { type: 'string' }, description: 'Brand names; resolved to IDs via Vinted lookup' },
        categoryId: { type: 'integer' },
        condition: { type: 'array', items: { type: 'string', enum: ['new_with_tags', 'new_without_tags', 'very_good', 'good', 'satisfactory'] } },
        sortBy: { type: 'string', enum: ['relevance', 'price_low_to_high', 'price_high_to_low', 'newest_first'] },
        perPage: { type: 'integer' },
        page: { type: 'integer' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_item',
    description: 'Fetch full item detail by ID + country, or by Vinted URL. Set browser=true to use stealth Chromium for full fidelity (requires optional playwright deps).',
    inputSchema: {
      type: 'object',
      properties: {
        itemId: { type: 'integer' },
        url: { type: 'string' },
        country: { type: 'string', enum: COUNTRIES },
        browser: { type: 'boolean', default: false },
      },
    },
  },
  {
    name: 'get_seller',
    description: 'Fetch seller profile by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        sellerId: { type: 'integer' },
        country: { type: 'string', enum: COUNTRIES, default: 'fr' },
      },
      required: ['sellerId'],
    },
  },
  {
    name: 'compare_prices',
    description: 'Compare median/avg prices for a query across countries.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        countries: { type: 'array', items: { type: 'string', enum: COUNTRIES } },
        limit: { type: 'integer', default: 20 },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_brands',
    description: 'Look up Vinted brand IDs by keyword. Use these IDs in search_items.brandIds.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        country: { type: 'string', enum: COUNTRIES, default: 'fr' },
        limit: { type: 'integer', default: 10 },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_trending',
    description: 'Newest / trending items for a country (optionally scoped to a category).',
    inputSchema: {
      type: 'object',
      properties: {
        country: { type: 'string', enum: COUNTRIES, default: 'fr' },
        categoryId: { type: 'integer' },
        limit: { type: 'integer', default: 20 },
      },
    },
  },
];

function makeServer(): Server {
  const server = new Server(
    { name: 'vinted-cli', version: '0.1.0' },
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
        case 'compare_prices': result = await opCompare(c, a as any); break;
        case 'get_trending': result = await opTrending(c, a as any); break;
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
  const server = makeServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((e) => {
  process.stderr.write(`fatal: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
