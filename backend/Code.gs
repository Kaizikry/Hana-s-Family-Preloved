/**
 * Hana's Family Preloved backend for Google Apps Script.
 *
 * Settings live in Script Properties (Project Settings > Script properties), not in this file,
 * because this file is in a public repository:
 *   ADMIN_PIN        required, the 6-digit admin passcode
 *   WHATSAPP_NUMBER  required, the number customers message, like 60123456789
 *   DRIVE_FOLDER_ID  required for photo uploads
 *   NOTIFY_EMAIL     optional, also emails each new inquiry to this address
 * The script keeps its own counters there too: pinFailures, pinLockedUntil, itemCounter.
 */

const ITEM_HEADERS = ["id", "code", "name", "colour", "category", "brand", "size", "condition", "flawNotes", "measurementsJson", "price", "originalPrice", "description", "photosJson", "status", "reservedFor", "reservedUntil", "createdAt", "updatedAt", "soldAt"];
const INQUIRY_HEADERS = ["inquiryId", "timestamp", "customerName", "customerPhone", "deliveryMethod", "pickupPreference", "postState", "postcode", "itemsJson", "itemsTotal", "postage", "total", "notes", "status", "confirmedJson", "holdUntil", "trackingNo", "updatedAt"];

const CATEGORIES = ["Wanita", "Lelaki", "Tudung & Selendang", "Kasut & Beg", "Aksesori"];
const CONDITIONS = ["Baru dengan tag", "Seperti baru", "Baik", "Ada kecacatan"];
const FLAWED = "Ada kecacatan";
const MEASUREMENT_KEYS = ["chest", "length", "shoulder", "sleeve", "waist", "hip", "inseam", "foot"];
const STATES = ["Johor", "Kedah", "Kelantan", "Melaka", "Negeri Sembilan", "Pahang", "Perak", "Perlis", "Pulau Pinang", "Sabah", "Sarawak", "Selangor", "Terengganu", "W.P. Kuala Lumpur", "W.P. Labuan", "W.P. Putrajaya"];

/** What the lister can set directly. Reserved and Sold only ever come from an inquiry. */
const LISTER_STATUSES = ["Draf", "Available", "Disembunyi"];
const PUBLIC_STATUSES = ["Available", "Reserved", "Sold"];
const INQUIRY_STATUSES = ["Baru", "Disahkan", "Dibayar", "Dihantar", "Diambil", "Selesai", "Batal"];
/** Baru moves on through CONFIRM_INQUIRY, which reserves the items; every other step is SET_INQUIRY_STATUS. */
const TRANSITIONS = {
  Baru: ["Batal"],
  Disahkan: ["Dibayar", "Batal"],
  Dibayar: ["Dihantar", "Diambil", "Batal"],
  Dihantar: ["Selesai"],
  Diambil: ["Selesai"],
  Selesai: [],
  Batal: [],
};

const POSTAGE_FEE = 10;
const HOLD_MINUTES = 30;
const SOLD_VISIBLE_DAYS = 14;
const CODE_PREFIX = "HFP-";

const MAX_PIN_FAILURES = 5;
const PIN_LOCK_MS = 15 * 60 * 1000;
const SESSION_SECONDS = 6 * 60 * 60; // The longest CacheService allows.
const MAX_INQUIRIES_PER_HOUR = 30;
const MAX_TEXT_LENGTH = 1000;
const MAX_ITEMS_PER_INQUIRY = 30;
const MAX_PHOTOS = 5;
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const MAX_PRICE = 100000;
const MAX_MEASUREMENT = 500;
const PHOTO_URL = /^https:\/\/drive\.google\.com\/thumbnail\?id=[A-Za-z0-9_-]{10,200}&sz=w\d{2,4}$/;
const TRACKING = /^[A-Za-z0-9 -]{6,40}$/;

const properties = () => PropertiesService.getScriptProperties();
const setting = (name) => properties().getProperty(name) || "";
const sheet = (name) => SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
const fail = (message, code, extra) => jsonResponse(Object.assign({ status: "error", message: message, code: code }, extra || {}));
const ok = (extra) => jsonResponse(Object.assign({ status: "success" }, extra || {}));
const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

/** One place for the clock, so tests can move it. */
function now() {
  return Date.now();
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  [["Items", ITEM_HEADERS], ["Inquiries", INQUIRY_HEADERS]].forEach(function (entry) {
    const tab = ss.getSheetByName(entry[0]) || ss.insertSheet(entry[0]);
    if (tab.getLastRow() === 0) tab.appendRow(entry[1]);
  });
}

/**
 * Sheets treats text starting with = + - @ as a formula, so without this anyone could plant a
 * formula through the public form. Text is also capped, so one request can't fill the sheet.
 */
function safeCell(value, max) {
  const text = String(value === undefined || value === null ? "" : value).slice(0, max || MAX_TEXT_LENGTH);
  return /^[\s]*[=+\-@|＝＋－＠]/.test(text) ? "'" + text : text;
}

/** Digits that must stay text: Sheets would turn "0123456789" into a number and drop the zero. */
const textCell = (digits) => "'" + digits;

/** Reads a cell back as text. Real Sheets drops a leading apostrophe; this handles stores that keep it. */
function readText(value) {
  if (value instanceof Date) return value.toISOString();
  return String(value === undefined || value === null ? "" : value).replace(/^'/, "");
}

/** Times are stored as ISO text, but Sheets may hand them back as Dates. */
function toMs(value) {
  if (value instanceof Date) return value.getTime();
  const ms = Date.parse(readText(value));
  return isNaN(ms) ? 0 : ms;
}

const iso = (ms) => new Date(ms).toISOString();

function cleanText(value, max) {
  return typeof value === "string" ? value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max) : "";
}

function parseJson(text, fallback) {
  try {
    const value = JSON.parse(readText(text));
    return value === null || value === undefined ? fallback : value;
  } catch (err) {
    return fallback; // One damaged row must not hide every other one.
  }
}

/** Rows as objects, each remembering its sheet row so single cells can be written back. */
function readRows(name) {
  const data = sheet(name).getDataRange().getValues();
  const headers = data.shift();
  return data.map(function (row, i) {
    const obj = { _row: i + 2 };
    headers.forEach(function (h, j) { obj[h] = row[j]; });
    return obj;
  });
}

/**
 * Writes single cells only. A row read with getValues and written back whole would turn customers'
 * neutralised text back into live formulas.
 */
function setCells(name, rowNumber, headers, values) {
  const tab = sheet(name);
  Object.keys(values).forEach(function (key) {
    tab.getRange(rowNumber, headers.indexOf(key) + 1).setValue(values[key]);
  });
}

const setItemCells = (item, values) => setCells("Items", item._row, ITEM_HEADERS, values);
const setInquiryCells = (inquiry, values) => setCells("Inquiries", inquiry._row, INQUIRY_HEADERS, values);

function findRow(name, idField, id) {
  if (typeof id !== "string" || !id) return null;
  return readRows(name).filter(function (row) { return readText(row[idField]) === id; })[0] || null;
}

/* ---------- Items ---------- */

/** A Reserved item whose unpaid hold has run out is Available again, without anyone touching it. */
function holdExpired(item) {
  return readText(item.status) === "Reserved" && toMs(item.reservedUntil) > 0 && toMs(item.reservedUntil) <= now();
}

function effectiveStatus(item) {
  const status = readText(item.status);
  if (holdExpired(item)) return "Available";
  return LISTER_STATUSES.concat(["Reserved", "Sold"]).indexOf(status) >= 0 ? status : "Draf";
}

/** Reserved by this inquiry, and not since taken by another after its hold ran out. */
const heldFor = (item, inquiryId) => readText(item.status) === "Reserved" && readText(item.reservedFor) === inquiryId;

function validPhotos(value) {
  return (Array.isArray(value) ? value : []).filter(function (url) { return typeof url === "string" && PHOTO_URL.test(url); }).slice(0, MAX_PHOTOS);
}

function readMeasurements(value) {
  const parsed = parseJson(value, {});
  const out = {};
  MEASUREMENT_KEYS.forEach(function (key) {
    const n = Number(parsed && typeof parsed === "object" && has(parsed, key) ? parsed[key] : NaN);
    if (isFinite(n) && n > 0 && n <= MAX_MEASUREMENT) out[key] = n;
  });
  return out;
}

/** The only shape of an item that ever leaves the script publicly: an allow-list, never the row. */
function publicItem(item) {
  return {
    id: readText(item.id),
    code: readText(item.code),
    name: readText(item.name),
    colour: readText(item.colour),
    category: readText(item.category),
    brand: readText(item.brand),
    size: readText(item.size),
    condition: readText(item.condition),
    flawNotes: readText(item.flawNotes),
    measurements: readMeasurements(item.measurementsJson),
    price: Number(item.price) || 0,
    originalPrice: Number(item.originalPrice) || 0,
    description: readText(item.description),
    photos: validPhotos(parseJson(item.photosJson, [])),
    status: effectiveStatus(item),
    createdAt: iso(toMs(item.createdAt)),
  };
}

function soldRecently(item) {
  return now() - toMs(item.soldAt) <= SOLD_VISIBLE_DAYS * 24 * 60 * 60 * 1000;
}

function shopItems() {
  return readRows("Items")
    .filter(function (item) {
      const status = effectiveStatus(item);
      return readText(item.id) && PUBLIC_STATUSES.indexOf(status) >= 0 && (status !== "Sold" || soldRecently(item));
    })
    .map(publicItem);
}

/* ---------- Requests ---------- */

/** GET: the shop's items and public numbers. Nothing about customers or holds is ever returned here. */
function doGet() {
  setupSheets();
  return ok({ items: shopItems(), whatsappNumber: setting("WHATSAPP_NUMBER"), postageFee: POSTAGE_FEE, holdMinutes: HOLD_MINUTES });
}

/** POST: customer inquiries, the passcode check, and admin actions that need a session. */
function doPost(e) {
  try {
    setupSheets();
    const payload = JSON.parse(e.postData.contents);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return fail("Permintaan tidak sah.");

    if (payload.action === "SUBMIT_INQUIRY") return withLock(function () { return submitInquiry(payload); });
    if (payload.action === "VERIFY_PIN") return withLock(function () { return verifyPin(payload.adminPin); });

    if (!hasSession(payload.token)) return fail("Sesi tamat. Sila log masuk semula.", "BAD_SESSION");

    if (payload.action === "LOGOUT") {
      CacheService.getScriptCache().remove("session:" + payload.token);
      return ok();
    }
    if (payload.action === "LIST_INQUIRIES") return listInquiries();
    if (payload.action === "LIST_ITEMS") return listItems();

    return withLock(function () {
      if (payload.action === "UPLOAD_PHOTO") return uploadPhoto(payload.imageBase64);
      if (payload.action === "SAVE_ITEM") return saveItem(payload.item);
      if (payload.action === "SET_ITEM_STATUS") return setItemStatus(payload.itemId, payload.status);
      if (payload.action === "DELETE_ITEM") return deleteItem(payload.itemId);
      if (payload.action === "CONFIRM_INQUIRY") return confirmInquiry(payload.inquiryId, payload.itemIds);
      if (payload.action === "SET_INQUIRY_STATUS") return setInquiryStatus(payload.inquiryId, payload.status, payload.trackingNo);
      return fail("Tindakan tidak dikenali.");
    });
  } catch (err) {
    // The details go to the Apps Script log, not to whoever sent the request.
    console.error(err);
    return fail("Ralat pelayan. Sila cuba lagi.");
  }
}

/** Requests run at the same time, so writes, holds and passcode tries take turns. */
function withLock(action) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    return action();
  } finally {
    lock.releaseLock();
  }
}

/* ---------- Admin login ---------- */

function verifyPin(pin) {
  const expected = setting("ADMIN_PIN");
  if (!expected) return fail("ADMIN_PIN belum ditetapkan dalam Script Properties.", "NOT_CONFIGURED");

  // Kept in Properties, because CacheService can forget a failure count early.
  const props = properties();
  if (now() < Number(props.getProperty("pinLockedUntil"))) {
    return fail("Terlalu banyak cubaan salah. Cuba lagi selepas 15 minit.", "LOCKED");
  }
  if (typeof pin !== "string" || pin !== expected) {
    const failures = Number(props.getProperty("pinFailures")) + 1;
    if (failures >= MAX_PIN_FAILURES) {
      props.setProperty("pinLockedUntil", String(now() + PIN_LOCK_MS));
      props.deleteProperty("pinFailures");
    } else {
      props.setProperty("pinFailures", String(failures));
    }
    return fail("Kod laluan salah.", "BAD_PIN");
  }
  props.deleteProperty("pinFailures");

  const token = Utilities.getUuid();
  CacheService.getScriptCache().put("session:" + token, "1", SESSION_SECONDS);
  return ok({ token: token });
}

function hasSession(token) {
  return typeof token === "string" && /^[0-9a-f-]{36}$/i.test(token) && CacheService.getScriptCache().get("session:" + token) === "1";
}

/* ---------- Inquiries from the public form ---------- */

/** Counts per clock hour. Going over only skips the log, because the customer still reaches WhatsApp. */
function overInquiryLimit() {
  const cache = CacheService.getScriptCache();
  const key = "inquiries:" + Math.floor(now() / 3600000);
  const count = Number(cache.get(key)) + 1;
  cache.put(key, String(count), 3600);
  return count > MAX_INQUIRIES_PER_HOUR;
}

function validPhone(phone) {
  const digits = phone.replace(/\D/g, "");
  return /^[+\d\s()-]+$/.test(phone) && digits.length >= 8 && digits.length <= 15;
}

/**
 * Names and prices come from the sheet, because anything in the request can be faked. Every item is
 * one of a kind, so an id counts once however often it is sent, and only an Available item can be
 * asked for. Nothing is logged unless every item still is.
 */
function submitInquiry(payload) {
  const name = cleanText(payload.customerName, 80);
  // Checked whole, never cut first: trimming could turn an invalid number into a valid-looking one.
  const phone = cleanText(payload.customerPhone, 200);
  if (phone.length > 40) return fail("Pertanyaan tidak lengkap.");
  const method = payload.deliveryMethod;
  if (!name || !validPhone(phone)) return fail("Pertanyaan tidak lengkap.");
  if (method !== "pickup" && method !== "post") return fail("Pilih cara penghantaran.");

  const pickup = method === "pickup" ? cleanText(payload.pickupPreference, 100) : "";
  const state = method === "post" ? payload.postState : "";
  const postcode = method === "post" ? payload.postcode : "";
  if (method === "pickup" && !pickup) return fail("Pilih masa ambil.");
  if (method === "post" && (STATES.indexOf(state) < 0 || typeof postcode !== "string" || !/^\d{5}$/.test(postcode))) return fail("Negeri atau poskod tidak sah.");

  const requested = Array.isArray(payload.itemIds) ? payload.itemIds : [];
  const ids = [];
  requested.forEach(function (id) { if (typeof id === "string" && id && ids.indexOf(id) < 0) ids.push(id); });
  if (ids.length === 0 || ids.length > MAX_ITEMS_PER_INQUIRY) return fail("Pertanyaan tidak lengkap.");

  const byId = {};
  readRows("Items").forEach(function (item) { byId[readText(item.id)] = item; });
  const unavailable = ids.filter(function (id) { return !has(byId, id) || effectiveStatus(byId[id]) !== "Available"; });
  if (unavailable.length) return fail("Ada item yang sudah ditempah atau tiada lagi.", "UNAVAILABLE", { unavailable: unavailable });

  if (overInquiryLimit()) return fail("Terlalu banyak pertanyaan. Sila cuba lagi nanti.", "RATE_LIMITED");

  const lines = ids.map(function (id) {
    const item = byId[id];
    return { id: id, code: readText(item.code), name: readText(item.name), price: Number(item.price) || 0 };
  });
  const itemsTotal = Math.round(lines.reduce(function (sum, line) { return sum + line.price; }, 0) * 100) / 100;
  const postage = method === "post" ? POSTAGE_FEE : 0;
  const total = Math.round((itemsTotal + postage) * 100) / 100;
  const inquiryId = "INQ-" + now() + "-" + Utilities.getUuid().slice(0, 4);
  const notes = safeCell(cleanText(payload.notes, MAX_TEXT_LENGTH));
  const stamp = iso(now());

  sheet("Inquiries").appendRow([
    inquiryId, stamp, safeCell(name), textCell(phone.replace(/[^\d+]/g, "")), method, safeCell(pickup), state, postcode ? textCell(postcode) : "",
    JSON.stringify(lines), itemsTotal, postage, total, notes, "Baru", "[]", "", "", stamp,
  ]);

  const notifyEmail = setting("NOTIFY_EMAIL");
  if (notifyEmail) {
    try {
      MailApp.sendEmail({
        to: notifyEmail,
        subject: "Pertanyaan baru dari " + name.replace(/\s+/g, " ").slice(0, 80),
        body: [name + " (" + phone + ")", method === "post" ? "Pos ke " + state + " " + postcode : "Ambil sendiri: " + pickup, lines.map(function (l) { return l.code + " " + l.name; }).join("\n"), "RM " + total, notes].join("\n"),
      });
    } catch (err) {
      // Google limits daily email, and the inquiry is already safe in the sheet.
      console.error(err);
    }
  }

  return ok({ inquiryId: inquiryId, itemsTotal: itemsTotal, postage: postage, total: total });
}

/* ---------- Admin: items ---------- */

function uploadPhoto(imageBase64) {
  const folderId = setting("DRIVE_FOLDER_ID");
  // Saving without the photo would look like success and lose it.
  if (!folderId) return fail("Foto tidak disimpan: DRIVE_FOLDER_ID belum ditetapkan dalam Script Properties.");
  const prefix = "data:image/jpeg;base64,";
  if (typeof imageBase64 !== "string" || imageBase64.indexOf(prefix) !== 0) return fail("Foto mesti fail JPEG.");
  const data = imageBase64.slice(prefix.length);
  if (!data || data.length > Math.ceil(MAX_PHOTO_BYTES / 3) * 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data)) return fail("Foto terlalu besar atau rosak.");
  const bytes = Utilities.base64Decode(data);
  // A JPEG starts FF D8 FF, whatever the request claims. Apps Script bytes are signed, hence the masks.
  if (bytes.length < 4 || (bytes[0] & 0xff) !== 0xff || (bytes[1] & 0xff) !== 0xd8 || (bytes[2] & 0xff) !== 0xff) return fail("Foto mesti fail JPEG.");
  const file = DriveApp.getFolderById(folderId).createFile(Utilities.newBlob(bytes, "image/jpeg", "item_" + now() + ".jpg"));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  const url = "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w1200";
  if (!PHOTO_URL.test(url)) return fail("Foto tidak dapat disimpan.");
  return ok({ url: url });
}

function readPrice(value, required) {
  if (!required && (value === undefined || value === null || value === "" || value === 0)) return 0;
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  if (!isFinite(n) || n < 0 || n > MAX_PRICE) return null;
  return Math.round(n * 100) / 100;
}

function nextCode() {
  const props = properties();
  const next = Number(props.getProperty("itemCounter")) + 1;
  props.setProperty("itemCounter", String(next));
  return CODE_PREFIX + String(next).padStart(3, "0");
}

function saveItem(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return fail("Item tidak sah.");
  const name = cleanText(input.name, 120);
  if (!name) return fail("Item perlu ada nama.");
  if (CATEGORIES.indexOf(input.category) < 0) return fail("Pilih kategori.");
  if (CONDITIONS.indexOf(input.condition) < 0) return fail("Pilih keadaan item.");
  const flawNotes = cleanText(input.flawNotes, 500);
  if (input.condition === FLAWED && !flawNotes) return fail("Terangkan kecacatan item.");
  const price = readPrice(input.price, true);
  if (price === null) return fail("Harga tidak sah.");
  const originalPrice = readPrice(input.originalPrice, false);
  if (originalPrice === null) return fail("Harga asal tidak sah.");

  const measurements = {};
  const given = input.measurements && typeof input.measurements === "object" && !Array.isArray(input.measurements) ? input.measurements : {};
  for (let i = 0; i < MEASUREMENT_KEYS.length; i++) {
    const key = MEASUREMENT_KEYS[i];
    if (!has(given, key) || given[key] === "" || given[key] === null) continue;
    const raw = given[key];
    const n = typeof raw === "number" ? raw : typeof raw === "string" && /^\d+(\.\d+)?$/.test(raw.trim()) ? Number(raw) : NaN;
    if (!isFinite(n) || n <= 0 || n > MAX_MEASUREMENT) return fail("Ukuran tidak sah.");
    measurements[key] = Math.round(n * 10) / 10;
  }

  const photos = Array.isArray(input.photos) ? input.photos : [];
  if (photos.length > MAX_PHOTOS || validPhotos(photos).length !== photos.length) return fail("Foto tidak sah.");

  const requestedStatus = input.status === undefined ? "Available" : input.status;
  if (LISTER_STATUSES.indexOf(requestedStatus) < 0) return fail("Status tidak sah.");

  const stamp = iso(now());
  let existing = null;
  if (input.id !== undefined) {
    existing = findRow("Items", "id", input.id);
    if (!existing) return fail("Item tidak dijumpai.");
  }

  // A held or sold item keeps its status and its hold whatever the form sends.
  const current = existing ? effectiveStatus(existing) : "";
  const locked = current === "Reserved" || current === "Sold";
  const status = locked ? readText(existing.status) : requestedStatus;
  const expiredHold = existing && holdExpired(existing);

  const id = existing ? readText(existing.id) : "ITM-" + now() + "-" + Utilities.getUuid().slice(0, 8);
  const row = [
    id,
    existing ? readText(existing.code) : nextCode(),
    safeCell(name),
    safeCell(cleanText(input.colour, 60)),
    input.category,
    safeCell(cleanText(input.brand, 60)),
    safeCell(cleanText(input.size, 40)),
    input.condition,
    safeCell(flawNotes),
    JSON.stringify(measurements),
    price,
    originalPrice,
    safeCell(cleanText(input.description, MAX_TEXT_LENGTH)),
    JSON.stringify(photos),
    status,
    locked ? readText(existing.reservedFor) : "",
    locked ? readText(existing.reservedUntil) : "",
    existing ? iso(toMs(existing.createdAt)) : stamp,
    stamp,
    existing && !expiredHold ? readText(existing.soldAt) : "",
  ];

  if (existing) {
    // Every value here is either fresh, neutralised input or one the script wrote itself.
    sheet("Items").getRange(existing._row, 1, 1, row.length).setValues([row]);
  } else {
    sheet("Items").appendRow(row);
  }
  const saved = {};
  ITEM_HEADERS.forEach(function (h, i) { saved[h] = row[i]; });
  return ok({ item: publicItem(saved) });
}

function setItemStatus(itemId, status) {
  if (LISTER_STATUSES.indexOf(status) < 0) return fail("Status tidak sah.");
  const item = findRow("Items", "id", itemId);
  if (!item) return fail("Item tidak dijumpai.");
  const current = effectiveStatus(item);
  if (current === "Reserved" || current === "Sold") return fail("Item ini sedang ditempah atau sudah terjual.", "LOCKED_ITEM");
  setItemCells(item, { status: status, reservedFor: "", reservedUntil: "", updatedAt: iso(now()) });
  return ok();
}

function deleteItem(itemId) {
  const item = findRow("Items", "id", itemId);
  if (!item) return fail("Item tidak dijumpai.");
  const current = effectiveStatus(item);
  if (current === "Reserved" || current === "Sold") return fail("Item yang ditempah atau terjual tidak boleh dipadam. Sembunyikan sahaja.", "LOCKED_ITEM");
  sheet("Items").deleteRow(item._row);
  return ok();
}

/** Every item, drafts and hidden ones included, with who holds it and until when. Admin only. */
function listItems() {
  const items = readRows("Items")
    .filter(function (item) { return readText(item.id); })
    .map(function (item) {
      const shown = publicItem(item);
      const held = shown.status === "Reserved";
      shown.reservedFor = held ? readText(item.reservedFor) : "";
      shown.holdUntil = held && toMs(item.reservedUntil) ? iso(toMs(item.reservedUntil)) : "";
      return shown;
    });
  return ok({ items: items });
}

/* ---------- Admin: inquiries ---------- */

function inquiryItemIds(inquiry) {
  return parseJson(inquiry.itemsJson, [])
    .filter(function (line) { return line && typeof line.id === "string"; })
    .map(function (line) { return line.id; });
}

function confirmedIds(inquiry) {
  const ids = parseJson(inquiry.confirmedJson, []);
  return Array.isArray(ids) ? ids.filter(function (id) { return typeof id === "string"; }) : [];
}

const codeOf = (item, id) => (item ? readText(item.code) : id);

/** Reserves the chosen items for 30 minutes, all or nothing. */
function confirmInquiry(inquiryId, itemIds) {
  const inquiry = findRow("Inquiries", "inquiryId", inquiryId);
  if (!inquiry) return fail("Pertanyaan tidak dijumpai.");
  if (readText(inquiry.status) !== "Baru") return fail("Pertanyaan ini sudah diproses.", "BAD_STATE");

  const asked = inquiryItemIds(inquiry);
  const chosen = [];
  (itemIds === undefined ? asked : Array.isArray(itemIds) ? itemIds : []).forEach(function (id) {
    if (typeof id === "string" && asked.indexOf(id) >= 0 && chosen.indexOf(id) < 0) chosen.push(id);
  });
  if (chosen.length === 0) return fail("Pilih sekurang-kurangnya satu item dari pertanyaan ini.");

  const items = readRows("Items");
  const byId = {};
  items.forEach(function (item) { byId[readText(item.id)] = item; });
  const unavailable = chosen.filter(function (id) { return !has(byId, id) || effectiveStatus(byId[id]) !== "Available"; });
  if (unavailable.length) {
    return fail("Ada item yang sudah ditempah atau tiada lagi.", "UNAVAILABLE", { unavailable: unavailable.map(function (id) { return codeOf(byId[id], id); }) });
  }

  const stamp = now();
  const holdUntil = iso(stamp + HOLD_MINUTES * 60 * 1000);
  chosen.forEach(function (id) {
    setItemCells(byId[id], { status: "Reserved", reservedFor: inquiryId, reservedUntil: holdUntil, soldAt: "", updatedAt: iso(stamp) });
  });
  setInquiryCells(inquiry, { status: "Disahkan", confirmedJson: JSON.stringify(chosen), holdUntil: holdUntil, updatedAt: iso(stamp) });
  return ok({ holdUntil: holdUntil });
}

function setInquiryStatus(inquiryId, status, trackingNo) {
  if (INQUIRY_STATUSES.indexOf(status) < 0) return fail("Status tidak sah.");
  const inquiry = findRow("Inquiries", "inquiryId", inquiryId);
  if (!inquiry) return fail("Pertanyaan tidak dijumpai.");
  const current = INQUIRY_STATUSES.indexOf(readText(inquiry.status)) >= 0 ? readText(inquiry.status) : "Baru";
  if (TRANSITIONS[current].indexOf(status) < 0) return fail("Perubahan status ini tidak dibenarkan.", "BAD_STATE");

  const method = readText(inquiry.deliveryMethod);
  if (status === "Dihantar" && method !== "post") return fail("Pertanyaan ini untuk ambil sendiri.", "BAD_STATE");
  if (status === "Diambil" && method !== "pickup") return fail("Pertanyaan ini untuk pos.", "BAD_STATE");
  // Checked whole, never cut to fit: a shortened tracking number would send the buyer to someone else's parcel.
  const tracking = status === "Dihantar" ? cleanText(trackingNo, 200) : "";
  if (status === "Dihantar" && !TRACKING.test(tracking)) return fail("Nombor tracking tidak sah.");

  const items = readRows("Items");
  const byId = {};
  items.forEach(function (item) { byId[readText(item.id)] = item; });
  const ids = confirmedIds(inquiry);
  const stamp = iso(now());

  if (status === "Dibayar" || status === "Dihantar" || status === "Diambil") {
    // Paid only counts while the items are still this buyer's: an unpaid hold that ran out may have gone to someone else.
    const lost = ids.filter(function (id) { return !has(byId, id) || !heldFor(byId[id], inquiryId); });
    if (lost.length) return fail("Item ini sudah diambil pembeli lain selepas tempoh tempahan tamat.", "UNAVAILABLE", { unavailable: lost.map(function (id) { return codeOf(byId[id], id); }) });
    ids.forEach(function (id) {
      setItemCells(byId[id], status === "Dibayar"
        ? { reservedUntil: "", updatedAt: stamp }
        : { status: "Sold", reservedUntil: "", soldAt: stamp, updatedAt: stamp });
    });
  }

  if (status === "Batal") {
    ids.forEach(function (id) {
      if (has(byId, id) && heldFor(byId[id], inquiryId)) setItemCells(byId[id], { status: "Available", reservedFor: "", reservedUntil: "", updatedAt: stamp });
    });
  }

  const cells = { status: status, updatedAt: stamp };
  if (status === "Dibayar" || status === "Batal") cells.holdUntil = "";
  if (status === "Dihantar") cells.trackingNo = safeCell(tracking);
  setInquiryCells(inquiry, cells);
  return ok();
}

function listInquiries() {
  const inquiries = readRows("Inquiries").map(function (row) {
    const status = readText(row.status);
    const lines = parseJson(row.itemsJson, []);
    return {
      inquiryId: readText(row.inquiryId),
      timestamp: iso(toMs(row.timestamp)),
      customerName: readText(row.customerName),
      customerPhone: readText(row.customerPhone),
      deliveryMethod: readText(row.deliveryMethod) === "post" ? "post" : "pickup",
      pickupPreference: readText(row.pickupPreference),
      postState: readText(row.postState),
      postcode: readText(row.postcode) ? readText(row.postcode).padStart(5, "0") : "",
      items: Array.isArray(lines) ? lines.filter(function (l) { return l && typeof l.id === "string"; }) : [],
      itemsTotal: Number(row.itemsTotal) || 0,
      postage: Number(row.postage) || 0,
      total: Number(row.total) || 0,
      notes: readText(row.notes),
      status: INQUIRY_STATUSES.indexOf(status) >= 0 ? status : "Baru",
      confirmed: confirmedIds(row),
      holdUntil: toMs(row.holdUntil) ? iso(toMs(row.holdUntil)) : "",
      trackingNo: readText(row.trackingNo),
    };
  });
  return ok({ inquiries: inquiries });
}
