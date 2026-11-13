import { describe, expect, it } from "vitest";
import { JPEG, loadBackend, PHOTO } from "./fakeAppsScript";
import { baseItem, buyer, NUMBER, openShop, PIN } from "./shop";

/** What an outsider can try against the public endpoint, and what a stolen session still can't do. */

const ADMIN_ACTIONS = ["LOGOUT", "LIST_INQUIRIES", "LIST_ITEMS", "UPLOAD_PHOTO", "SAVE_ITEM", "SET_ITEM_STATUS", "DELETE_ITEM", "CONFIRM_INQUIRY", "SET_INQUIRY_STATUS", "DROP_ALL"];
const PUBLIC_FIELDS = ["brand", "category", "code", "colour", "condition", "createdAt", "description", "flawNotes", "id", "measurements", "name", "originalPrice", "photos", "price", "size", "status"];

describe("access control", () => {
  it.each(ADMIN_ACTIONS)("refuses %s with no session", (action) => {
    const { api, add } = openShop();
    const item = add();
    expect(api.post({ action, item: baseItem, itemId: item.id, status: "Disembunyi", imageBase64: JPEG }).code).toBe("BAD_SESSION");
    expect(api.get().items[0].status).toBe("Available");
  });

  it.each([
    ["a made-up token", "00000000-0000-0000-0000-000000000000"],
    ["an array", ["x"]],
    ["an object", { a: 1 }],
    ["a number", 42],
    ["the passcode itself", PIN],
    ["an empty string", ""],
    ["a cache key from another feature", "inquiries:0"],
    ["a token with a wildcard", "*"],
  ])("refuses %s as a session", (_label, token) => {
    const { api } = openShop();
    expect(api.post({ action: "LIST_INQUIRIES", token }).code).toBe("BAD_SESSION");
  });

  it("refuses a session after it expires or logs out", () => {
    const { api, token, admin } = openShop();
    api.cache.delete(`session:${token}`);
    expect(admin("LIST_INQUIRIES").code).toBe("BAD_SESSION");
    const second = openShop();
    second.admin("LOGOUT");
    expect(second.admin("SAVE_ITEM", { item: baseItem }).code).toBe("BAD_SESSION");
  });

  it("can't log out someone else without their token", () => {
    const { api, admin } = openShop();
    api.post({ action: "LOGOUT", token: "00000000-0000-0000-0000-000000000000" });
    expect(admin("LIST_INQUIRIES").status).toBe("success");
  });
});

describe("passcode guessing", () => {
  it.each([[[PIN]], [Number(PIN)], [{ toString: PIN }], [null], [` ${PIN}`]])("only accepts the passcode as exact text, not %j", (pin) => {
    expect(loadBackend({ ADMIN_PIN: PIN }).post({ action: "VERIFY_PIN", adminPin: pin }).code).toBe("BAD_PIN");
  });

  it("keeps the lock even if the cache is wiped", () => {
    const api = loadBackend({ ADMIN_PIN: PIN });
    for (let i = 0; i < 5; i++) api.post({ action: "VERIFY_PIN", adminPin: "bad" });
    api.cache.clear();
    expect(api.post({ action: "VERIFY_PIN", adminPin: PIN }).code).toBe("LOCKED");
  });

  it("lets a guesser try at most 5 times per 15 minutes", () => {
    const api = loadBackend({ ADMIN_PIN: PIN });
    const results = Array.from({ length: 200 }, () => api.post({ action: "VERIFY_PIN", adminPin: "000000" }).code);
    expect(results.filter((code) => code === "BAD_PIN")).toHaveLength(5);
    expect(results.at(-1)).toBe("LOCKED");
    api.advance(14);
    expect(api.post({ action: "VERIFY_PIN", adminPin: PIN }).code).toBe("LOCKED");
  });

  it("doesn't log out someone already signed in when an attacker triggers the lock", () => {
    const { api, admin } = openShop();
    for (let i = 0; i < 5; i++) api.post({ action: "VERIFY_PIN", adminPin: "bad" });
    expect(admin("LIST_INQUIRIES").status).toBe("success");
  });
});

describe("what the public catalogue gives away", () => {
  it("sends only the allow-listed fields, never holds or sale times", () => {
    const { add, pickup, confirm, shopItems } = openShop();
    const item = add();
    confirm(pickup([item.id]).inquiryId);
    for (const shown of shopItems()) expect(Object.keys(shown).sort()).toEqual(PUBLIC_FIELDS);
  });

  it("never shows customers, inquiries, postcodes or private settings", () => {
    const { api, add, post, confirm } = openShop({ NOTIFY_EMAIL: "owner@example.com" });
    const item = add();
    const { inquiryId } = post([item.id], { customerName: "Nurul Rahsia", customerPhone: "019-888 7777", postcode: "40150", notes: "nota rahsia" });
    confirm(inquiryId);
    const publicData = JSON.stringify(api.get());
    for (const secret of ["Nurul Rahsia", "0198887777", "40150", "nota rahsia", inquiryId, "INQ-", PIN, "folder", "owner@example.com", "reservedFor", "reservedUntil", "soldAt"]) {
      expect(publicData).not.toContain(secret);
    }
  });

  it("never shows drafts or hidden items, even by id", () => {
    const { api, add, admin, pickup } = openShop();
    const draft = add({ status: "Draf", name: "Kod rahsia draf" });
    const hidden = add({ name: "Kod rahsia sembunyi" });
    admin("SET_ITEM_STATUS", { itemId: hidden.id, status: "Disembunyi" });
    expect(JSON.stringify(api.get())).not.toContain("rahsia");
    // Asking about them by id says only that they can't be had: no name, no code.
    const res = pickup([draft.id, hidden.id]);
    expect(res).toMatchObject({ code: "UNAVAILABLE", unavailable: [draft.id, hidden.id] });
    expect(JSON.stringify(res)).not.toContain("rahsia");
    expect(JSON.stringify(res)).not.toContain("HFP-");
  });

  it("filters out a photo address that is not a Drive thumbnail, even if one reaches the sheet", () => {
    const { api, add, shopItem } = openShop();
    const item = add({ photos: [PHOTO] });
    const row = api.sheets.get("Items")!.find((r) => r[0] === item.id)!;
    row[13] = JSON.stringify([PHOTO, "javascript:alert(1)", "https://evil.example/pixel.gif"]);
    expect(shopItem(item.id)!.photos).toEqual([PHOTO]);
  });
});

describe("the admin item list", () => {
  it("shows drafts and hidden items only to a signed-in admin", () => {
    const { api, add, admin } = openShop();
    add({ status: "Draf", name: "Draf rahsia" });
    expect(JSON.stringify(api.post({ action: "LIST_ITEMS" }))).not.toContain("rahsia");
    expect(admin("LIST_ITEMS").items.map((i: { name: string; status: string }) => [i.name, i.status])).toEqual([["Draf rahsia", "Draf"]]);
  });

  it("names the inquiry holding an item only while the hold lasts", () => {
    const { api, add, admin, pickup, confirm } = openShop();
    const item = add();
    const { inquiryId } = pickup([item.id]);
    confirm(inquiryId);
    expect(admin("LIST_ITEMS").items[0]).toMatchObject({ status: "Reserved", reservedFor: inquiryId });
    api.advance(30);
    expect(admin("LIST_ITEMS").items[0]).toMatchObject({ status: "Available", reservedFor: "", holdUntil: "" });
  });
});

describe("hostile inquiries", () => {
  it("uses the sheet's names and prices, not the request's, and charges postage itself", () => {
    const { add, post, inquiries } = openShop();
    const item = add();
    const res = post([item.id], { items: [{ id: item.id, name: "Percuma", price: 0.01 }], total: 0.01, postage: 0, itemsTotal: 0 });
    expect(res).toMatchObject({ itemsTotal: 25, postage: 10, total: 35 });
    expect(inquiries()[0].items).toEqual([{ id: item.id, code: "HFP-001", name: "Blaus Linen Putih", price: 25 }]);
  });

  it("counts a repeated item once", () => {
    const { add, pickup } = openShop();
    const item = add();
    expect(pickup(Array.from({ length: 50 }, () => item.id))).toMatchObject({ status: "success", itemsTotal: 25 });
  });

  it("refuses an order of more than 30 items", () => {
    const { add, pickup } = openShop();
    const ids = Array.from({ length: 31 }, () => add().id);
    expect(pickup(ids).status).toBe("error");
  });

  it.each([[[]], [[null, 5, {}]], [["nope"]], ["not a list"], [null], [{ 0: "x" }]])("logs nothing for garbage items: %j", (itemIds) => {
    const { api, pickup } = openShop();
    expect(pickup(itemIds).status).toBe("error");
    expect(api.sheets.get("Inquiries")).toHaveLength(1);
  });

  it("logs nothing, and touches no item, when any item is reserved or sold", () => {
    const { api, add, pickup, confirm, setStatus, shopItem } = openShop();
    const free = add();
    const held = add();
    const sold = add();
    confirm(pickup([held.id]).inquiryId);
    const s = pickup([sold.id]).inquiryId;
    confirm(s);
    setStatus(s, "Dibayar");
    setStatus(s, "Diambil");
    const rowsBefore = api.sheets.get("Inquiries")!.length;
    const res = pickup([free.id, held.id, sold.id]);
    expect(res).toMatchObject({ code: "UNAVAILABLE", unavailable: [held.id, sold.id] });
    expect(api.sheets.get("Inquiries")).toHaveLength(rowsBefore);
    expect(shopItem(free.id)!.status).toBe("Available");
  });

  it("can't reserve or sell anything from the public side", () => {
    const { api, add, shopItem } = openShop();
    const item = add();
    for (const action of ["SUBMIT_INQUIRY", "CONFIRM_INQUIRY", "SET_INQUIRY_STATUS", "SET_ITEM_STATUS"]) {
      api.post({ action, ...buyer, deliveryMethod: "pickup", pickupPreference: "Esok", itemIds: [item.id], itemId: item.id, status: "Sold" });
    }
    expect(shopItem(item.id)!.status).toBe("Available");
  });

  it.each([["ship"], [""], [null], [["post"]], ["PICKUP"], ["__proto__"]])("refuses the delivery method %j", (deliveryMethod) => {
    const { add, pickup } = openShop();
    expect(pickup([add().id], { deliveryMethod }).status).toBe("error");
  });

  it.each([
    ["an unknown state", { postState: "Atlantis" }],
    ["a state with a formula", { postState: "=Selangor" }],
    ["a state with a new line", { postState: "Selangor\nBcc: x" }],
    ["the prototype as a state", { postState: "__proto__" }],
    ["a short postcode", { postcode: "4015" }],
    ["a long postcode", { postcode: "401500" }],
    ["a postcode with a space", { postcode: "40150 " }],
    ["a postcode as a number", { postcode: 40150 }],
    ["a postcode with a formula", { postcode: "=1234" }],
    ["no postcode", { postcode: undefined }],
  ])("refuses %s", (_label, over) => {
    const { add, post } = openShop();
    expect(post([add().id], over).status).toBe("error");
  });

  it.each([["abc"], ["12"], ["=1+1"], ["0123456789012345678"], [""], [123456789], [`0123456789${" ".repeat(30)}12345678`]])("refuses the phone number %j", (customerPhone) => {
    const { add, pickup } = openShop();
    expect(pickup([add().id], { customerPhone }).status).toBe("error");
  });

  it("refuses a pickup with no time and an order with no name", () => {
    const { add, pickup } = openShop();
    expect(pickup([add().id], { pickupPreference: "" }).status).toBe("error");
    expect(pickup([add().id], { customerName: "   " }).status).toBe("error");
  });

  it("never stores a home address, whatever field it arrives in", () => {
    const { add, post, allCells } = openShop();
    const address = "No 12, Jalan Rahsia 3, Taman Contoh";
    post([add().id], { address, customerAddress: address, alamat: address, extra: { address } });
    expect(allCells()).not.toContain("Jalan Rahsia");
  });

  it.each([["=1+1"], [" =1+1"], ["\n=1+1"], ["\t=1+1"], ["+1"], ["-1"], ["@SUM(A1)"], ["|cmd"], ["＝1+1"]])("neutralises the formula %j in every free-text field", (text) => {
    const { api, add, pickup } = openShop();
    pickup([add().id], { customerName: text, pickupPreference: text, notes: text });
    const row = api.sheets.get("Inquiries")!.at(-1)!;
    for (const column of [2, 5, 12]) expect(String(row[column]).trim().startsWith("'")).toBe(true);
  });

  it("stores the phone and postcode as text, so Sheets can't read them as numbers or formulas", () => {
    const { api, add, post } = openShop();
    post([add().id], { customerPhone: "+60 12-345 6789", postcode: "05000" });
    const row = api.sheets.get("Inquiries")!.at(-1)!;
    expect(row[3]).toBe("'+60123456789");
    expect(row[7]).toBe("'05000");
  });

  it("keeps a new line out of the email subject", () => {
    const { add, pickup, api } = openShop({ NOTIFY_EMAIL: "owner@example.com" });
    pickup([add().id], { customerName: "Hi\nBcc: victim@example.com" });
    expect(api.sentEmails[0].subject).not.toContain("\n");
  });

  it("caps long text in the sheet and in the email", () => {
    const { api, add, pickup } = openShop({ NOTIFY_EMAIL: "owner@example.com" });
    const huge = "x".repeat(100000);
    pickup([add().id], { customerName: huge, pickupPreference: huge, notes: huge });
    const row = api.sheets.get("Inquiries")!.at(-1)!;
    expect(String(row[2]).length).toBeLessThanOrEqual(80);
    expect(String(row[12]).length).toBeLessThanOrEqual(1001);
    expect(api.sentEmails[0].body.length).toBeLessThanOrEqual(1500);
  });

  it("limits a flood to 30 inquiries an hour, and the emails with it", () => {
    const { api, add, pickup } = openShop({ NOTIFY_EMAIL: "owner@example.com" });
    const item = add();
    const accepted = Array.from({ length: 500 }, () => pickup([item.id])).filter((r) => r.status === "success");
    expect(accepted).toHaveLength(30);
    expect(api.sentEmails).toHaveLength(30);
    api.advance(60);
    expect(pickup([item.id]).status).toBe("success");
  });

  it("doesn't let a flood of unavailable items use up the hour's limit", () => {
    const { add, pickup } = openShop();
    const item = add();
    for (let i = 0; i < 100; i++) pickup(["missing"]);
    expect(pickup([item.id]).status).toBe("success");
  });

  it("isn't fooled by prototype keys", () => {
    const { api, add, pickup } = openShop();
    const item = add();
    for (const id of ["__proto__", "constructor", "toString", "hasOwnProperty", "valueOf"]) {
      expect(pickup([id]).status).toBe("error");
    }
    api.postRaw(JSON.stringify({ action: "SUBMIT_INQUIRY", ...buyer, deliveryMethod: "pickup", pickupPreference: "Esok", itemIds: [item.id] }).replace('"action"', '"__proto__":{"admin":true,"token":"x"},"action"'));
    expect(({} as Record<string, unknown>).admin).toBeUndefined();
    expect(Object.prototype).not.toHaveProperty("token");
  });
});

describe("hostile uploads", () => {
  const html = `data:image/jpeg;base64,${Buffer.from("<script>alert(1)</script>").toString("base64")}`;
  const svg = `data:image/svg+xml;base64,${Buffer.from("<svg onload=alert(1)>").toString("base64")}`;
  const png = `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]).toString("base64")}`;
  const huge = `data:image/jpeg;base64,${Buffer.alloc(3 * 1024 * 1024, 0xff).toString("base64")}`;

  it.each([
    ["HTML dressed as a JPEG", html],
    ["an SVG", svg],
    ["a PNG", png],
    ["a file over 2 MB", huge],
    ["broken base64", "data:image/jpeg;base64,/9j/4AAQ$$$"],
    ["an empty image", "data:image/jpeg;base64,"],
    ["no data URL at all", "/9j/4AAQSkZJRg=="],
    ["a number", 12345],
    ["an object", { src: JPEG }],
  ])("refuses %s", (_label, imageBase64) => {
    const { admin, api } = openShop();
    expect(admin("UPLOAD_PHOTO", { imageBase64 }).status).toBe("error");
    expect(api.uploads).toHaveLength(0);
  });
});

describe("hostile item edits, even with a valid session", () => {
  it.each([
    ["javascript:", "javascript:alert(1)"],
    ["plain http", "http://drive.google.com/thumbnail?id=1DriveFile00000001&sz=w1200"],
    ["another host", "https://evil.example/thumbnail?id=1DriveFile00000001&sz=w1200"],
    ["a look-alike host", "https://drive.google.com.evil.example/thumbnail?id=1DriveFile00000001&sz=w1200"],
    ["a protocol-relative address", "//evil.example/x.jpg"],
    ["a data URL", "data:image/svg+xml,<svg onload=alert(1)>"],
    ["an attribute break-out", 'https://drive.google.com/thumbnail?id=1DriveFile00000001"onerror="alert(1)&sz=w1200'],
    ["an extra parameter", "https://drive.google.com/thumbnail?id=1DriveFile00000001&sz=w1200&redirect=evil"],
  ])("refuses a photo address that is %s", (_label, url) => {
    const { admin } = openShop();
    expect(admin("SAVE_ITEM", { item: { ...baseItem, photos: [url] } }).status).toBe("error");
  });

  it("refuses more than 5 photos", () => {
    const { admin } = openShop();
    expect(admin("SAVE_ITEM", { item: { ...baseItem, photos: Array(6).fill(PHOTO) } }).status).toBe("error");
  });

  it.each([[-1], [Number.NaN], ["abc"], ["1e9"], [1e9], [true], [null], [""], [[25]], [{ value: 25 }]])("refuses the price %j", (price) => {
    const { admin } = openShop();
    expect(admin("SAVE_ITEM", { item: { ...baseItem, price } }).status).toBe("error");
  });

  it.each([[{ chest: -5 }], [{ chest: 9999 }], [{ chest: [48] }], [{ chest: true }], [{ chest: "48cm" }], [{ chest: "1e2" }]])("refuses the measurements %j", (measurements) => {
    const { admin } = openShop();
    expect(admin("SAVE_ITEM", { item: { ...baseItem, measurements } }).status).toBe("error");
  });

  it("drops unknown measurement keys instead of storing them", () => {
    const { admin, shopItems } = openShop();
    const evil = JSON.parse('{"chest": 48, "__proto__": {"polluted": true}, "script": "<b>x</b>"}');
    admin("SAVE_ITEM", { item: { ...baseItem, measurements: evil } });
    expect(shopItems()[0].measurements).toEqual({ chest: 48 });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it.each([["Reserved"], ["Sold"], ["Hacked"], [null]])("won't set the status %j through the item form", (status) => {
    const { admin, api } = openShop();
    expect(admin("SAVE_ITEM", { item: { ...baseItem, status } }).status).toBe("error");
    expect(api.get().items).toHaveLength(0);
  });

  it.each([["category", "Hacked"], ["condition", "Excellent"], ["category", "=1+1"], ["condition", null]])("refuses %s %j", (field, value) => {
    const { admin } = openShop();
    expect(admin("SAVE_ITEM", { item: { ...baseItem, [field]: value } }).status).toBe("error");
  });

  it("can't create an item with an id of its choosing, or change a code", () => {
    const { admin, add, shopItem, api } = openShop();
    expect(admin("SAVE_ITEM", { item: { ...baseItem, id: "ITM-chosen" } }).status).toBe("error");
    const item = add();
    admin("SAVE_ITEM", { item: { ...baseItem, id: item.id, code: "HFP-999" } });
    expect(shopItem(item.id)!.code).toBe("HFP-001");
    expect(api.get().items).toHaveLength(1);
  });

  it("neutralises formulas in every text field the lister types", () => {
    const { admin, api } = openShop();
    admin("SAVE_ITEM", { item: { ...baseItem, name: "=IMPORTXML(1)", colour: "+1", brand: "@x", size: "-1", description: "=1", condition: "Ada kecacatan", flawNotes: "=2" } });
    const row = api.sheets.get("Items")!.at(-1)!;
    for (const column of [2, 3, 5, 6, 8, 12]) expect(String(row[column]).startsWith("'")).toBe(true);
  });
});

describe("abusing the order flow", () => {
  it("won't confirm an inquiry twice, or one already cancelled", () => {
    const { add, pickup, confirm, setStatus } = openShop();
    const a = pickup([add().id]).inquiryId;
    expect(confirm(a).status).toBe("success");
    expect(confirm(a).code).toBe("BAD_STATE");
    const b = pickup([add().id]).inquiryId;
    setStatus(b, "Batal");
    expect(confirm(b).code).toBe("BAD_STATE");
  });

  it("only reserves items the buyer asked for", () => {
    const { add, pickup, confirm, shopItem } = openShop();
    const asked = add();
    const other = add();
    const { inquiryId } = pickup([asked.id]);
    expect(confirm(inquiryId, [other.id]).status).toBe("error");
    expect(shopItem(other.id)!.status).toBe("Available");
  });

  it("reserves all or nothing when one item is already taken", () => {
    const { add, pickup, confirm, shopItem } = openShop();
    const a = add();
    const b = add();
    const first = pickup([b.id]).inquiryId;
    const second = pickup([a.id, b.id]).inquiryId;
    confirm(first);
    expect(confirm(second)).toMatchObject({ code: "UNAVAILABLE", unavailable: ["HFP-002"] });
    expect(shopItem(a.id)!.status).toBe("Available");
  });

  it("gives an item to only one of two buyers who ask at once", () => {
    const { add, pickup, confirm } = openShop();
    const item = add();
    const first = pickup([item.id]).inquiryId;
    const second = pickup([item.id]).inquiryId;
    const results = [confirm(first), confirm(second)].map((r) => r.status);
    expect(results).toEqual(["success", "error"]);
  });

  const steps: Record<string, string[]> = {
    Baru: ["Dibayar", "Dihantar", "Diambil", "Selesai", "Disahkan", "Baru"],
    Disahkan: ["Dihantar", "Diambil", "Selesai", "Baru", "Disahkan"],
    Dibayar: ["Baru", "Disahkan", "Selesai", "Dibayar"],
    Selesai: ["Baru", "Batal", "Dibayar", "Disahkan"],
    Batal: ["Baru", "Disahkan", "Dibayar", "Dihantar", "Diambil", "Selesai"],
  };

  it.each(Object.entries(steps).flatMap(([from, tos]) => tos.map((to) => [from, to])))("refuses %s to %s", (from, to) => {
    const { add, post, confirm, setStatus, inquiry } = openShop();
    const { inquiryId } = post([add().id]);
    if (from !== "Baru" && from !== "Batal") confirm(inquiryId);
    if (from === "Dibayar" || from === "Selesai") setStatus(inquiryId, "Dibayar");
    if (from === "Selesai") {
      setStatus(inquiryId, "Dihantar", "ER123456789MY");
      setStatus(inquiryId, "Selesai");
    }
    if (from === "Batal") setStatus(inquiryId, "Batal");
    expect(inquiry(inquiryId).status).toBe(from);
    expect(setStatus(inquiryId, to, "ER123456789MY").status).toBe("error");
    expect(inquiry(inquiryId).status).toBe(from);
  });

  it("won't mark a pickup order posted, or a posted order collected", () => {
    const { add, pickup, post, confirm, setStatus } = openShop();
    const p = pickup([add().id]).inquiryId;
    confirm(p);
    setStatus(p, "Dibayar");
    expect(setStatus(p, "Dihantar", "ER123456789MY").code).toBe("BAD_STATE");
    const s = post([add().id]).inquiryId;
    confirm(s);
    setStatus(s, "Dibayar");
    expect(setStatus(s, "Diambil").code).toBe("BAD_STATE");
  });

  it.each([[undefined], [""], ["abc"], ["=HYPERLINK(\"http://evil\",\"klik\")"], ["ER123<script>"], ["x".repeat(41)]])("refuses the tracking number %j", (trackingNo) => {
    const { add, post, confirm, setStatus, shopItem } = openShop();
    const item = add();
    const { inquiryId } = post([item.id]);
    confirm(inquiryId);
    setStatus(inquiryId, "Dibayar");
    expect(setStatus(inquiryId, "Dihantar", trackingNo).status).toBe("error");
    expect(shopItem(item.id)!.status).toBe("Reserved");
  });

  it("can't release another buyer's hold by cancelling a stale order", () => {
    const { api, add, pickup, confirm, setStatus, shopItem } = openShop();
    const item = add();
    const first = pickup([item.id]).inquiryId;
    confirm(first);
    api.advance(31);
    const second = pickup([item.id]).inquiryId;
    confirm(second);
    expect(setStatus(first, "Batal").status).toBe("success");
    expect(shopItem(item.id)!.status).toBe("Reserved");
  });

  it("can't sell an item that went to someone else after the hold ran out", () => {
    const { api, add, pickup, confirm, setStatus, shopItem, inquiry } = openShop();
    const item = add();
    const first = pickup([item.id]).inquiryId;
    confirm(first);
    api.advance(31);
    confirm(pickup([item.id]).inquiryId);
    expect(setStatus(first, "Dibayar").code).toBe("UNAVAILABLE");
    expect(inquiry(first).status).toBe("Disahkan");
    expect(shopItem(item.id)!.status).toBe("Reserved");
  });

  it("won't hide, delete or re-list an item that is held or sold", () => {
    const { add, admin, pickup, confirm, setStatus, shopItem } = openShop();
    const held = add();
    confirm(pickup([held.id]).inquiryId);
    const sold = add();
    const s = pickup([sold.id]).inquiryId;
    confirm(s);
    setStatus(s, "Dibayar");
    setStatus(s, "Diambil");
    for (const item of [held, sold]) {
      expect(admin("SET_ITEM_STATUS", { itemId: item.id, status: "Available" }).code).toBe("LOCKED_ITEM");
      expect(admin("DELETE_ITEM", { itemId: item.id }).code).toBe("LOCKED_ITEM");
      admin("SAVE_ITEM", { item: { ...baseItem, id: item.id, status: "Available" } });
    }
    expect(shopItem(held.id)!.status).toBe("Reserved");
    expect(shopItem(sold.id)!.status).toBe("Sold");
  });
});

describe("failures and information leaks", () => {
  it.each([["{not json"], ["null"], ["[]"], ['"text"'], [""], ["1"], ["true"]])("gives a plain error for the malformed request %j", (body) => {
    const res = loadBackend({ ADMIN_PIN: PIN }).postRaw(body);
    expect(res.status).toBe("error");
    expect(res.message).not.toMatch(/SyntaxError|TypeError|ReferenceError|position|undefined|null|stack/i);
  });

  it("gives a plain error when the request has no body at all", () => {
    const api = loadBackend({ ADMIN_PIN: PIN });
    for (const event of [{}, { postData: null }, undefined]) {
      expect(api.postEvent(event).message).toBe("Ralat pelayan. Sila cuba lagi.");
    }
  });

  it("writes nothing when the lock can't be had", () => {
    const { api, add, pickup } = openShop();
    const item = add();
    api.lock.failNext = true;
    const res = pickup([item.id]);
    expect(res).toMatchObject({ status: "error", message: "Ralat pelayan. Sila cuba lagi." });
    expect(api.sheets.get("Inquiries")).toHaveLength(1);
  });

  it("takes the shop's number from private settings, not from the code", () => {
    expect(openShop().api.get().whatsappNumber).toBe(NUMBER);
  });
});
