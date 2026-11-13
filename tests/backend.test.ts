import { describe, expect, it } from "vitest";
import { JPEG, loadBackend, PHOTO } from "./fakeAppsScript";
import { baseItem, openShop, PIN } from "./shop";

describe("admin login", () => {
  it("gives a session only for the right passcode", () => {
    const api = loadBackend();
    expect(api.post({ action: "VERIFY_PIN", adminPin: "000000" }).code).toBe("BAD_PIN");
    expect(api.post({ action: "VERIFY_PIN", adminPin: PIN }).token).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("locks after repeated failures, even for the right passcode", () => {
    const api = loadBackend();
    for (let i = 0; i < 5; i++) api.post({ action: "VERIFY_PIN", adminPin: "bad" });
    expect(api.post({ action: "VERIFY_PIN", adminPin: PIN }).code).toBe("LOCKED");
  });

  it("unlocks again once the 15 minutes are up", () => {
    const api = loadBackend();
    for (let i = 0; i < 5; i++) api.post({ action: "VERIFY_PIN", adminPin: "bad" });
    api.advance(15);
    expect(api.post({ action: "VERIFY_PIN", adminPin: PIN }).status).toBe("success");
  });

  it("refuses to log anyone in until a passcode is configured", () => {
    expect(loadBackend({}).post({ action: "VERIFY_PIN", adminPin: "" }).code).toBe("NOT_CONFIGURED");
  });

  it("ends the session on logout", () => {
    const { admin } = openShop();
    expect(admin("LOGOUT").status).toBe("success");
    expect(admin("LIST_INQUIRIES").code).toBe("BAD_SESSION");
  });
});

describe("items", () => {
  it("numbers new items HFP-001, HFP-002 and onwards", () => {
    const { add } = openShop();
    expect([add().code, add().code, add().code]).toEqual(["HFP-001", "HFP-002", "HFP-003"]);
  });

  it("never reuses a code after an item is deleted", () => {
    const { add, admin } = openShop();
    add();
    const second = add();
    expect(admin("DELETE_ITEM", { itemId: second.id }).status).toBe("success");
    expect(add().code).toBe("HFP-003");
  });

  it("shows the shop exactly the public fields", () => {
    const { add, shopItems } = openShop();
    add({ description: "Linen ringan.", originalPrice: 89, photos: [PHOTO] });
    const [item] = shopItems();
    expect(Object.keys(item).sort()).toEqual(["brand", "category", "code", "colour", "condition", "createdAt", "description", "flawNotes", "id", "measurements", "name", "originalPrice", "photos", "price", "size", "status"]);
    expect(item).toMatchObject({ code: "HFP-001", name: "Blaus Linen Putih", price: 25, originalPrice: 89, status: "Available", measurements: { chest: 48, length: 66 }, photos: [PHOTO] });
  });

  it("keeps the code and first-listed time when an item is edited", () => {
    const { api, add, admin, shopItem } = openShop();
    const item = add();
    const listed = shopItem(item.id)!.createdAt;
    api.advance(60);
    admin("SAVE_ITEM", { item: { ...baseItem, id: item.id, name: "Blaus Linen Putih (M)", price: 22 } });
    expect(shopItem(item.id)).toMatchObject({ code: "HFP-001", name: "Blaus Linen Putih (M)", price: 22, createdAt: listed });
  });

  it("keeps drafts and hidden items out of the shop", () => {
    const { add, shopItems, admin } = openShop();
    add({ status: "Draf", name: "Draf rahsia" });
    const hidden = add({ name: "Tersembunyi" });
    admin("SET_ITEM_STATUS", { itemId: hidden.id, status: "Disembunyi" });
    add({ name: "Dijual" });
    expect(shopItems().map((i) => i.name)).toEqual(["Dijual"]);
  });

  it("asks for flaw notes on a flawed item", () => {
    const { admin } = openShop();
    expect(admin("SAVE_ITEM", { item: { ...baseItem, condition: "Ada kecacatan" } }).status).toBe("error");
    expect(admin("SAVE_ITEM", { item: { ...baseItem, condition: "Ada kecacatan", flawNotes: "Satu butang tertanggal." } }).status).toBe("success");
  });

  it("uploads a JPEG to Drive and returns its public address", () => {
    const { admin, api } = openShop();
    const res = admin("UPLOAD_PHOTO", { imageBase64: JPEG });
    expect(res.url).toBe(PHOTO);
    expect(api.uploads[0].mime).toBe("image/jpeg");
  });

  it("reports an error instead of silently dropping a photo when Drive isn't set up", () => {
    const { admin } = openShop({ DRIVE_FOLDER_ID: undefined });
    expect(admin("UPLOAD_PHOTO", { imageBase64: JPEG }).status).toBe("error");
  });

  it("deletes an item that never sold", () => {
    const { add, admin, shopItems } = openShop();
    const item = add();
    expect(admin("DELETE_ITEM", { itemId: item.id }).status).toBe("success");
    expect(admin("DELETE_ITEM", { itemId: item.id }).status).toBe("error");
    expect(shopItems()).toEqual([]);
  });
});

describe("inquiries", () => {
  it("logs a pickup inquiry with the sheet's prices and no postage", () => {
    const { add, pickup, inquiries } = openShop();
    const a = add();
    const b = add({ name: "Seluar Slack", price: 30.5 });
    const res = pickup([a.id, b.id]);
    expect(res).toMatchObject({ status: "success", itemsTotal: 55.5, postage: 0, total: 55.5 });
    expect(inquiries()[0]).toMatchObject({ status: "Baru", deliveryMethod: "pickup", pickupPreference: "Esok, 14 Nov, 2 hingga 5 petang", postage: 0 });
    expect(inquiries()[0].items).toEqual([
      { id: a.id, code: "HFP-001", name: "Blaus Linen Putih", price: 25 },
      { id: b.id, code: "HFP-002", name: "Seluar Slack", price: 30.5 },
    ]);
  });

  it("adds a flat RM10 for postage however many items there are", () => {
    const { add, post } = openShop();
    const one = post([add().id]);
    const three = post([add().id, add().id, add().id]);
    expect(one).toMatchObject({ postage: 10, total: 35 });
    expect(three).toMatchObject({ postage: 10, itemsTotal: 75, total: 85 });
  });

  it("keeps the postcode's leading zero and the phone's", () => {
    const { add, post, inquiries } = openShop();
    post([add().id], { postState: "W.P. Kuala Lumpur", postcode: "05000", customerPhone: "012-345 6789" });
    expect(inquiries()[0]).toMatchObject({ postState: "W.P. Kuala Lumpur", postcode: "05000", customerPhone: "0123456789" });
  });

  it("emails only when an address is configured", () => {
    const silent = openShop();
    silent.pickup([silent.add().id]);
    expect(silent.api.sentEmails).toHaveLength(0);

    const notified = openShop({ NOTIFY_EMAIL: "owner@example.com" });
    notified.post([notified.add().id]);
    expect(notified.api.sentEmails).toHaveLength(1);
    expect(notified.api.sentEmails[0].body).toContain("HFP-001");
  });
});

describe("holding and selling", () => {
  it("reserves the items for 30 minutes when Mama confirms", () => {
    const { add, pickup, confirm, shopItem, inquiry } = openShop();
    const item = add();
    const { inquiryId } = pickup([item.id]);
    const res = confirm(inquiryId);
    expect(res.status).toBe("success");
    expect(Date.parse(res.holdUntil) - Date.UTC(2026, 10, 13, 2, 0, 0)).toBe(30 * 60 * 1000);
    expect(shopItem(item.id)!.status).toBe("Reserved");
    expect(inquiry(inquiryId)).toMatchObject({ status: "Disahkan", confirmed: [item.id], holdUntil: res.holdUntil });
  });

  it("puts an unpaid item back on sale once the 30 minutes run out", () => {
    const { api, add, pickup, confirm, shopItem } = openShop();
    const item = add();
    confirm(pickup([item.id]).inquiryId);
    api.advance(29);
    expect(shopItem(item.id)!.status).toBe("Reserved");
    api.advance(1);
    expect(shopItem(item.id)!.status).toBe("Available");
  });

  it("keeps a paid hold for good", () => {
    const { api, add, pickup, confirm, setStatus, shopItem, inquiry } = openShop();
    const item = add();
    const { inquiryId } = pickup([item.id]);
    confirm(inquiryId);
    expect(setStatus(inquiryId, "Dibayar").status).toBe("success");
    api.advance(60 * 24);
    expect(shopItem(item.id)!.status).toBe("Reserved");
    expect(inquiry(inquiryId).holdUntil).toBe("");
  });

  it("lets a late payment through when nobody took the item meanwhile", () => {
    const { api, add, pickup, confirm, setStatus, shopItem } = openShop();
    const item = add();
    const { inquiryId } = pickup([item.id]);
    confirm(inquiryId);
    api.advance(45);
    expect(setStatus(inquiryId, "Dibayar").status).toBe("success");
    expect(shopItem(item.id)!.status).toBe("Reserved");
  });

  it("refuses a late payment once another buyer has the item", () => {
    const { api, add, pickup, confirm, setStatus } = openShop();
    const item = add();
    const first = pickup([item.id]).inquiryId;
    confirm(first);
    api.advance(31);
    const second = pickup([item.id]).inquiryId;
    expect(confirm(second).status).toBe("success");
    const late = setStatus(first, "Dibayar");
    expect(late).toMatchObject({ status: "error", code: "UNAVAILABLE", unavailable: ["HFP-001"] });
  });

  it("posts a paid order with its tracking number and marks it sold", () => {
    const { add, post, confirm, setStatus, shopItem, inquiry } = openShop();
    const item = add();
    const { inquiryId } = post([item.id]);
    confirm(inquiryId);
    setStatus(inquiryId, "Dibayar");
    expect(setStatus(inquiryId, "Dihantar", "ER123456789MY").status).toBe("success");
    expect(shopItem(item.id)!.status).toBe("Sold");
    expect(inquiry(inquiryId)).toMatchObject({ status: "Dihantar", trackingNo: "ER123456789MY" });
    expect(setStatus(inquiryId, "Selesai").status).toBe("success");
  });

  it("marks a collected order sold", () => {
    const { add, pickup, confirm, setStatus, shopItem } = openShop();
    const item = add();
    const { inquiryId } = pickup([item.id]);
    confirm(inquiryId);
    setStatus(inquiryId, "Dibayar");
    expect(setStatus(inquiryId, "Diambil").status).toBe("success");
    expect(shopItem(item.id)!.status).toBe("Sold");
  });

  it("shows sold items for 14 days, then drops them from the shop", () => {
    const { api, add, pickup, confirm, setStatus, shopItem } = openShop();
    const item = add();
    const { inquiryId } = pickup([item.id]);
    confirm(inquiryId);
    setStatus(inquiryId, "Dibayar");
    setStatus(inquiryId, "Diambil");
    api.advance(14 * 24 * 60);
    expect(shopItem(item.id)!.status).toBe("Sold");
    api.advance(1);
    expect(shopItem(item.id)).toBeUndefined();
  });

  it("reserves only the items Mama picks", () => {
    const { add, pickup, confirm, shopItem, inquiry } = openShop();
    const a = add();
    const b = add();
    const { inquiryId } = pickup([a.id, b.id]);
    expect(confirm(inquiryId, [b.id]).status).toBe("success");
    expect(shopItem(a.id)!.status).toBe("Available");
    expect(shopItem(b.id)!.status).toBe("Reserved");
    expect(inquiry(inquiryId).confirmed).toEqual([b.id]);
  });

  it("puts the items back on sale when an order is cancelled", () => {
    const { add, pickup, confirm, setStatus, shopItem } = openShop();
    const item = add();
    const { inquiryId } = pickup([item.id]);
    confirm(inquiryId);
    setStatus(inquiryId, "Dibayar");
    expect(setStatus(inquiryId, "Batal").status).toBe("success");
    expect(shopItem(item.id)!.status).toBe("Available");
  });

  it("lets the lister release an item whose hold has run out", () => {
    const { api, add, admin, pickup, confirm, shopItem } = openShop();
    const item = add();
    confirm(pickup([item.id]).inquiryId);
    api.advance(31);
    expect(admin("SET_ITEM_STATUS", { itemId: item.id, status: "Disembunyi" }).status).toBe("success");
    expect(shopItem(item.id)).toBeUndefined();
  });

  it("changes only single cells of an inquiry, so customers' text can't become a live formula", () => {
    const { api, add, pickup, confirm, setStatus } = openShop();
    const { inquiryId } = pickup([add().id], { customerName: "=HYPERLINK(\"http://evil\")" });
    confirm(inquiryId);
    setStatus(inquiryId, "Dibayar");
    setStatus(inquiryId, "Diambil");
    expect(api.rowRewrites.filter((tab) => tab === "Inquiries")).toEqual([]);
  });
});
