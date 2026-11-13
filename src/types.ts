/** These lists must match the ones in backend/Code.gs, which refuses anything else. */
export const CATEGORIES = ["Wanita", "Lelaki", "Tudung & Selendang", "Kasut & Beg", "Aksesori"];
export const CONDITIONS = ["Baru dengan tag", "Seperti baru", "Baik", "Ada kecacatan"] as const;
export const FLAWED = "Ada kecacatan";
export const STATES = ["Johor", "Kedah", "Kelantan", "Melaka", "Negeri Sembilan", "Pahang", "Perak", "Perlis", "Pulau Pinang", "Sabah", "Sarawak", "Selangor", "Terengganu", "W.P. Kuala Lumpur", "W.P. Labuan", "W.P. Putrajaya"];

/** Measurements in cm, in the order the item page lists them. */
export const MEASUREMENTS = [
  ["chest", "Dada (ketiak ke ketiak)"],
  ["length", "Panjang"],
  ["shoulder", "Bahu"],
  ["sleeve", "Lengan"],
  ["waist", "Pinggang"],
  ["hip", "Pinggul"],
  ["inseam", "Kaki dalam"],
  ["foot", "Panjang tapak"],
] as const;
export type MeasurementKey = (typeof MEASUREMENTS)[number][0];

/** Draf and Disembunyi never reach the shop. Reserved and Sold only come from an inquiry. */
export type ItemStatus = "Draf" | "Available" | "Reserved" | "Sold" | "Disembunyi";
export const LISTER_STATUSES = ["Draf", "Available", "Disembunyi"] as const;
export type ListerStatus = (typeof LISTER_STATUSES)[number];

/** An item as the backend sends it: one of a kind, so there is no stock count. */
export interface Item {
  id: string;
  code: string;
  name: string;
  colour: string;
  category: string;
  brand: string;
  size: string;
  condition: string;
  flawNotes: string;
  measurements: Partial<Record<MeasurementKey, number>>;
  price: number;
  originalPrice: number;
  description: string;
  photos: string[];
  status: ItemStatus;
  createdAt: string;
}

/** What admin sees: every status, and who holds an item while the hold lasts. */
export interface AdminItem extends Item {
  reservedFor: string;
  holdUntil: string;
}

export interface ItemDraft extends Omit<Item, "id" | "code" | "status" | "createdAt"> {
  id?: string;
  status: ListerStatus;
}

export const isAvailable = (item: Item) => item.status === "Available";
export const coverPhoto = (item: Pick<Item, "photos">) => item.photos[0] ?? "";

export type DeliveryMethod = "pickup" | "post";

/** What the buyer sends. The address never leaves the browser except inside the WhatsApp message. */
export interface InquiryInput {
  customerName: string;
  customerPhone: string;
  deliveryMethod: DeliveryMethod;
  pickupPreference: string;
  postState: string;
  postcode: string;
  notes: string;
  itemIds: string[];
}

export interface InquiryLine {
  id: string;
  code: string;
  name: string;
  price: number;
}

export type InquiryStatus = "Baru" | "Disahkan" | "Dibayar" | "Dihantar" | "Diambil" | "Selesai" | "Batal";
export const INQUIRY_STATUSES: InquiryStatus[] = ["Baru", "Disahkan", "Dibayar", "Dihantar", "Diambil", "Selesai", "Batal"];

export interface InquiryRecord {
  inquiryId: string;
  timestamp: string;
  customerName: string;
  customerPhone: string;
  deliveryMethod: DeliveryMethod;
  pickupPreference: string;
  postState: string;
  postcode: string;
  items: InquiryLine[];
  itemsTotal: number;
  postage: number;
  total: number;
  notes: string;
  status: InquiryStatus;
  confirmed: string[];
  holdUntil: string;
  trackingNo: string;
}
