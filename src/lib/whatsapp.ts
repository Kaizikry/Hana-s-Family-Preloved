import type { InquiryInput, Item } from "../types";
import { money } from "./format";

export interface Order {
  input: InquiryInput;
  items: Pick<Item, "code" | "name" | "size" | "price">[];
  itemsTotal: number;
  postage: number;
  total: number;
  /** Typed by a buyer who wants postage. It goes into this message only, never to the backend. */
  address: string;
}

/** One line, so a pasted address can't break the message into something that looks like Mama's reply. */
const oneLine = (text: string) => text.replace(/\s*[\r\n]+\s*/g, ", ").replace(/\s{2,}/g, " ").trim();

export function buildMessage(shopName: string, order: Order, inquiryId?: string): string {
  const { input } = order;
  const delivery = input.deliveryMethod === "post"
    ? `Penghantaran: Pos ke ${input.postState} (${input.postcode}), pos ${money(order.postage)}`
    : `Ambil sendiri: ${input.pickupPreference}`;
  return [
    `Salam ${shopName}, saya nak beli item berikut:`,
    "",
    ...order.items.map((item, i) => `${i + 1}. ${item.code} ${item.name}${item.size ? ` (${item.size})` : ""} = ${money(item.price)}`),
    "",
    `Jumlah item: ${money(order.itemsTotal)}`,
    delivery,
    `Jumlah anggaran: ${money(order.total)}`,
    "",
    `Nama: ${oneLine(input.customerName)}`,
    `Telefon: ${input.customerPhone}`,
    ...(input.deliveryMethod === "post" && order.address ? [`Alamat: ${oneLine(order.address)}`] : []),
    ...(input.notes ? [`Nota: ${oneLine(input.notes)}`] : []),
    "",
    ...(inquiryId ? [`Rujukan: ${inquiryId}`] : []),
    "Terima kasih!",
  ].join("\n");
}

export function whatsappUrl(number: string, message: string): string {
  return `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
}
