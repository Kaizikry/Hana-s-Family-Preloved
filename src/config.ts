/**
 * Shop settings. Everything here is public, so private details never go in this file. The admin
 * passcode and WhatsApp number live in the Apps Script's Script Properties instead.
 */
export const config = {
  shopName: "Hana's Family Preloved",
  ownerName: "Hana",
  pickupPlace: "Rumah Hana di Kampung Undang, Bukit Payong",
  pickupArea: "Kampung Undang, Bukit Payong",
  pickupHours: "Setiap hari, 9 pagi hingga 5 petang",
  pickupWindows: ["9 hingga 11 pagi", "11 pagi hingga 1 tgh hari", "2 hingga 5 petang"],
  currency: "RM",

  /** The Apps Script Web App URL ending in /exec. While empty, the site runs on sample plants. */
  appsScriptUrl: (import.meta.env.VITE_APPS_SCRIPT_URL as string | undefined) ?? "",
};

export const PIN_LENGTH = 6;
export const DEMO_PIN = "123456";
export const isDemo = !config.appsScriptUrl;
