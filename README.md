# vinted-cli

CLI and (optional) MCP server for the [Vinted](https://www.vinted.com) marketplace —
search listings, fetch items/sellers, compare prices across countries, and pull
trending feeds.

Inspired by `vinted-mcp-server`, but built from scratch with an open Vinted client,
a CLI as the primary interface, and MCP as an opt-in transport.

> ⚠️ Vinted has anti-bot protection. Bare requests work most of the time but can be
> rate-limited or blocked. Set `VINTED_PROXY_URL` (or `--proxy`) for reliability.

## Install

```bash
npm install
npm run build
```

Install globally:

```bash
npm install -g .
```

## CLI

```bash
vinted search "nike air max" --country fr --price-max 50 --limit 10
vinted item 12345678 --country fr
vinted item https://www.vinted.fr/items/12345678-nike-air-max
vinted seller 987654 --country de
vinted compare "iphone 13" --countries fr,de,uk,it --limit 30
vinted trending --country pl --limit 20
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

Tools exposed: `search_items`, `get_item`, `get_seller`, `compare_prices`, `get_trending`.

## Project layout

```
src/
  client/         VintedClient (session bootstrap, proxy, fetch wrappers)
  ops/            Pure operation functions used by both CLI and MCP
  cli.ts          commander entrypoint → bin: vinted
  mcp.ts          MCP stdio server → bin: vinted-mcp
```

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
