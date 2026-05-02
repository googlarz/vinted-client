#!/usr/bin/env node
import { Command, Option } from 'commander';
import { VintedClient } from './client/session.js';
import { COUNTRIES, type Condition, type Country, type SortBy } from './client/types.js';
import { opSearch, opSearchAll } from './ops/search.js';
import { opGetItem } from './ops/get-item.js';
import { opGetSeller } from './ops/get-seller.js';
import { opCompare } from './ops/compare.js';
import { opTrending } from './ops/trending.js';

function client(opts: { proxy?: string }) {
  return new VintedClient({ proxyUrl: opts.proxy });
}

function out(x: unknown) {
  process.stdout.write(JSON.stringify(x, null, 2) + '\n');
}

function fail(e: unknown): never {
  const msg = e instanceof Error ? e.message : String(e);
  process.stderr.write(`error: ${msg}\n`);
  process.exit(1);
}

function parseList<T extends string>(v: string): T[] {
  return v.split(',').map((s) => s.trim()).filter(Boolean) as T[];
}

const program = new Command();
program
  .name('vinted')
  .description('CLI for the Vinted marketplace — search, items, sellers, price compare, trending.')
  .version('0.1.0')
  .option('--proxy <url>', 'HTTP/HTTPS proxy URL (also: VINTED_PROXY_URL, HTTPS_PROXY)');

program
  .command('search <query>')
  .description('Search Vinted listings')
  .addOption(new Option('-c, --country <cc>', 'country code').choices(COUNTRIES).default('fr'))
  .option('--price-min <n>', 'min price', (v) => Number(v))
  .option('--price-max <n>', 'max price', (v) => Number(v))
  .option('--brand-ids <ids>', 'comma-separated brand IDs', (v) => parseList<string>(v).map(Number))
  .option('--category-id <n>', 'category ID', (v) => Number(v))
  .option('--condition <list>', 'comma-separated conditions', (v) => parseList<Condition>(v))
  .addOption(new Option('--sort <s>', 'sort').choices(['relevance', 'price_low_to_high', 'price_high_to_low', 'newest_first']).default('relevance'))
  .option('-l, --limit <n>', 'max items per page (1–100)', (v) => Number(v), 20)
  .option('-p, --page <n>', 'page', (v) => Number(v), 1)
  .option('--all', 'walk pages and return all results (up to --max-items)')
  .option('--max-items <n>', 'cap when --all (default 1000)', (v) => Number(v), 1000)
  .option('--max-pages <n>', 'cap when --all (default 25)', (v) => Number(v), 25)
  .action(async (query: string, o, cmd) => {
    try {
      const c = client(cmd.optsWithGlobals());
      const params = {
        query,
        country: o.country as Country,
        priceMin: o.priceMin,
        priceMax: o.priceMax,
        brandIds: o.brandIds,
        categoryId: o.categoryId,
        condition: o.condition,
        sortBy: o.sort as SortBy,
        perPage: o.limit,
        page: o.page,
      };
      const r = o.all
        ? await opSearchAll(c, { ...params, maxItems: o.maxItems, maxPages: o.maxPages })
        : await opSearch(c, params);
      out(r);
    } catch (e) { fail(e); }
  });

program
  .command('item <idOrUrl>')
  .description('Get item by ID or Vinted URL')
  .addOption(new Option('-c, --country <cc>', 'country code (when passing ID)').choices(COUNTRIES).default('fr'))
  .option('--browser', 'use stealth browser to fetch full details (bypasses DataDome). Also: VINTED_BROWSER=1')
  .action(async (idOrUrl: string, o, cmd) => {
    try {
      const isUrl = /^https?:/.test(idOrUrl);
      const base = isUrl
        ? { url: idOrUrl }
        : { itemId: Number(idOrUrl), country: o.country as Country };
      const r = await opGetItem(client(cmd.optsWithGlobals()), { ...base, browser: o.browser });
      out(r);
    } catch (e) { fail(e); }
  });

program
  .command('seller <id>')
  .description('Get seller profile by ID')
  .addOption(new Option('-c, --country <cc>', 'country code').choices(COUNTRIES).default('fr'))
  .action(async (id: string, o, cmd) => {
    try {
      const r = await opGetSeller(client(cmd.optsWithGlobals()), {
        sellerId: Number(id),
        country: o.country as Country,
      });
      out(r);
    } catch (e) { fail(e); }
  });

program
  .command('compare <query>')
  .description('Compare prices across countries')
  .option('--countries <list>', 'comma-separated country codes', (v) => parseList<Country>(v), ['fr', 'de', 'it', 'es', 'nl', 'pl'])
  .option('-l, --limit <n>', 'items per country', (v) => Number(v), 20)
  .action(async (query: string, o, cmd) => {
    try {
      const r = await opCompare(client(cmd.optsWithGlobals()), {
        query,
        countries: o.countries,
        limit: o.limit,
      });
      out(r);
    } catch (e) { fail(e); }
  });

program
  .command('debug')
  .description('Inspect bootstrap (cookies received from homepage)')
  .addOption(new Option('-c, --country <cc>', 'country code').choices(COUNTRIES).default('fr'))
  .action(async (o, cmd) => {
    try {
      const c = client(cmd.optsWithGlobals());
      out(await c.debug(o.country as Country));
    } catch (e) { fail(e); }
  });

program
  .command('trending')
  .description('Trending / newest items')
  .addOption(new Option('-c, --country <cc>', 'country code').choices(COUNTRIES).default('fr'))
  .option('--category-id <n>', 'category ID', (v) => Number(v))
  .option('-l, --limit <n>', 'max items', (v) => Number(v), 20)
  .action(async (o, cmd) => {
    try {
      const r = await opTrending(client(cmd.optsWithGlobals()), {
        country: o.country as Country,
        categoryId: o.categoryId,
        limit: o.limit,
      });
      out(r);
    } catch (e) { fail(e); }
  });

program.parseAsync().catch(fail);
