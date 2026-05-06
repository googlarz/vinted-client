<div align="center">

# 🛍️ Vinted MCP & CLI Server

**Search, scrape, and automate Vinted across 19 countries — from your terminal or AI assistant.**

[![npm version](https://img.shields.io/npm/v/@googlarz/vinted-client?style=flat-square&color=cc3534)](https://www.npmjs.com/package/@googlarz/vinted-client)
[![CI](https://img.shields.io/github/actions/workflow/status/googlarz/vinted-mcp-cli/ci.yml?branch=main&style=flat-square&label=CI)](https://github.com/googlarz/vinted-mcp-cli/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Node ≥18](https://img.shields.io/badge/node-%E2%89%A518-green?style=flat-square)](https://nodejs.org)

```
vinted search "nike air max" --country de --price-max 60 --output table
```

</div>

---

## What is this?

A **CLI tool** and **MCP server** for the Vinted secondhand marketplace. No official API needed — it bootstraps a session cookie from the public catalog page, then hits the private JSON API that the Vinted web app uses internally.

Works as:
- 🖥️ **Terminal tool** — pipe results, watch for new listings, compare prices across Europe
- 🤖 **MCP server** — plug into Claude, Cursor, or any AI assistant with MCP support
- 📦 **TypeScript library** — import `opSearch`, `opCompare`, etc. directly in your code

---

## Install

```bash
npm install -g @googlarz/vinted-client
```

Or run without installing:

```bash
npx @googlarz/vinted-client search "levis 501"
```

---

## CLI Quick Start

```bash
# Search (JSON by default)
vinted search "levi's 501" --country fr

# Pretty table
vinted search "levi's 501" --country de --output table

# Filter by price, brand, condition
vinted search "adidas samba" \
  --price-min 20 --price-max 80 \
  --brand adidas \
  --condition new_with_tags,very_good \
  --output table

# Watch for new listings every 30s
vinted search "air jordan 1" --watch 30

# Walk all pages and collect up to 500 results
vinted search "vintage denim" --all --max-items 500

# Get a specific item (ID or URL)
vinted item 1234567
vinted item https://www.vinted.fr/items/1234567

# Seller profile + active listings
vinted seller 987654
vinted seller-items 987654 --output table

# Cross-country price comparison (6 countries by default)
vinted compare "north face jacket" --output table

# Browse category tree
vinted categories --query shoes --output table

# Look up brand IDs
vinted brands "stone island"

# What's trending right now
vinted trending --country fr --output table
```

---

## Commands

| Command | Description |
|---|---|
| `search <query>` | Search listings with full filter support |
| `item <id\|url>` | Get full item detail |
| `seller <id>` | Seller profile |
| `seller-items <id>` | Items a seller has for sale |
| `compare <query>` | Price comparison across countries |
| `brands <query>` | Look up brand IDs by name |
| `categories` | Browse the category tree |
| `trending` | Newest / trending listings |
| `debug` | Inspect session cookies (for troubleshooting) |

### Global flags

| Flag | Description |
|---|---|
| `--output json\|table` | Output format (default: `json`) |
| `--country <cc>` | Country code (see below) |
| `--proxy <url>` | HTTP/HTTPS proxy (also: `VINTED_PROXY_URL`) |
| `--no-cache` | Disable response cache |

### Search flags

| Flag | Description |
|---|---|
| `--price-min / --price-max` | Price range |
| `--brand <names>` | Brand names (auto-resolved to IDs) |
| `--brand-ids <ids>` | Comma-separated brand IDs |
| `--category-id <n>` | Category ID (`vinted categories` to browse) |
| `--size-ids <ids>` | Comma-separated size IDs |
| `--condition <list>` | `new_with_tags`, `new_without_tags`, `very_good`, `good`, `satisfactory` |
| `--sort <s>` | `relevance`, `price_low_to_high`, `price_high_to_low`, `newest_first` |
| `--date-from / --date-to` | Date range filter (YYYY-MM-DD) |
| `--all` | Walk pages and collect all results |
| `--max-items <n>` | Cap for `--all` (default 1000) |
| `--watch [interval]` | Poll every N seconds for new listings (default 60s) |

---

## Supported Countries

`fr` `de` `uk` `it` `es` `nl` `pl` `pt` `be` `at` `lt` `cz` `sk` `hu` `ro` `hr` `fi` `dk` `se`

---

## MCP Server

Drop Vinted into any MCP-compatible AI assistant (Claude, Cursor, etc.).

### Setup — Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "vinted": {
      "command": "npx",
      "args": ["-y", "@googlarz/vinted-client/mcp"]
    }
  }
}
```

### Setup — Claude Code

```bash
claude mcp add vinted -- npx -y @googlarz/vinted-client/mcp
```

### MCP Tools

| Tool | Description |
|---|---|
| `search_items` | Search with full filter support |
| `get_item` | Item detail by ID or URL |
| `get_seller` | Seller profile |
| `get_seller_items` | Active listings for a seller |
| `compare_prices` | Multi-country price comparison |
| `get_trending` | Trending listings |
| `search_brands` | Brand lookup |
| `get_categories` | Category tree |

**Example prompts once connected:**

> *"Find me Nike Air Max 95s under €70 in Germany, size 43, very good condition"*

> *"Compare prices for a North Face puffer jacket across France, Germany and Italy"*

> *"Watch seller #987654 and tell me when they list something under €30"*

---

## Library Usage

```typescript
import { VintedClient, opSearch, opCompare, opSearchAll } from '@googlarz/vinted-client';

const client = new VintedClient();

// Basic search
const results = await opSearch(client, {
  query: 'levi\'s 501',
  country: 'de',
  priceMax: 50,
  condition: ['very_good', 'good'],
  sortBy: 'price_low_to_high',
});

console.log(results.items);

// Collect all pages concurrently (3-page prefetch window)
const all = await opSearchAll(client, {
  query: 'vintage band tee',
  country: 'uk',
  maxItems: 300,
});

// Multi-country price comparison
const report = await opCompare(client, {
  query: 'air jordan 1 retro',
  countries: ['fr', 'de', 'uk', 'it'],
});
```

### Client options

```typescript
const client = new VintedClient({
  proxyUrl: 'http://proxy:8080',   // or VINTED_PROXY_URL env var
  cacheTtlMs: 60_000,              // response cache TTL (0 = disable)
  rateLimitPerSec: 3,              // requests/sec per country
  rateLimitBurst: 6,               // burst capacity
  timeoutMs: 20_000,               // per-request timeout
});
```

---

## How it works

Vinted has no public API. This library:

1. **Bootstraps a session** by hitting `vinted.{cc}/catalog` and capturing the auth cookies the Vinted frontend sets.
2. **Calls the private JSON API** (`/api/v2/...`) with those cookies, mimicking browser request headers.
3. **Re-bootstraps automatically** on 401 — tokens expire, the library recovers silently.
4. **Rate-limits per country** with a token bucket (configurable burst + refill) to avoid 429s.
5. **Caches responses** with LRU+TTL — 60s for search results, 1h for static data like categories.
6. **Falls back to HTML scraping** for item pages blocked by DataDome (JSON-LD + regex extraction).
7. **Prefetches 3 pages concurrently** in `opSearchAll` to maximise throughput within the rate-limit budget.

---

## Proxy support

If Vinted blocks your IP (common on cloud VMs and CI), set a proxy:

```bash
VINTED_PROXY_URL=http://user:pass@proxy:8080 vinted search "nike"
# or
vinted search "nike" --proxy http://user:pass@proxy:8080
```

Standard `HTTPS_PROXY` / `HTTP_PROXY` env vars are also respected.

---

## Environment variables

| Variable | Description |
|---|---|
| `VINTED_PROXY_URL` | HTTP/HTTPS proxy URL |
| `VINTED_CACHE_TTL_MS` | Cache TTL in ms (default `60000`) |
| `VINTED_RATE_LIMIT_PER_SEC` | Requests per second per country (default `3`) |
| `VINTED_RATE_LIMIT_BURST` | Token bucket burst size (default `6`) |
| `VINTED_BROWSER` | Set to `1` to use stealth browser for item detail |

---

## Requirements

- Node.js ≥ 18
- Optional: `playwright` + `puppeteer-extra-plugin-stealth` for `--browser` / `VINTED_BROWSER=1` mode

---

## License

MIT © [googlarz](https://github.com/googlarz)

---

<div align="center">
<sub>Not affiliated with Vinted UAB. Use responsibly.</sub>
</div>
