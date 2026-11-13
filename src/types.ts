export const CATEGORIES = ["Wanita", "Lelaki", "Tudung & Selendang", "Kasut & Beg", "Aksesori"];

export type PlantStatus = "Available" | "Sold Out";

/** Mirrors a row in the Inventory sheet. */
export interface Plant {
  id: string;
  name: string;
  colour: string;
  category: string;
  price: number;
  stock: number;
  status: PlantStatus;
  brand: string;
  condition: string;
  size: string;
  description: string;
  imageUrl: string;
}

export interface PlantDraft extends Omit<Plant, "id"> {
  id?: string;
  imageBase64?: string;
}

export const inStock = (plant: Plant) => plant.status !== "Sold Out" && plant.stock > 0;

export interface BasketItem {
  id: string;
  name: string;
  price: number;
  qty: number;
}

export interface Inquiry {
  customerName: string;
  customerPhone: string;
  pickupPreference: string;
  items: BasketItem[];
  totalPrice: number;
  notes: string;
}

export type InquiryStatus = "Baru" | "Disahkan" | "Selesai";

export interface InquiryRecord extends Inquiry {
  inquiryId: string;
  timestamp: string;
  status: InquiryStatus;
}
