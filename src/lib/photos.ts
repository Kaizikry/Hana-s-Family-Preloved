/**
 * Which picture addresses the shop will ever put on a page. The backend already refuses others;
 * this is the second lock, in case a row reaches the sheet some other way.
 */
const DRIVE = /^https:\/\/drive\.google\.com\/thumbnail\?id=[A-Za-z0-9_-]{10,200}&sz=w\d{2,4}$/;
const LOCAL = /^images\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.(?:svg|jpe?g|png|webp)$/;
/** Demo mode keeps freshly picked photos in the browser as JPEG data. */
const DEMO_JPEG = /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/;

export const isSafePhoto = (url: unknown): url is string =>
  typeof url === "string" && url.length < 4_000_000 && (DRIVE.test(url) || LOCAL.test(url) || DEMO_JPEG.test(url));

/** Asks Drive for a smaller copy: cards need about 400px, the item page 1200px. Other addresses pass through. */
export function photoAt(url: string, width: 400 | 800 | 1200 | 2000): string {
  return DRIVE.test(url) ? url.replace(/&sz=w\d+$/, `&sz=w${width}`) : url;
}
