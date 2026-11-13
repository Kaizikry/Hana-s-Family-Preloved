import { describe, expect, it } from "vitest";
import { applyFilters, DEFAULT_FILTERS, filtersToQuery, isNew, parseFilters, sizesOf, type Filters } from "../src/lib/catalog";
import { isSafePhoto, photoAt } from "../src/lib/photos";
import { itemHash, parseHash, safeDecode } from "../src/lib/route";
import { askMessage, buildMessage, type Order } from "../src/lib/whatsapp";
import type { Item } from "../src/types";

/** The buyer side reads the address bar and the catalogue: both are treated as hostile here. */

const NOW = Date.UTC(2026, 10, 13, 2, 0, 0);
const daysAgo = (d: number) => new Date(NOW - d * 24 * 60 * 60 * 1000).toISOString();
const DRIVE = "https://drive.google.com/thumbnail?id=1DriveFile00000001&sz=w1200";

function item(over: Partial<Item>): Item {
  return {
    id: "ITM-1", code: "HFP-001", name: "Blaus Linen Putih", colour: "Putih", category: "Wanita", brand: "Uniqlo", size: "M",
    condition: "Seperti baru", flawNotes: "", measurements: {}, price: 25, originalPrice: 0, description: "", photos: [],
    status: "Available", createdAt: daysAgo(1), ...over,
  };
}

const CATALOGUE: Item[] = [
  item({ id: "a", code: "HFP-001", price: 19.99, size: "S", createdAt: daysAgo(10) }),
  item({ id: "b", code: "HFP-002", price: 20, size: "M", category: "Lelaki", createdAt: daysAgo(3) }),
  item({ id: "c", code: "HFP-003", price: 50, size: "L", condition: "Baik", createdAt: daysAgo(2) }),
  item({ id: "d", code: "HFP-004", price: 50.01, size: "M", status: "Sold", createdAt: daysAgo(0) }),
  item({ id: "e", code: "HFP-005", price: 35, size: "Free Size", status: "Reserved", name: "Tudung Bawal", category: "Tudung & Selendang", createdAt: daysAgo(5) }),
];
const ids = (items: Item[]) => items.map((i) => i.id);

describe("routes from the address bar", () => {
  it.each([
    ["", { name: "catalog" }],
    ["#/", { name: "catalog" }],
    ["#/item/ITM-1", { name: "item", id: "ITM-1" }],
    ["#/tempahan", { name: "checkout" }],
    ["#/terima-kasih", { name: "thanks" }],
    ["#/polisi", { name: "info", page: "polisi" }],
    ["#/admin", { name: "admin" }],
    ["#/admin/x", { name: "admin" }],
  ])("reads %j", (hash, route) => {
    expect(parseHash(hash).route).toEqual(route);
  });

  it.each([["#/item/%E0%A4%A"], ["#/item/%"], ["#/item/%zz"], ["#/item/%ED%A0%80"]])("survives the malformed escape %j instead of blanking the page", (hash) => {
    expect(() => parseHash(hash)).not.toThrow();
    expect(parseHash(hash).route).toEqual({ name: "catalog" });
  });

  it.each([["#/adminx"], ["#//evil.example"], ["#/item/"], [`#/item/${"x".repeat(101)}`], ["#/javascript:alert(1)"], ["#/constructor"], ["#/__proto__"], ["#/tempahan/../admin"]])("sends the unknown %j to the catalogue", (hash) => {
    expect(parseHash(hash).route).toEqual({ name: "catalog" });
  });

  it("keeps filters only for the catalogue", () => {
    expect(parseHash("#/?kategori=Wanita").query).toBe("kategori=Wanita");
    expect(parseHash("#/tempahan?kategori=Wanita")).toEqual({ route: { name: "checkout" }, query: "" });
  });

  it("round-trips any item id through its link", () => {
    for (const id of ["ITM-1", "a b", "ä/ö?#&=", "<script>", "%41"]) {
      expect(parseHash(itemHash(id)).route).toEqual({ name: "item", id });
    }
  });

  it("never throws on random input", () => {
    let seed = 7;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let n = 0; n < 2000; n++) {
      const hash = "#/" + Array.from({ length: Math.floor(rand() * 40) }, () => String.fromCharCode(Math.floor(rand() * 0x2fff))).join("");
      expect(() => parseHash(hash)).not.toThrow();
    }
    expect(safeDecode("%")).toBe("");
  });
});

describe("which photo addresses reach the page", () => {
  it.each([[DRIVE], ["images/samples/blaus-putih.svg"], ["images/photos/wooden-coat-hangers-1920.jpg"], ["data:image/jpeg;base64,/9j/4AAQ"]])("allows %s", (url) => {
    expect(isSafePhoto(url)).toBe(true);
  });

  it.each([
    ["javascript:alert(1)"],
    ["JAVASCRIPT:alert(1)"],
    ["data:text/html,<script>alert(1)</script>"],
    ["data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+"],
    ["data:image/jpeg;base64,/9j/\"onerror=\"alert(1)"],
    ["http://drive.google.com/thumbnail?id=1DriveFile00000001&sz=w1200"],
    ["https://drive.google.com.evil.example/thumbnail?id=1DriveFile00000001&sz=w1200"],
    ["https://evil.example/?https://drive.google.com/thumbnail?id=1DriveFile00000001&sz=w1200"],
    [`${DRIVE}&x=1`],
    [` ${DRIVE}`],
    [`${DRIVE}\n`],
    ["//evil.example/x.jpg"],
    ["images/../../etc/passwd.jpg"],
    ["images/x.svg?x=<script>"],
    ["/images/x.svg"],
    ["images/x.html"],
    [""],
    [null],
    [42],
    [{ toString: () => DRIVE }],
  ])("refuses %j", (url) => {
    expect(isSafePhoto(url)).toBe(false);
  });

  it("asks Drive for a smaller copy, and leaves other addresses alone", () => {
    expect(photoAt(DRIVE, 400)).toBe("https://drive.google.com/thumbnail?id=1DriveFile00000001&sz=w400");
    expect(isSafePhoto(photoAt(DRIVE, 400))).toBe(true);
    expect(photoAt("images/samples/x.svg", 400)).toBe("images/samples/x.svg");
  });
});

describe("catalogue filters from the address", () => {
  it("reads filters that are on the lists", () => {
    expect(parseFilters("kategori=Wanita&saiz=M&keadaan=Baik&harga=20-50&susun=murah&cari=linen", CATALOGUE)).toEqual({ category: "Wanita", size: "M", condition: "Baik", price: "20-50", sort: "murah", q: "linen" });
  });

  it.each([
    ["an unknown category", "kategori=Hacked"],
    ["a size nobody is selling", "saiz=XXXL"],
    ["an unknown condition", "keadaan=Excellent"],
    ["a made-up price range", "harga=0-1000000"],
    ["a made-up sort", "susun=__proto__"],
    ["a repeated key", "kategori=Wanita&kategori=Lelaki"],
    ["script in a value", "kategori=<script>alert(1)</script>"],
    ["an array-style key", "kategori[]=Wanita"],
  ])("drops %s", (_label, query) => {
    const f = parseFilters(query, CATALOGUE);
    expect(f.category).toBe("");
    expect(f.size).toBe("");
    expect(f.condition).toBe("");
    expect(f.price).toBe("");
    expect(f.sort).toBe("baru");
  });

  it("isn't fooled by prototype keys", () => {
    parseFilters("__proto__=x&constructor=y&__proto__[polluted]=1&toString=z", CATALOGUE);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("caps and cleans the search text, and ignores an absurd address", () => {
    expect(parseFilters(`cari=${"a".repeat(500)}`, CATALOGUE).q).toHaveLength(60);
    expect(parseFilters("cari=lin%0Aen%00%1B", CATALOGUE).q).toBe("linen");
    expect(parseFilters(`kategori=Wanita&${"x=1&".repeat(1000)}`, CATALOGUE)).toEqual(DEFAULT_FILTERS);
    expect(() => parseFilters("cari=%E0%A4%A&kategori=%", CATALOGUE)).not.toThrow();
  });

  it("round-trips through the address, writing nothing for the defaults", () => {
    const f: Filters = { category: "Tudung & Selendang", size: "Free Size", condition: "Baik", price: "atas-50", sort: "mahal", q: "a&b=c" };
    expect(parseFilters(filtersToQuery(f), CATALOGUE)).toEqual(f);
    expect(filtersToQuery(DEFAULT_FILTERS)).toBe("");
  });
});

describe("filtering and sorting", () => {
  const run = (over: Partial<Filters>) => ids(applyFilters(CATALOGUE, { ...DEFAULT_FILTERS, ...over }));

  it("puts what can be bought first, newest first, and sold items last", () => {
    expect(run({})).toEqual(["c", "b", "a", "e", "d"]);
  });

  it("sorts by price within each group", () => {
    expect(run({ sort: "murah" })).toEqual(["a", "b", "c", "e", "d"]);
    expect(run({ sort: "mahal" })).toEqual(["c", "b", "a", "e", "d"]);
  });

  it("draws the price ranges at the edges the labels say", () => {
    expect(run({ price: "bawah-20" })).toEqual(["a"]);
    expect(run({ price: "20-50" }).sort()).toEqual(["b", "c", "e"]);
    expect(run({ price: "atas-50" })).toEqual(["d"]);
  });

  it("filters by category, size and condition together", () => {
    expect(run({ category: "Wanita", size: "M" })).toEqual(["d"]);
    expect(run({ condition: "Baik" })).toEqual(["c"]);
  });

  it("finds an item by its code", () => {
    expect(run({ q: "005" })).toEqual(["e"]);
  });

  it("never reorders the catalogue it was given", () => {
    const before = ids(CATALOGUE);
    applyFilters(CATALOGUE, { ...DEFAULT_FILTERS, sort: "mahal" });
    expect(ids(CATALOGUE)).toEqual(before);
  });

  it("lists sizes small to large", () => {
    expect(sizesOf([...CATALOGUE, item({ size: "EU 41" }), item({ size: " M " })])).toEqual(["S", "M", "L", "Free Size", "EU 41"]);
  });
});

describe("the new badge", () => {
  it.each([
    [daysAgo(0), true],
    [daysAgo(7), true],
    [daysAgo(7.01), false],
    [daysAgo(-1), false],
    ["", false],
    ["not a date", false],
  ])("for an item listed %s: %s", (createdAt, expected) => {
    expect(isNew(item({ createdAt }), NOW)).toBe(expected);
  });
});

describe("messages a buyer can't tamper with", () => {
  it("asks about one item with its code, price and link", () => {
    expect(askMessage("Kedai", item({}), "https://kedai.example/#/item/ITM-1")).toBe("Salam Kedai, saya nak tanya tentang HFP-001 Blaus Linen Putih (RM 25): https://kedai.example/#/item/ITM-1");
  });

  it.each([["\n"], ["\r\n"], ["\u2028"], ["\u2029"], ["\u0085"], ["\u000B"], ["\u000C"]])("keeps the line break %j from faking a reply", (br) => {
    const order: Order = {
      input: { customerName: `Ali${br}Hana: Sudah dibayar`, customerPhone: "0123456789", deliveryMethod: "post", pickupPreference: "", postState: "Selangor", postcode: "40150", notes: `ok${br}Rujukan: INQ-FAKE`, itemIds: [] },
      items: [{ code: "HFP-001", name: "Blaus", size: "M", price: 25 }],
      itemsTotal: 25,
      postage: 10,
      total: 35,
      address: `Jalan 1${br}Jumlah anggaran: RM 0`,
    };
    const lines = buildMessage("Kedai", order).split(/\r\n|[\n\r\u000B\u000C\u0085\u2028\u2029]/);
    expect(lines.filter((l) => l.startsWith("Hana:") || l.startsWith("Rujukan:"))).toEqual([]);
    expect(lines.filter((l) => l.startsWith("Jumlah anggaran:"))).toEqual(["Jumlah anggaran: RM 35"]);
    expect(askMessage("Kedai", item({ name: `Blaus${br}Hana: percuma` }), "x").split(/[\n\r\u000B\u000C\u0085\u2028\u2029]/)).toHaveLength(1);
  });
});
