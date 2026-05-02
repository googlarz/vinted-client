import { ProxyAgent, Agent, type Dispatcher, fetch as undiciFetch } from 'undici';
import { DOMAIN, type Country } from './types.js';
import { TtlCache } from './cache.js';
import { TokenBucket } from './rate-limit.js';

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

interface SessionEntry {
  cookie: string;
  expiresAt: number;
}

export interface DebugInfo {
  country: Country;
  bootstrapStatus: number;
  cookieNames: string[];
  cookie: string;
}

export interface VintedClientOptions {
  proxyUrl?: string;
  timeoutMs?: number;
  cacheTtlMs?: number;        // default 60s; 0 disables
  rateLimitPerSec?: number;   // default 3 req/s/country
  rateLimitBurst?: number;    // default 6
}

export class VintedClient {
  private dispatcher: Dispatcher;
  private sessions = new Map<Country, SessionEntry>();
  private sessionTtlMs = 10 * 60 * 1000;
  public readonly proxyUrl?: string;
  private cache: TtlCache<string, unknown>;
  private cacheTtlMs: number;
  private bucket: TokenBucket;

  constructor(opts: VintedClientOptions = {}) {
    this.proxyUrl =
      opts.proxyUrl ?? process.env.VINTED_PROXY_URL ?? process.env.HTTPS_PROXY ?? process.env.HTTP_PROXY ?? undefined;
    this.dispatcher = this.proxyUrl
      ? new ProxyAgent({ uri: this.proxyUrl, headersTimeout: opts.timeoutMs ?? 20000 })
      : new Agent({ headersTimeout: opts.timeoutMs ?? 20000 });

    this.cacheTtlMs = opts.cacheTtlMs ?? Number(process.env.VINTED_CACHE_TTL_MS ?? 60_000);
    this.cache = new TtlCache(this.cacheTtlMs);
    const refill = opts.rateLimitPerSec ?? Number(process.env.VINTED_RATE_LIMIT_PER_SEC ?? 3);
    const burst = opts.rateLimitBurst ?? Number(process.env.VINTED_RATE_LIMIT_BURST ?? 6);
    this.bucket = new TokenBucket(burst, refill);
  }

  private async bootstrap(country: Country): Promise<{ status: number; cookie: string; cookieNames: string[] }> {
    const domain = DOMAIN[country];
    const res = await undiciFetch(`https://${domain}/catalog`, {
      method: 'GET',
      dispatcher: this.dispatcher,
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Upgrade-Insecure-Requests': '1',
      },
      redirect: 'follow',
    });

    const setCookies: string[] = (res.headers as any).getSetCookie?.() ?? [];
    const byName = new Map<string, string>();
    for (const raw of setCookies) {
      const head = raw.split(';')[0];
      const eq = head.indexOf('=');
      if (eq <= 0) continue;
      const name = head.slice(0, eq);
      const value = head.slice(eq + 1);
      if (!value) continue; // skip empty (Vinted sends empty access_token_web first then a real one)
      byName.set(name, value);
    }
    const pairs = [...byName.entries()].map(([n, v]) => `${n}=${v}`);
    return {
      status: res.status,
      cookie: pairs.join('; '),
      cookieNames: [...byName.keys()],
    };
  }

  private async getSessionCookie(country: Country): Promise<string> {
    const cached = this.sessions.get(country);
    if (cached && cached.expiresAt > Date.now()) return cached.cookie;

    const { status, cookie } = await this.bootstrap(country);
    if (!cookie) {
      throw new Error(
        `Vinted bootstrap failed for ${country} (status ${status}). ` +
        `Set VINTED_PROXY_URL or pass --proxy. Cloudflare may be blocking your IP/TLS fingerprint.`,
      );
    }

    this.sessions.set(country, { cookie, expiresAt: Date.now() + this.sessionTtlMs });
    return cookie;
  }

  async debug(country: Country): Promise<DebugInfo> {
    const r = await this.bootstrap(country);
    return { country, bootstrapStatus: r.status, cookieNames: r.cookieNames, cookie: r.cookie };
  }

  async fetchHtml(url: string): Promise<{ status: number; body: string }> {
    const res = await undiciFetch(url, {
      method: 'GET',
      dispatcher: this.dispatcher,
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
      },
      redirect: 'follow',
    });
    return { status: res.status, body: await res.text() };
  }

  async apiGet<T = unknown>(country: Country, path: string): Promise<T> {
    const cacheKey = `${country}:${path}`;
    if (this.cacheTtlMs > 0) {
      const hit = this.cache.get(cacheKey) as T | undefined;
      if (hit !== undefined) return hit;
    }

    const domain = DOMAIN[country];
    const url = `https://${domain}${path}`;
    const maxRetries = 3;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      await this.bucket.take(country);
      const cookie = await this.getSessionCookie(country);
      const res = await undiciFetch(url, {
        method: 'GET',
        dispatcher: this.dispatcher,
        headers: {
          'User-Agent': UA,
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': `https://${domain}/`,
          'Cookie': cookie,
          'X-Requested-With': 'XMLHttpRequest',
          'Sec-Fetch-Dest': 'empty',
          'Sec-Fetch-Mode': 'cors',
          'Sec-Fetch-Site': 'same-origin',
        },
      });

      if (res.status === 429 && attempt < maxRetries) {
        const retryAfter = Number(res.headers.get('retry-after'));
        const delayMs = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : Math.min(8000, 500 * 2 ** attempt) + Math.floor(Math.random() * 250);
        await sleep(delayMs);
        continue;
      }

      if (res.status === 401 || res.status === 403) {
        this.sessions.delete(country);
        if (attempt < maxRetries && res.status === 401) {
          // Re-bootstrap and retry once: token may have expired.
          continue;
        }
        throw new Error(
          `Vinted ${res.status} for ${url}. Session/auth rejected. ` +
          `Set VINTED_PROXY_URL or use --browser for gated endpoints.`,
        );
      }

      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Vinted ${res.status} for ${url}: ${body.slice(0, 200)}`);
      }

      const json = (await res.json()) as T;
      if (this.cacheTtlMs > 0) this.cache.set(cacheKey, json);
      return json;
    }

    throw new Error(`Vinted 429 for ${url}: rate-limited after ${maxRetries} retries`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
