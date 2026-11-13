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

/**
 * One line, so pasted text can't break the message into something that looks like Mama's reply.
 * Includes the Unicode line and paragraph separators, which WhatsApp also shows as new lines.
 */
const oneLine = (text: string) => text.replace(/\s*[\r\n\u000B\u000C\u0085\u2028\u2029]+\s*/g, ", ").replace(/\s{2,}/g, " ").trim();

/** Tanya: a question about one item, with its code and a link back to it. */
export function askMessage(shopName: string, item: Pick<Item, "code" | "name" | "price">, link: string): string {
  return `Salam ${shopName}, saya nak tanya tentang ${item.code} ${oneLine(item.name)} (${money(item.price)}): ${link}`;
}

/** A general question from any page. */
export const generalMessage = (shopName: string) => `Salam ${shopName}, saya nak tanya tentang pakaian di kedai anda.`;

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
