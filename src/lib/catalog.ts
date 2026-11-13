import { CATEGORIES, CONDITIONS, type Item } from "../types";

/** Filters live in the address (#/?kategori=Wanita&saiz=M), so a filtered view can be shared. Every value is checked against a fixed list or what is on sale. */

export const SORTS = [
  { value: "baru", label: "Terbaru" },
  { value: "murah", label: "Harga terendah" },
  { value: "mahal", label: "Harga tertinggi" },
] as const;
export type Sort = (typeof SORTS)[number]["value"];

export const PRICE_RANGES = [
  { value: "bawah-20", label: "Bawah RM 20", test: (p: number) => p < 20 },
  { value: "20-50", label: "RM 20 hingga RM 50", test: (p: number) => p >= 20 && p <= 50 },
  { value: "atas-50", label: "Atas RM 50", test: (p: number) => p > 50 },
] as const;

export interface Filters {
  category: string;
  size: string;
  condition: string;
  price: string;
  sort: Sort;
  q: string;
}

export const DEFAULT_FILTERS: Filters = { category: "", size: "", condition: "", price: "", sort: "baru", q: "" };
const KEYS: Record<keyof Filters, string> = { category: "kategori", size: "saiz", condition: "keadaan", price: "harga", sort: "susun", q: "cari" };
const MAX_QUERY = 60;
const NEW_DAYS = 7;

/** Sizes on sale, in a sensible order: letter sizes small to large, then everything else alphabetically. */
const LETTERS = ["XXS", "XS", "S", "M", "L", "XL", "2XL", "XXL", "3XL", "4XL", "5XL", "Free Size"];
export function sizesOf(items: Item[]): string[] {
  const sizes = [...new Set(items.map((i) => i.size.trim()).filter(Boolean))];
  const rank = (s: string) => (LETTERS.indexOf(s) >= 0 ? LETTERS.indexOf(s) : LETTERS.length);
  return sizes.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, "ms", { numeric: true }));
}

const pick = <T extends string>(value: string | null, allowed: readonly T[]): T | "" => (value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : "");

/** Reads filters from the address. Unknown keys, repeated keys and values that aren't on the lists are dropped. */
export function parseFilters(query: string, items: Item[]): Filters {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(query.length > 2000 ? "" : query);
  } catch {
    return { ...DEFAULT_FILTERS };
  }
  const one = (key: string) => (params.getAll(key).length === 1 ? params.get(key) : null);
  return {
    category: pick(one(KEYS.category), CATEGORIES),
    size: pick(one(KEYS.size), sizesOf(items)),
    condition: pick(one(KEYS.condition), CONDITIONS),
    price: pick(one(KEYS.price), PRICE_RANGES.map((r) => r.value)),
    sort: pick(one(KEYS.sort), SORTS.map((s) => s.value)) || "baru",
    q: (one(KEYS.q) ?? "").replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, MAX_QUERY),
  };
}

/** Writes only the filters that differ from the defaults, so a plain catalogue keeps a plain address. */
export function filtersToQuery(filters: Filters): string {
  const params = new URLSearchParams();
  (Object.keys(KEYS) as (keyof Filters)[]).forEach((key) => {
    if (filters[key] && filters[key] !== DEFAULT_FILTERS[key]) params.set(KEYS[key], filters[key]);
  });
  return params.toString();
}

export const isFiltered = (f: Filters) => !!(f.category || f.size || f.condition || f.price || f.q);

const createdMs = (item: Item) => {
  const ms = Date.parse(item.createdAt);
  return Number.isFinite(ms) ? ms : 0;
};

/** Listed within the last week. A future or unreadable date is never "new". */
export function isNew(item: Item, now = Date.now()): boolean {
  const age = now - createdMs(item);
  return createdMs(item) > 0 && age >= 0 && age <= NEW_DAYS * 24 * 60 * 60 * 1000;
}

const STATUS_ORDER: Record<string, number> = { Available: 0, Reserved: 1, Sold: 2 };

/** Filters, then sorts with what can still be bought first and sold items last. */
export function applyFilters(items: Item[], f: Filters): Item[] {
  const q = f.q.toLowerCase();
  const range = PRICE_RANGES.find((r) => r.value === f.price);
  const shown = items.filter((item) =>
    (!f.category || item.category === f.category) &&
    (!f.size || item.size.trim() === f.size) &&
    (!f.condition || item.condition === f.condition) &&
    (!range || range.test(item.price)) &&
    (!q || `${item.name} ${item.colour} ${item.brand} ${item.code}`.toLowerCase().includes(q)));
  const byKey = (a: Item, b: Item) =>
    f.sort === "murah" ? a.price - b.price
    : f.sort === "mahal" ? b.price - a.price
    : createdMs(b) - createdMs(a);
  return shown.sort((a, b) => (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3) || byKey(a, b) || a.code.localeCompare(b.code));
}
