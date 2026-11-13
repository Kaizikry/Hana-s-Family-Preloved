import { loadBackend } from "./fakeAppsScript";

export const PIN = "482193";
export const NUMBER = "60139990000";

export const baseItem = {
  name: "Blaus Linen Putih",
  colour: "Putih",
  category: "Wanita",
  brand: "Uniqlo",
  size: "M",
  condition: "Seperti baru",
  price: 25,
  measurements: { chest: 48, length: 66 },
  photos: [] as string[],
  status: "Available",
};

export const buyer = { customerName: "Pelanggan Ujian", customerPhone: "012-345 6789", notes: "" };

/** A shop with a logged-in admin. Pass `undefined` for a property to leave it unset. */
export function openShop(props: Record<string, string | undefined> = {}) {
  const all: Record<string, string | undefined> = { ADMIN_PIN: PIN, WHATSAPP_NUMBER: NUMBER, DRIVE_FOLDER_ID: "folder", ...props };
  const settings = Object.fromEntries(Object.entries(all).filter(([, v]) => v !== undefined)) as Record<string, string>;
  const api = loadBackend(settings);
  const token = api.post({ action: "VERIFY_PIN", adminPin: PIN }).token as string;

  const admin = (action: string, body: Record<string, unknown> = {}) => api.post({ action, token, ...body });

  const add = (over: Record<string, unknown> = {}) => {
    const res = admin("SAVE_ITEM", { item: { ...baseItem, ...over } });
    if (res.status !== "success") throw new Error(`SAVE_ITEM failed: ${res.message}`);
    return res.item as { id: string; code: string; name: string; status: string; price: number };
  };

  const pickup = (itemIds: unknown, over: Record<string, unknown> = {}) =>
    api.post({ action: "SUBMIT_INQUIRY", ...buyer, deliveryMethod: "pickup", pickupPreference: "Esok, 14 Nov, 2 hingga 5 petang", itemIds, ...over });

  const post = (itemIds: unknown, over: Record<string, unknown> = {}) =>
    api.post({ action: "SUBMIT_INQUIRY", ...buyer, deliveryMethod: "post", postState: "Selangor", postcode: "40150", itemIds, ...over });

  const inquiries = () => admin("LIST_INQUIRIES").inquiries as Record<string, unknown>[];
  const inquiry = (inquiryId: string) => inquiries().find((q) => q.inquiryId === inquiryId)!;
  const shopItems = () => api.get().items as Record<string, unknown>[];
  const shopItem = (id: string) => shopItems().find((i) => i.id === id);
  const confirm = (inquiryId: string, itemIds?: string[]) => admin("CONFIRM_INQUIRY", { inquiryId, ...(itemIds ? { itemIds } : {}) });
  const setStatus = (inquiryId: string, status: string, trackingNo?: string) => admin("SET_INQUIRY_STATUS", { inquiryId, status, trackingNo });

  /** Every cell in both tabs, as text, for "this never reached the sheet" checks. */
  const allCells = () => [...api.sheets.values()].flat(2).map(String).join("\n");

  return { api, token, admin, add, pickup, post, inquiries, inquiry, shopItems, shopItem, confirm, setStatus, allCells };
}
