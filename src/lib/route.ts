/** The shop's hash routes. Everything here reads the address bar, which anyone can type or share, so nothing in it is trusted. */

export const INFO_PAGES = ["saiz", "gred", "polisi", "tentang"] as const;
export type InfoPage = (typeof INFO_PAGES)[number];

export type Route =
  | { name: "catalog" }
  | { name: "item"; id: string }
  | { name: "checkout" }
  | { name: "thanks" }
  | { name: "info"; page: InfoPage }
  | { name: "admin" };

const MAX_ID = 100;

/** A malformed escape like "%E0%A4" makes decodeURIComponent throw, which would blank the whole page. */
export function safeDecode(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return "";
  }
}

export function parseHash(hash: string): { route: Route; query: string } {
  const raw = hash.replace(/^#/, "") || "/";
  const queryAt = raw.indexOf("?");
  const path = queryAt >= 0 ? raw.slice(0, queryAt) : raw;
  const query = queryAt >= 0 ? raw.slice(queryAt + 1) : "";

  if (path === "/admin" || path.startsWith("/admin/")) return { route: { name: "admin" }, query: "" };
  if (path.startsWith("/item/")) {
    const id = safeDecode(path.slice("/item/".length));
    return id && id.length <= MAX_ID ? { route: { name: "item", id }, query: "" } : { route: { name: "catalog" }, query: "" };
  }
  if (path === "/tempahan") return { route: { name: "checkout" }, query: "" };
  if (path === "/terima-kasih") return { route: { name: "thanks" }, query: "" };
  const page = path.slice(1) as InfoPage;
  if ((INFO_PAGES as readonly string[]).includes(page)) return { route: { name: "info", page }, query: "" };
  // Anything unknown lands on the catalogue, keeping its filters if it had some.
  return { route: { name: "catalog" }, query: path === "/" ? query : "" };
}

export const itemHash = (id: string) => `#/item/${encodeURIComponent(id)}`;
