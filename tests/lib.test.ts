import { existsSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SAMPLE_ITEMS } from "../src/data/samples";
import { inquiryTime, isValidPhone, money, pickupDays, roundCents, toWhatsAppNumber } from "../src/lib/format";
import { fitWithin } from "../src/lib/image";
import { buildMessage, whatsappUrl, type Order } from "../src/lib/whatsapp";
import { CATEGORIES, CONDITIONS, FLAWED } from "../src/types";

describe("money", () => {
  it("drops cents only for whole amounts", () => {
    expect(money(45)).toBe("RM 45");
    expect(money(12.5)).toBe("RM 12.50");
  });

  it("avoids floating point drift in totals", () => {
    expect(roundCents(0.1 + 0.2)).toBe(0.3);
  });
});

describe("pickup days", () => {
  const saturdayMorning = new Date(2026, 10, 7, 10, 0);

  it("offers 7 days in Malay, starting today", () => {
    const days = pickupDays(saturdayMorning);
    expect(days).toHaveLength(7);
    expect(days[0]).toEqual({ label: "Hari ini", date: "7 Nov", value: "Sabtu, 7 Nov" });
    expect(days[1]).toMatchObject({ label: "Esok", value: "Ahad, 8 Nov" });
    expect(days[2]).toMatchObject({ label: "Isnin", date: "9 Nov" });
  });

  it("leaves out today once pickup has closed", () => {
    const [first] = pickupDays(new Date(2026, 10, 7, 18, 0));
    expect(first).toMatchObject({ label: "Esok", date: "8 Nov" });
  });

  it("crosses into the next month", () => {
    expect(pickupDays(new Date(2026, 10, 30, 10, 0))[1].date).toBe("1 Dis");
  });
});

describe("phone numbers", () => {
  it.each(["012-345 6789", "+60 12-345 6789", "(012) 3456789"])("accepts %s", (phone) => {
    expect(isValidPhone(phone)).toBe(true);
  });
  it.each(["", "abc", "12345", "012345678901234567", "012345678x"])("rejects %j", (phone) => {
    expect(isValidPhone(phone)).toBe(false);
  });
  it("converts local numbers for wa.me", () => {
    expect(toWhatsAppNumber("013-928 4410")).toBe("60139284410");
    expect(toWhatsAppNumber("+60 13-928 4410")).toBe("60139284410");
  });
});

describe("inquiry time", () => {
  it("uses the Malay morning and afternoon markers", () => {
    expect(inquiryTime(new Date(2026, 10, 7, 14, 5).toISOString())).toBe("7 Nov, 2:05 ptg");
    expect(inquiryTime(new Date(2026, 10, 7, 0, 30).toISOString())).toBe("7 Nov, 12:30 pg");
  });
});

describe("WhatsApp message", () => {
  const items = [
    { code: "HFP-001", name: "Blaus Linen Putih", size: "M", price: 25 },
    { code: "HFP-004", name: "Tudung Bawal Krim", size: "", price: 12.5 },
  ];
  const pickupOrder: Order = {
    input: { customerName: "Aisha & Co", customerPhone: "0123456789", deliveryMethod: "pickup", pickupPreference: "Isnin, 16 Nov, 9 hingga 11 pagi", postState: "", postcode: "", notes: "", itemIds: [] },
    items,
    itemsTotal: 37.5,
    postage: 0,
    total: 37.5,
    address: "",
  };
  const postOrder: Order = {
    ...pickupOrder,
    input: { ...pickupOrder.input, deliveryMethod: "post", pickupPreference: "", postState: "Selangor", postcode: "40150" },
    postage: 10,
    total: 47.5,
    address: "No 12, Jalan Contoh 3\nTaman Contoh\n40150 Shah Alam",
  };

  it("lists the codes, sizes and pickup time", () => {
    expect(buildMessage("Hana's Family Preloved", pickupOrder, "INQ-1")).toBe(
      [
        "Salam Hana's Family Preloved, saya nak beli item berikut:",
        "",
        "1. HFP-001 Blaus Linen Putih (M) = RM 25",
        "2. HFP-004 Tudung Bawal Krim = RM 12.50",
        "",
        "Jumlah item: RM 37.50",
        "Ambil sendiri: Isnin, 16 Nov, 9 hingga 11 pagi",
        "Jumlah anggaran: RM 37.50",
        "",
        "Nama: Aisha & Co",
        "Telefon: 0123456789",
        "",
        "Rujukan: INQ-1",
        "Terima kasih!",
      ].join("\n"),
    );
  });

  it("adds the postage, state and address for a posted order, on one line", () => {
    const message = buildMessage("Kedai", postOrder);
    expect(message).toContain("Penghantaran: Pos ke Selangor (40150), pos RM 10");
    expect(message).toContain("Jumlah anggaran: RM 47.50");
    expect(message).toContain("Alamat: No 12, Jalan Contoh 3, Taman Contoh, 40150 Shah Alam");
  });

  it("never adds an address to a pickup order", () => {
    expect(buildMessage("Kedai", { ...pickupOrder, address: "No 12 Jalan Rahsia" })).not.toContain("Jalan Rahsia");
  });

  it("can't be made to fake a reply from the shop with new lines", () => {
    const sneaky = { ...postOrder, input: { ...postOrder.input, customerName: "Ali\n\nHana: Sudah dibayar, terima kasih", notes: "x\nRujukan: INQ-FAKE" }, address: "Jalan 1\r\n\r\nJumlah anggaran: RM 0" };
    const lines = buildMessage("Kedai", sneaky).split("\n");
    expect(lines.filter((l) => l.startsWith("Hana:"))).toEqual([]);
    expect(lines.filter((l) => l.startsWith("Rujukan:"))).toEqual([]);
    expect(lines.filter((l) => l.startsWith("Jumlah anggaran:"))).toEqual(["Jumlah anggaran: RM 47.50"]);
  });

  it("adds notes only when there are some", () => {
    expect(buildMessage("Kedai", pickupOrder)).not.toContain("Nota:");
    expect(buildMessage("Kedai", { ...pickupOrder, input: { ...pickupOrder.input, notes: "Saiz M ada lagi?" } })).toContain("Nota: Saiz M ada lagi?");
  });

  it("encodes the URL so symbols and newlines survive", () => {
    expect(whatsappUrl("60 12-345", "Aisha & Co\n100%")).toBe("https://wa.me/6012345?text=Aisha%20%26%20Co%0A100%25");
  });
});

describe("photo resizing", () => {
  it("scales wide photos down to 800px", () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 800, height: 600 });
  });
  it("also limits tall phone photos", () => {
    expect(fitWithin(3000, 4000)).toEqual({ width: 750, height: 1000 });
  });
  it("never enlarges small photos", () => {
    expect(fitWithin(300, 200)).toEqual({ width: 300, height: 200 });
  });
});

describe("demo sample items", () => {
  it("gives each item its own picture, and every picture exists", () => {
    const pictures = SAMPLE_ITEMS.map((item) => item.photos[0]);
    expect(new Set(pictures).size).toBe(SAMPLE_ITEMS.length);
    for (const picture of pictures) expect(existsSync(join("public", picture)), picture).toBe(true);
  });

  it("only uses categories and conditions the backend accepts", () => {
    for (const item of SAMPLE_ITEMS) {
      expect(CATEGORIES).toContain(item.category);
      expect(CONDITIONS).toContain(item.condition);
      if (item.condition === FLAWED) expect(item.flawNotes).not.toBe("");
    }
  });
});

describe("demo mode follows the backend's rules", () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) });
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 13, 10, 0));
    vi.resetModules();
  });

  const load = async () => (await import("../src/lib/demo")).demo;
  const ask = (itemIds: string[], deliveryMethod: "pickup" | "post" = "pickup") => ({
    customerName: "Ujian", customerPhone: "0123456789", deliveryMethod, pickupPreference: "Esok", postState: "Selangor", postcode: "40150", notes: "", itemIds,
  });

  it("charges a flat RM10 postage", async () => {
    const demo = await load();
    const [a, b] = demo.shop().items;
    expect(demo.submit(ask([a.id, b.id], "post"))).toMatchObject({ postage: 10, total: a.price + b.price + 10 });
  });

  it("holds for 30 minutes, then puts the item back on sale", async () => {
    const demo = await load();
    const item = demo.shop().items[0];
    demo.confirm(demo.submit(ask([item.id])).inquiryId);
    expect(demo.shop().items[0].status).toBe("Reserved");
    vi.advanceTimersByTime(30 * 60 * 1000);
    expect(demo.shop().items[0].status).toBe("Available");
  });

  it("refuses an item someone else holds", async () => {
    const demo = await load();
    const item = demo.shop().items[0];
    const first = demo.submit(ask([item.id])).inquiryId;
    const second = demo.submit(ask([item.id])).inquiryId;
    demo.confirm(first);
    expect(() => demo.confirm(second)).toThrow("sudah ditempah");
    expect(() => demo.submit(ask([item.id]))).toThrow("sudah ditempah");
  });
});
