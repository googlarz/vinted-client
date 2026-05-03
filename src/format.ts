import type { Item, SearchResult, CategoryHit } from './client/types.js';
import type { BrandHit } from './client/endpoints.js';

type OutputFormat = 'json' | 'table';

export function printOutput(data: unknown, format: OutputFormat): void {
  if (format === 'table') {
    printTable(data);
  } else {
    process.stdout.write(JSON.stringify(data, null, 2) + '\n');
  }
}

function printTable(data: unknown): void {
  if (isSearchResult(data)) return tableItems(data.items, data.totalCount);
  if (Array.isArray(data)) {
    if (data.length === 0) { process.stdout.write('(no results)\n'); return; }
    if (isCategoryHit(data[0])) return tableCategories(data as CategoryHit[]);
    if (isBrandHit(data[0])) return tableBrands(data as BrandHit[]);
  }
  // fallback
  process.stdout.write(JSON.stringify(data, null, 2) + '\n');
}

function tableItems(items: Item[], total?: number): void {
  if (items.length === 0) { process.stdout.write('(no results)\n'); return; }
  const cols = ['ID', 'Title', 'Price', 'Brand', 'Size', 'Condition', 'Seller'];
  const rows = items.map((i) => [
    String(i.id),
    trunc(i.title, 35),
    `${i.price} ${i.currency}`,
    trunc(i.brand ?? '—', 15),
    trunc(i.size ?? '—', 8),
    trunc(i.condition ?? '—', 12),
    i.seller.username || '—',
  ]);
  printGrid(cols, rows);
  if (total !== undefined) process.stdout.write(`\n${items.length} shown / ${total} total\n`);
}

function tableCategories(cats: CategoryHit[]): void {
  const cols = ['ID', 'Title', 'ParentID', 'Items'];
  const rows = cats.map((c) => [
    String(c.id),
    trunc(c.title, 40),
    c.parentId != null ? String(c.parentId) : '—',
    c.itemCount != null ? String(c.itemCount) : '—',
  ]);
  printGrid(cols, rows);
  process.stdout.write(`\n${cats.length} categories\n`);
}

function tableBrands(brands: BrandHit[]): void {
  const cols = ['ID', 'Title', 'Slug', 'Items'];
  const rows = brands.map((b) => [
    String(b.id),
    trunc(b.title, 30),
    trunc(b.slug, 30),
    b.itemCount != null ? String(b.itemCount) : '—',
  ]);
  printGrid(cols, rows);
}

function printGrid(cols: string[], rows: string[][]): void {
  const widths = cols.map((c, i) =>
    Math.max(c.length, ...rows.map((r) => (r[i] ?? '').length)),
  );
  const sep = widths.map((w) => '─'.repeat(w + 2)).join('┼');
  const fmt = (row: string[]) =>
    row.map((cell, i) => ` ${cell.padEnd(widths[i])} `).join('│');
  process.stdout.write(fmt(cols) + '\n');
  process.stdout.write(sep + '\n');
  for (const row of rows) process.stdout.write(fmt(row) + '\n');
}

function trunc(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function isSearchResult(x: unknown): x is SearchResult {
  return typeof x === 'object' && x !== null && 'items' in x && Array.isArray((x as any).items);
}
function isCategoryHit(x: unknown): x is CategoryHit {
  return typeof x === 'object' && x !== null && 'parentId' in x;
}
function isBrandHit(x: unknown): x is BrandHit {
  return typeof x === 'object' && x !== null && 'slug' in x;
}
