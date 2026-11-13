import { config, DEMO_PIN, isDemo } from "../config";
import type { AdminItem, InquiryInput, InquiryRecord, InquiryStatus, Item, ItemDraft, ListerStatus } from "../types";
import { demo, DemoError } from "./demo";

export class ApiError extends Error {
  constructor(
    message: string,
    public code?: string,
    /** Item ids (for a buyer) or codes (for admin) that were taken or are gone. */
    public unavailable: string[] = [],
  ) {
    super(message);
  }
}

async function parse(res: Response) {
  // Not an ApiError: callers show their own plain-language message for failures like this.
  if (!res.ok) throw new Error(`Apps Script answered ${res.status}`);
  const body = await res.json();
  if (body.status !== "success") throw new ApiError(String(body.message ?? "Tidak berjaya."), body.code, Array.isArray(body.unavailable) ? body.unavailable.map(String) : []);
  return body;
}

// text/plain avoids a CORS preflight, which Apps Script can't answer.
const post = (body: object, init?: RequestInit) =>
  fetch(config.appsScriptUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body),
    ...init,
  }).then(parse);

/** Runs a demo action with the same error shape the backend gives. */
async function inDemo<T>(action: () => T): Promise<T> {
  try {
    return action();
  } catch (err) {
    if (err instanceof DemoError) throw new ApiError(err.message, err.code, err.unavailable);
    throw err;
  }
}

const STATUSES = new Set(["Draf", "Available", "Reserved", "Sold", "Disembunyi"]);
const text = (v: unknown) => (typeof v === "string" ? v : "");

/** Trusts nothing about the shape of what comes back. */
function toItem(row: Record<string, unknown>): Item {
  const measurements = row.measurements && typeof row.measurements === "object" ? (row.measurements as Item["measurements"]) : {};
  return {
    id: text(row.id),
    code: text(row.code),
    name: text(row.name),
    colour: text(row.colour),
    category: text(row.category),
    brand: text(row.brand),
    size: text(row.size),
    condition: text(row.condition),
    flawNotes: text(row.flawNotes),
    measurements,
    price: Number(row.price) || 0,
    originalPrice: Number(row.originalPrice) || 0,
    description: text(row.description),
    photos: Array.isArray(row.photos) ? row.photos.filter((p): p is string => typeof p === "string") : [],
    // An unknown status is treated as not for sale, never as Available.
    status: STATUSES.has(text(row.status)) ? (row.status as Item["status"]) : "Sold",
    createdAt: text(row.createdAt),
  };
}

export interface Shop {
  items: Item[];
  whatsappNumber: string;
  postageFee: number;
  holdMinutes: number;
}

export async function fetchShop(): Promise<Shop> {
  if (isDemo) return demo.shop();
  const body = await fetch(config.appsScriptUrl).then(parse);
  return {
    items: (Array.isArray(body.items) ? body.items : []).map(toItem).filter((i: Item) => i.id && i.name),
    whatsappNumber: text(body.whatsappNumber),
    postageFee: Number(body.postageFee) || 0,
    holdMinutes: Number(body.holdMinutes) || 0,
  };
}

export interface Submitted {
  inquiryId: string;
  itemsTotal: number;
  postage: number;
  total: number;
}

export async function submitInquiry(input: InquiryInput): Promise<Submitted> {
  if (isDemo) return inDemo(() => demo.submit(input));
  // keepalive lets the log finish even if the page has already moved on to WhatsApp.
  return post({ action: "SUBMIT_INQUIRY", ...input }, { keepalive: true });
}

/** Returns a session token, so the passcode itself never has to be kept in the browser. */
export async function verifyPin(pin: string): Promise<string> {
  if (isDemo) {
    if (pin !== DEMO_PIN) throw new ApiError("Kod laluan salah.", "BAD_PIN");
    return "demo";
  }
  return (await post({ action: "VERIFY_PIN", adminPin: pin })).token;
}

export async function logout(token: string): Promise<void> {
  if (!isDemo) await post({ action: "LOGOUT", token });
}

/** Saves an item, uploading a newly picked photo first so it becomes the cover. */
export async function saveItem(token: string, draft: ItemDraft, newPhoto?: string): Promise<Item> {
  if (isDemo) return inDemo(() => demo.save(draft, newPhoto));
  const photos = newPhoto ? [(await post({ action: "UPLOAD_PHOTO", token, imageBase64: newPhoto })).url as string, ...draft.photos.slice(1)] : draft.photos;
  return toItem((await post({ action: "SAVE_ITEM", token, item: { ...draft, photos } })).item);
}

export async function setItemStatus(token: string, itemId: string, status: ListerStatus): Promise<void> {
  if (isDemo) return inDemo(() => demo.setStatus(itemId, status));
  await post({ action: "SET_ITEM_STATUS", token, itemId, status });
}

export async function deleteItem(token: string, itemId: string): Promise<void> {
  if (isDemo) return inDemo(() => demo.remove(itemId));
  await post({ action: "DELETE_ITEM", token, itemId });
}

export async function fetchItems(token: string): Promise<AdminItem[]> {
  if (isDemo) return demo.listItems();
  const body = await post({ action: "LIST_ITEMS", token });
  return (Array.isArray(body.items) ? body.items : []).map((row: Record<string, unknown>) => ({ ...toItem(row), reservedFor: text(row.reservedFor), holdUntil: text(row.holdUntil) }));
}

export async function fetchInquiries(token: string): Promise<InquiryRecord[]> {
  if (isDemo) return demo.inquiries();
  return (await post({ action: "LIST_INQUIRIES", token })).inquiries;
}

/** Reserves the inquiry's items for the hold time; returns when the hold ends. */
export async function confirmInquiry(token: string, inquiryId: string, itemIds?: string[]): Promise<string> {
  if (isDemo) return inDemo(() => demo.confirm(inquiryId, itemIds));
  return (await post({ action: "CONFIRM_INQUIRY", token, inquiryId, ...(itemIds ? { itemIds } : {}) })).holdUntil;
}

export async function setInquiryStatus(token: string, inquiryId: string, status: InquiryStatus, trackingNo?: string): Promise<void> {
  if (isDemo) return inDemo(() => demo.setInquiryStatus(inquiryId, status, trackingNo));
  await post({ action: "SET_INQUIRY_STATUS", token, inquiryId, status, ...(trackingNo ? { trackingNo } : {}) });
}
