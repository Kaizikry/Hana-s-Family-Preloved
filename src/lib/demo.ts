import { SAMPLE_ITEMS } from "../data/samples";
import type { AdminItem, InquiryInput, InquiryRecord, InquiryStatus, Item, ItemDraft, ItemStatus, ListerStatus } from "../types";
import { local, readJson, writeJson } from "./storage";

/**
 * Demo mode: the backend's rules, kept in this browser's storage, so the shop and admin can be
 * tried before the Google Sheet exists. backend/Code.gs is the real authority; keep the two in step.
 */
export const DEMO_POSTAGE = 10;
export const DEMO_HOLD_MINUTES = 30;
const SOLD_VISIBLE_DAYS = 14;

const ITEMS_KEY = "preloved.demo.items";
const INQUIRIES_KEY = "preloved.demo.inquiries";
const COUNTER_KEY = "preloved.demo.counter";

interface StoredItem extends Item {
  reservedFor: string;
  reservedUntil: string;
  soldAt: string;
}

const TRANSITIONS: Record<InquiryStatus, InquiryStatus[]> = {
  Baru: ["Batal"],
  Disahkan: ["Dibayar", "Batal"],
  Dibayar: ["Dihantar", "Diambil", "Batal"],
  Dihantar: ["Selesai"],
  Diambil: ["Selesai"],
  Selesai: [],
  Batal: [],
};

export class DemoError extends Error {
  constructor(message: string, public code?: string, public unavailable?: string[]) {
    super(message);
  }
}

const iso = (ms: number) => new Date(ms).toISOString();
const codeFor = (n: number) => `HFP-${String(n).padStart(3, "0")}`;

function seed(): StoredItem[] {
  const now = Date.now();
  writeJson(local, COUNTER_KEY, SAMPLE_ITEMS.length);
  return SAMPLE_ITEMS.map((s, i) => ({ ...s, id: `ITM-demo-${i + 1}`, code: codeFor(i + 1), createdAt: iso(now), reservedFor: "", reservedUntil: "", soldAt: s.status === "Sold" ? iso(now) : "" }));
}

const loadItems = () => readJson<StoredItem[]>(local, ITEMS_KEY) ?? seed();
const loadInquiries = () => readJson<InquiryRecord[]>(local, INQUIRIES_KEY) ?? [];
function saveItems(items: StoredItem[]) {
  if (!writeJson(local, ITEMS_KEY, items)) throw new DemoError("Storan pelayar penuh. Buang satu foto dan cuba lagi.");
}
const saveInquiries = (list: InquiryRecord[]) => writeJson(local, INQUIRIES_KEY, list);

const holdExpired = (i: StoredItem) => i.status === "Reserved" && !!i.reservedUntil && Date.parse(i.reservedUntil) <= Date.now();
const effective = (i: StoredItem): ItemStatus => (holdExpired(i) ? "Available" : i.status);
const heldFor = (i: StoredItem, inquiryId: string) => i.status === "Reserved" && i.reservedFor === inquiryId;
const locked = (i: StoredItem) => ["Reserved", "Sold"].includes(effective(i));

/** The same allow-list idea as the backend: hold and sale details stay out of what the shop sees. */
function toPublic(stored: StoredItem): Item {
  const { reservedFor: _held, reservedUntil: _until, soldAt: _sold, ...item } = stored;
  return { ...item, status: effective(stored) };
}

export const demo = {
  shop() {
    const soldCutoff = Date.now() - SOLD_VISIBLE_DAYS * 24 * 60 * 60 * 1000;
    const items = loadItems()
      .filter((i) => ["Available", "Reserved", "Sold"].includes(effective(i)) && (effective(i) !== "Sold" || Date.parse(i.soldAt || i.createdAt) >= soldCutoff))
      .map(toPublic);
    return { items, whatsappNumber: "", postageFee: DEMO_POSTAGE, holdMinutes: DEMO_HOLD_MINUTES };
  },

  submit(input: InquiryInput) {
    const items = loadItems();
    const ids = [...new Set(input.itemIds)];
    const unavailable = ids.filter((id) => {
      const item = items.find((i) => i.id === id);
      return !item || effective(item) !== "Available";
    });
    if (unavailable.length) throw new DemoError("Ada item yang sudah ditempah atau tiada lagi.", "UNAVAILABLE", unavailable);
    const lines = ids.map((id) => {
      const item = items.find((i) => i.id === id)!;
      return { id, code: item.code, name: item.name, price: item.price };
    });
    const itemsTotal = Math.round(lines.reduce((sum, l) => sum + l.price, 0) * 100) / 100;
    const postage = input.deliveryMethod === "post" ? DEMO_POSTAGE : 0;
    const record: InquiryRecord = {
      inquiryId: `INQ-${Date.now()}-${crypto.randomUUID().slice(0, 4)}`,
      timestamp: iso(Date.now()),
      customerName: input.customerName,
      customerPhone: input.customerPhone.replace(/[^\d+]/g, ""),
      deliveryMethod: input.deliveryMethod,
      pickupPreference: input.deliveryMethod === "pickup" ? input.pickupPreference : "",
      postState: input.deliveryMethod === "post" ? input.postState : "",
      postcode: input.deliveryMethod === "post" ? input.postcode : "",
      items: lines,
      itemsTotal,
      postage,
      total: Math.round((itemsTotal + postage) * 100) / 100,
      notes: input.notes,
      status: "Baru",
      confirmed: [],
      holdUntil: "",
      trackingNo: "",
    };
    saveInquiries([...loadInquiries(), record]);
    return { inquiryId: record.inquiryId, itemsTotal, postage, total: record.total };
  },

  save(draft: ItemDraft, photo?: string): Item {
    const items = loadItems();
    const now = iso(Date.now());
    const photos = photo ? [photo, ...draft.photos.slice(1)] : draft.photos;
    if (draft.id) {
      const index = items.findIndex((i) => i.id === draft.id);
      if (index < 0) throw new DemoError("Item tidak dijumpai.");
      const old = items[index];
      const keep = locked(old);
      items[index] = { ...old, ...draft, id: old.id, code: old.code, photos, status: keep ? old.status : draft.status, reservedFor: keep ? old.reservedFor : "", reservedUntil: keep ? old.reservedUntil : "" };
      saveItems(items);
      return toPublic(items[index]);
    }
    const counter = (readJson<number>(local, COUNTER_KEY) ?? items.length) + 1;
    writeJson(local, COUNTER_KEY, counter);
    const item: StoredItem = { ...draft, photos, id: `ITM-demo-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`, code: codeFor(counter), createdAt: now, reservedFor: "", reservedUntil: "", soldAt: "" };
    saveItems([...items, item]);
    return toPublic(item);
  },

  setStatus(itemId: string, status: ListerStatus) {
    const items = loadItems();
    const item = items.find((i) => i.id === itemId);
    if (!item) throw new DemoError("Item tidak dijumpai.");
    if (locked(item)) throw new DemoError("Item ini sedang ditempah atau sudah terjual.", "LOCKED_ITEM");
    Object.assign(item, { status, reservedFor: "", reservedUntil: "" });
    saveItems(items);
  },

  remove(itemId: string) {
    const items = loadItems();
    const item = items.find((i) => i.id === itemId);
    if (!item) throw new DemoError("Item tidak dijumpai.");
    if (locked(item)) throw new DemoError("Item yang ditempah atau terjual tidak boleh dipadam. Sembunyikan sahaja.", "LOCKED_ITEM");
    saveItems(items.filter((i) => i.id !== itemId));
  },

  listItems(): AdminItem[] {
    return loadItems().map((i) => {
      const held = effective(i) === "Reserved";
      return { ...toPublic(i), reservedFor: held ? i.reservedFor : "", holdUntil: held ? i.reservedUntil : "" };
    });
  },

  inquiries: loadInquiries,

  confirm(inquiryId: string, itemIds?: string[]) {
    const list = loadInquiries();
    const inquiry = list.find((q) => q.inquiryId === inquiryId);
    if (!inquiry) throw new DemoError("Pertanyaan tidak dijumpai.");
    if (inquiry.status !== "Baru") throw new DemoError("Pertanyaan ini sudah diproses.", "BAD_STATE");
    const asked = inquiry.items.map((l) => l.id);
    const chosen = [...new Set(itemIds ?? asked)].filter((id) => asked.includes(id));
    if (!chosen.length) throw new DemoError("Pilih sekurang-kurangnya satu item dari pertanyaan ini.");
    const items = loadItems();
    const unavailable = chosen.filter((id) => {
      const item = items.find((i) => i.id === id);
      return !item || effective(item) !== "Available";
    });
    if (unavailable.length) throw new DemoError("Ada item yang sudah ditempah atau tiada lagi.", "UNAVAILABLE", unavailable.map((id) => items.find((i) => i.id === id)?.code ?? id));
    const holdUntil = iso(Date.now() + DEMO_HOLD_MINUTES * 60 * 1000);
    for (const item of items) if (chosen.includes(item.id)) Object.assign(item, { status: "Reserved", reservedFor: inquiryId, reservedUntil: holdUntil, soldAt: "" });
    Object.assign(inquiry, { status: "Disahkan", confirmed: chosen, holdUntil });
    saveItems(items);
    saveInquiries(list);
    return holdUntil;
  },

  setInquiryStatus(inquiryId: string, status: InquiryStatus, trackingNo = "") {
    const list = loadInquiries();
    const inquiry = list.find((q) => q.inquiryId === inquiryId);
    if (!inquiry) throw new DemoError("Pertanyaan tidak dijumpai.");
    if (!TRANSITIONS[inquiry.status].includes(status)) throw new DemoError("Perubahan status ini tidak dibenarkan.", "BAD_STATE");
    if (status === "Dihantar" && inquiry.deliveryMethod !== "post") throw new DemoError("Pertanyaan ini untuk ambil sendiri.", "BAD_STATE");
    if (status === "Diambil" && inquiry.deliveryMethod !== "pickup") throw new DemoError("Pertanyaan ini untuk pos.", "BAD_STATE");
    const tracking = trackingNo.trim();
    if (status === "Dihantar" && !/^[A-Za-z0-9 -]{6,40}$/.test(tracking)) throw new DemoError("Nombor tracking tidak sah.");
    const items = loadItems();
    const mine = items.filter((i) => inquiry.confirmed.includes(i.id));
    if (["Dibayar", "Dihantar", "Diambil"].includes(status)) {
      const lost = inquiry.confirmed.filter((id) => !mine.some((i) => i.id === id && heldFor(i, inquiryId)));
      if (lost.length) throw new DemoError("Item ini sudah diambil pembeli lain selepas tempoh tempahan tamat.", "UNAVAILABLE", lost.map((id) => items.find((i) => i.id === id)?.code ?? id));
      for (const item of mine) Object.assign(item, status === "Dibayar" ? { reservedUntil: "" } : { status: "Sold", reservedUntil: "", soldAt: iso(Date.now()) });
    }
    if (status === "Batal") for (const item of mine) if (heldFor(item, inquiryId)) Object.assign(item, { status: "Available", reservedFor: "", reservedUntil: "" });
    Object.assign(inquiry, { status, ...(status === "Dibayar" || status === "Batal" ? { holdUntil: "" } : {}), ...(status === "Dihantar" ? { trackingNo: tracking } : {}) });
    saveItems(items);
    saveInquiries(list);
  },
};
