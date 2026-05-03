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

const TOOLS = [
  {
    name: 'search_items',
    description: 'Search Vinted listings with filters across 19 countries.',
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
        sizeIds: { type: 'array', items: { type: 'integer' }, description: 'Size IDs (use get_categories + search_items to discover)' },
        condition: { type: 'array', items: { type: 'string', enum: ['new_with_tags', 'new_without_tags', 'very_good', 'good', 'satisfactory'] } },
        sortBy: { type: 'string', enum: ['relevance', 'price_low_to_high', 'price_high_to_low', 'newest_first'] },
        perPage: { type: 'integer' },
        page: { type: 'integer' },
        dateFrom: { type: 'string', description: 'ISO date string e.g. 2024-01-01' },
        dateTo: { type: 'string' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_item',
    description: 'Fetch full item detail by ID + country, or by Vinted URL.',
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
    name: 'get_seller_items',
    description: 'List items currently for sale by a seller.',
    inputSchema: {
      type: 'object',
      properties: {
        sellerId: { type: 'integer' },
        country: { type: 'string', enum: COUNTRIES, default: 'fr' },
        limit: { type: 'integer', default: 20 },
        page: { type: 'integer', default: 1 },
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
    description: 'Look up Vinted brand IDs by keyword.',
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
    name: 'get_categories',
    description: 'Browse Vinted category tree. Returns IDs to use in search_items.categoryId.',
    inputSchema: {
      type: 'object',
      properties: {
        country: { type: 'string', enum: COUNTRIES, default: 'fr' },
        query: { type: 'string', description: 'Optional keyword filter on category name' },
      },
    },
  },
  {
    name: 'get_trending',
    description: 'Newest / trending items for a country.',
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
