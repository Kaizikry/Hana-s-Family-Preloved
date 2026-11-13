import type { Item } from "../types";

type Sample = Pick<Item, "name" | "category" | "price" | "colour" | "condition" | "size"> & Partial<Pick<Item, "brand" | "flawNotes" | "originalPrice" | "measurements" | "description" | "status">>;

const sample = (picture: string, fields: Sample): Omit<Item, "id" | "code" | "createdAt"> => ({
  brand: "",
  flawNotes: "",
  originalPrice: 0,
  measurements: {},
  description: "",
  status: "Available",
  ...fields,
  photos: [`images/samples/${picture}.svg`],
});

/**
 * Demo mode only. Made-up items with drawn placeholder pictures, so the shop can be tried before
 * it is connected to the Google Sheet. Real items are added in admin with real photos.
 */
export const SAMPLE_ITEMS = [
  sample("blaus-putih", { name: "Blaus Linen Putih", category: "Wanita", price: 25, originalPrice: 79, colour: "Putih", brand: "Uniqlo", condition: "Seperti baru", size: "M", measurements: { chest: 50, length: 66, sleeve: 58 }, description: "Linen ringan, sesuai untuk cuaca panas. Dipakai dua kali." }),
  sample("kurung-biru", { name: "Baju Kurung Moden Biru", category: "Wanita", price: 45, colour: "Biru laut", condition: "Baik", size: "L", measurements: { chest: 54, length: 104 }, description: "Kain cotton lembut, dipakai satu musim raya." }),
  sample("dress-kuning", { name: "Dress Bunga Kuning", category: "Wanita", price: 35, colour: "Kuning", condition: "Seperti baru", size: "S", measurements: { chest: 44, length: 128, waist: 36 }, description: "Dress labuh bercorak bunga kecil, ada poket di sisi." }),
  sample("bawal-krim", { name: "Tudung Bawal Krim", category: "Tudung & Selendang", price: 12, colour: "Krim", condition: "Baru dengan tag", size: "Free Size", description: "Bawal cotton 45 inci, belum pernah dipakai." }),
  sample("selendang-hijau", { name: "Selendang Chiffon Hijau", category: "Tudung & Selendang", price: 15, colour: "Hijau zamrud", condition: "Baik", size: "Free Size", description: "Chiffon ringan, tidak jarang.", status: "Sold" }),
  sample("kemeja-kotak", { name: "Kemeja Kotak Biru", category: "Lelaki", price: 20, colour: "Biru dan putih", brand: "Padini", condition: "Baik", size: "L", measurements: { chest: 56, length: 76, shoulder: 47, sleeve: 63 }, description: "Lengan panjang, kain cotton tebal." }),
  sample("polo-hitam", { name: "T-shirt Polo Hitam", category: "Lelaki", price: 18, colour: "Hitam", condition: "Seperti baru", size: "XL", measurements: { chest: 60, length: 74 }, description: "Polo cotton pique, warna masih pekat." }),
  sample("slack-kelabu", { name: "Seluar Slack Kelabu", category: "Lelaki", price: 25, colour: "Kelabu", condition: "Baik", size: "Pinggang 34", measurements: { waist: 43, length: 100, inseam: 76 }, description: "Sesuai untuk ke pejabat." }),
  sample("jeans-biru", { name: "Seluar Jeans Biru", category: "Wanita", price: 30, colour: "Biru", brand: "Levi's", condition: "Baik", size: "Pinggang 28", measurements: { waist: 36, hip: 47, inseam: 74 }, description: "Potongan lurus, sedikit pudar di lutut." }),
  sample("kasut-putih", { name: "Kasut Sukan Putih", category: "Kasut & Beg", price: 60, colour: "Putih", condition: "Baik", size: "EU 41", measurements: { foot: 26.5 }, description: "Tapak masih elok, sudah dicuci." }),
  sample("beg-coklat", { name: "Beg Tangan Coklat", category: "Kasut & Beg", price: 40, colour: "Coklat", condition: "Seperti baru", size: "", description: "Kulit sintetik, ada zip di dalam." }),
  sample("jaket-denim", { name: "Jaket Denim", category: "Wanita", price: 38, colour: "Biru denim", condition: "Ada kecacatan", size: "M", flawNotes: "Satu butang di lengan kiri tertanggal.", measurements: { chest: 52, length: 60 }, description: "Selain butang itu, elok dan tebal." }),
];
