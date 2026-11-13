import type { PlantDraft } from "../types";

const item = (
  picture: string,
  name: string,
  category: string,
  price: number,
  details: { colour: string; brand?: string; condition: string; size: string; description: string },
): PlantDraft => ({
  name,
  category,
  price,
  stock: 1,
  status: "Available",
  brand: "",
  ...details,
  imageUrl: `images/samples/${picture}.svg`,
});

/**
 * Demo mode only. Made-up items with drawn placeholder pictures, so the shop can be tried before
 * it is connected to the Google Sheet. Real items are added in admin with real photos.
 */
export const SAMPLE_ITEMS: PlantDraft[] = [
  item("blaus-putih", "Blaus Linen Putih", "Wanita", 25, { colour: "Putih", brand: "Uniqlo", condition: "Seperti baru", size: "M", description: "Linen ringan, sesuai untuk cuaca panas. Dipakai dua kali." }),
  item("kurung-biru", "Baju Kurung Moden Biru", "Wanita", 45, { colour: "Biru laut", condition: "Baik", size: "L", description: "Kain cotton lembut, dipakai satu musim raya." }),
  item("dress-kuning", "Dress Bunga Kuning", "Wanita", 35, { colour: "Kuning", condition: "Seperti baru", size: "S", description: "Dress labuh bercorak bunga kecil, ada poket di sisi." }),
  item("bawal-krim", "Tudung Bawal Krim", "Tudung & Selendang", 12, { colour: "Krim", condition: "Baru dengan tag", size: "Free Size", description: "Bawal cotton 45 inci, belum pernah dipakai." }),
  { ...item("selendang-hijau", "Selendang Chiffon Hijau", "Tudung & Selendang", 15, { colour: "Hijau zamrud", condition: "Baik", size: "Free Size", description: "Chiffon ringan, tidak jarang." }), stock: 0, status: "Sold Out" },
  item("kemeja-kotak", "Kemeja Kotak Biru", "Lelaki", 20, { colour: "Biru dan putih", brand: "Padini", condition: "Baik", size: "L", description: "Lengan panjang, kain cotton tebal." }),
  item("polo-hitam", "T-shirt Polo Hitam", "Lelaki", 18, { colour: "Hitam", condition: "Seperti baru", size: "XL", description: "Polo cotton pique, warna masih pekat." }),
  item("slack-kelabu", "Seluar Slack Kelabu", "Lelaki", 25, { colour: "Kelabu", condition: "Baik", size: "Pinggang 34", description: "Sesuai untuk ke pejabat. Panjang 100 cm." }),
  item("jeans-biru", "Seluar Jeans Biru", "Wanita", 30, { colour: "Biru", brand: "Levi's", condition: "Baik", size: "Pinggang 28", description: "Potongan lurus, sedikit pudar di lutut." }),
  item("kasut-putih", "Kasut Sukan Putih", "Kasut & Beg", 60, { colour: "Putih", condition: "Baik", size: "EU 41", description: "Tapak masih elok, sudah dicuci." }),
  item("beg-coklat", "Beg Tangan Coklat", "Kasut & Beg", 40, { colour: "Coklat", condition: "Seperti baru", size: "", description: "Kulit sintetik, ada zip di dalam." }),
  item("jaket-denim", "Jaket Denim", "Wanita", 38, { colour: "Biru denim", condition: "Ada kecacatan", size: "M", description: "Satu butang di lengan kiri tertanggal. Selain itu elok." }),
];
