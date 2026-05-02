# @googlarz/vinted-client

CLI and (optional) MCP server for the [Vinted](https://www.vinted.com) marketplace —
search listings, fetch items/sellers, compare prices across countries, and pull
trending feeds.

Inspired by `vinted-mcp-server`, but built from scratch with an open Vinted client,
a CLI as the primary interface, and MCP as an opt-in transport.

> ⚠️ Vinted has anti-bot protection. Bare requests work most of the time but can be
> rate-limited or blocked. Set a proxy for reliability — see [Proxy setup](#proxy-setup).

## Install

```bash
npm install -g @googlarz/vinted-client
```

Or from source:

```bash
npm install && npm run build
npm install -g .
```

## CLI

```bash
# Search — pass IDs directly, or names that get resolved via Vinted lookup
vinted search "air max" --country fr --price-max 50 --limit 10
vinted search "shoes"  --brand "Nike,Adidas" --country fr
vinted search "shoes"  --brand-ids 53,14 --country fr

# Walk all pages (deduped, capped)
vinted search "uniqlo" --all --max-items 500 --max-pages 10

# Brand lookup
vinted brands "nike" --limit 5

# Items
vinted item 12345678 --country fr
vinted item https://www.vinted.fr/items/12345678-nike-air-max
vinted item 12345678 --browser            # stealth Chromium for full fidelity

# Sellers, price comparison, trending
vinted seller 987654 --country de
vinted compare "iphone 13" --countries fr,de,uk,it --limit 30
vinted trending --country pl --limit 20

# Diagnostics
vinted debug --country fr                 # inspect bootstrap cookies
```

Global flags:

- `--proxy <url>` — HTTP/HTTPS proxy. Also reads `VINTED_PROXY_URL`, `HTTPS_PROXY`, `HTTP_PROXY`.

All commands print JSON to stdout.

## MCP server

Optional. Requires `@modelcontextprotocol/sdk` (declared as `optionalDependencies`).

```jsonc
{
  "mcpServers": {
    "vinted": {
      "command": "vinted-mcp",
      "env": { "VINTED_PROXY_URL": "http://user:pass@proxy:8000" }
    }
  }
}
```

Tools exposed: `search_items`, `search_brands`, `get_item`, `get_seller`, `compare_prices`, `get_trending`. `search_items` accepts `brand` (string array) — names get auto-resolved to IDs via `search_brands`.

## Project layout

```
src/
  client/         VintedClient (session bootstrap, proxy, fetch wrappers)
  ops/            Pure operation functions used by both CLI and MCP
  cli.ts          commander entrypoint → bin: vinted
  mcp.ts          MCP stdio server → bin: vinted-mcp
```

## Proxy setup

Vinted is fronted by Cloudflare and DataDome. Plain Node requests will sometimes
get 401/403/429, especially from cloud IPs or when hitting `/items/{id}/details`.
Routing through a proxy fixes most of this.

The CLI accepts a proxy three ways (any one is enough):

```bash
# 1. Per-invocation flag
vinted --proxy "http://user:pass@proxy.example.com:8000" search "nike"

# 2. Tool-specific env var (recommended for shell sessions)
export VINTED_PROXY_URL="http://user:pass@proxy.example.com:8000"
vinted search "nike"

# 3. Standard env vars (also picked up automatically)
export HTTPS_PROXY="http://user:pass@proxy.example.com:8000"
vinted search "nike"
```

Precedence: `--proxy` → `VINTED_PROXY_URL` → `HTTPS_PROXY` → `HTTP_PROXY`.

URL format: `http://[user:pass@]host:port` — credentials are URL-encoded.
SOCKS5 is **not** supported (undici limitation); use an HTTP/HTTPS proxy.

### Picking a proxy

| Type | Works for catalog API | Works for `/details` (DataDome) | Notes |
|---|---|---|---|
| **Datacenter HTTP proxy** | Usually | Rarely | Fine for `search`, `seller`, `compare`, `trending`. Cheap. |
| **Residential proxy** (Bright Data, Oxylabs, IPRoyal, Smartproxy, etc.) | Yes | Often | Recommended for production / `--all` heavy use. |
| **Mobile/4G proxy** | Yes | Yes | Most reliable, most expensive. |
| **Apify Proxy** | Yes | Sometimes | The upstream `vinted-mcp-server` uses this; set `APIFY_PROXY_URL` style URLs in `VINTED_PROXY_URL`. |
| **Free public proxies** | No | No | Don't bother. Already burned by Vinted. |

For **gated item detail** specifically, even a residential proxy isn't a guarantee —
DataDome also fingerprints TLS. If `vinted item <id>` keeps falling back to JSON-LD,
combine the proxy with `--browser` mode (see below).

### Persisting in MCP config

```jsonc
{
  "mcpServers": {
    "vinted": {
      "command": "vinted-mcp",
      "env": { "VINTED_PROXY_URL": "http://user:pass@proxy.example.com:8000" }
    }
  }
}
```

### Verifying it works

```bash
vinted debug --country fr --proxy "$VINTED_PROXY_URL"
```

Should return `bootstrapStatus: 200` and a list of cookie names including
`access_token_web`. If the status is 403 or the cookie list is empty, the proxy
is being blocked — try a different IP/provider.

## Browser mode (opt-in)

For full-fidelity item details (seller info, raw API fields), enable stealth Chromium:

```bash
npm install playwright playwright-extra puppeteer-extra-plugin-stealth
npx playwright install chromium

vinted item 8805192757 --browser
# or:  VINTED_BROWSER=1 vinted item 8805192757
```

This launches a stealth-patched Chromium, navigates to the item page (which solves
the DataDome challenge), then calls `/api/v2/items/{id}/details` from the page
context — same TLS fingerprint, same cookies as a real user.

The MCP `get_item` tool accepts `browser: true` for the same effect.

## How it works

1. **Bootstrap**: GET `/catalog` on the country domain → collects `access_token_web`,
   `_vinted_xx_session`, etc. Cookies are deduped (Vinted ships an empty token first,
   then the real one — we keep the real one).
2. **Search / seller / trending**: `/api/v2/catalog/items` + `/api/v2/users/{id}` —
   plain cookie auth. Works without a proxy in most regions.
3. **Item detail**: `/api/v2/items/{id}/details` is gated by DataDome. We try it
   first and fall back to scraping the public item page's `application/ld+json`
   block, which has price, brand, condition, photos, description.

## Tests

```bash
npm test                  # unit tests (offline, fixture-based)
npm run test:integration  # hits live Vinted (requires network)
```

## Status

v0.1 — all 5 ops verified live against `vinted.fr`. Endpoints follow Vinted's
catalog API shape; expect breakage when they change. Contributions welcome.

## License

MIT
