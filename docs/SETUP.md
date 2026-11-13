# Setting up Hana's Family Preloved

How to run the site, connect it to Google, and look after it. For what the shop is and what's planned, see the [README](../README.md) and the [PRD](PRD.md).

## Run it locally

```bash
npm install
npm run dev
```

Also available: `npm test` and `npm run build`.

Until the backend is connected, the site runs in **demo mode** with 12 sample items whose pictures are drawn placeholders in `public/images/samples/`. Changes stay in your own browser, and the admin passcode is `123456`.

## Going live

Give this shop its **own** Google Sheet, Drive folder and Apps Script deployment. Don't reuse Hana's Garden's, so that a mistake in one shop can't touch the other.

> Start from an **empty** Sheet. The `Items` and `Inquiries` columns changed in Phase 1, so a Sheet made for an earlier version won't line up.

The shop's fixed numbers are constants at the top of [`backend/Code.gs`](../backend/Code.gs): `POSTAGE_FEE` (10, the flat RM10 for any posted order), `HOLD_MINUTES` (30) and `SOLD_VISIBLE_DAYS` (14). Change them there and deploy a new version; the site picks them up with the catalogue.

### 1. Set the shop details

Edit [`src/config.ts`](../src/config.ts). Everything in it is public, so the admin passcode and WhatsApp number never go there.

| Setting | What to put |
| --- | --- |
| `shopName`, `ownerName`, `pickupPlace`, `pickupArea`, `pickupHours`, `pickupWindows` | Already filled in, change them if needed |

### 2. Set up the Google backend

1. Create a new Google Sheet. The `Items` and `Inquiries` tabs are created on first use.
2. Create a new Google Drive folder for item photos and copy its ID from the folder's URL.
3. In the sheet, open **Extensions > Apps Script** and replace the contents with [`backend/Code.gs`](../backend/Code.gs).
4. Open **Project Settings > Script properties** and add:

   | Property | Value |
   | --- | --- |
   | `ADMIN_PIN` | Your admin passcode. It must be exactly 6 digits to work with the keypad. Avoid birthdays, `123456` and the Hana's Garden passcode |
   | `WHATSAPP_NUMBER` | Mama's WhatsApp number, like `60123456789` or `0123456789` |
   | `DRIVE_FOLDER_ID` | The folder ID from step 2 |
   | `NOTIFY_EMAIL` | Optional. Also emails each new inquiry here |

5. Click **Deploy > New deployment > Web app**, with *Execute as: Me* and *Who has access: Anyone*. Approve the permissions Google asks for.
6. In Netlify, create a **new site** from this repository, add the `/exec` URL as the environment variable `VITE_APPS_SCRIPT_URL`, then deploy.
7. Log in to admin on the site and add items with **Tambah item**.

If you change `Code.gs` later, use **Deploy > Manage deployments > Edit > New version**, otherwise the old code keeps running.

### 3. Publish

[`netlify.toml`](../netlify.toml) sets the build and the security headers, so once the Netlify site is connected, every push to `main` is built and deployed. GitHub Actions runs the tests on each push too.

## Using the admin page

Open **Log masuk admin** in the footer, or add `#/admin` to the site address.

- **Inventori:** add items (each gets the next code, `HFP-001` onwards, never reused), edit them, switch them between on sale and hidden, save drafts the shop can't see, and delete items that never sold. Photos are shrunk in the browser before uploading. A reserved or sold item can be edited but not hidden, re-listed or deleted.
- **Pertanyaan:** each order moves one step at a time:
  1. **Sahkan & tempah** reserves its items for 30 minutes. Other buyers see them as *Ditempah*.
  2. **Tandakan dibayar** once the payment arrives makes the hold permanent. An unpaid hold that runs out puts the items back on sale, and if someone else then reserves them, marking the first order paid is refused.
  3. **Tandakan dihantar** with the tracking number for a posted order, or **Tandakan diambil** for a pickup, marks the items sold. **Hantar tracking** opens WhatsApp with the number.
  4. **Tandakan selesai** closes it. **Batal** (tap twice) cancels any order before it is posted or collected, and puts its items back on sale.
- **Balas** opens WhatsApp to the buyer.
- After 5 wrong passcodes, admin locks for 15 minutes for everyone, including Mama. Anyone already logged in stays logged in. To unlock early, delete `pinLockedUntil` from Script properties.
- A login lasts up to 6 hours, or until **Log keluar**.

## Security

- **Private, never in this repository:** the admin passcode, WhatsApp number and Drive folder ID (Script properties), and customer details (the Google Sheet). Don't share the sheet.
- **Never stored at all:** a buyer's full address. It goes only into their WhatsApp message; the Sheet keeps the state and postcode.
- **The public catalogue** sends an allow-list of item fields, never holds, sale times, drafts or hidden items. Admin's own list needs a session.
- **Public on purpose:** this code, the item list, and the Apps Script URL, which every visitor's browser has to call. None of them unlock anything.
- **The WhatsApp number** isn't in this code, but any visitor can find it, because their browser needs it to open the chat.
- `tests/security.test.ts` runs outsider attacks against `backend/Code.gs` on every push.

## Where things are

| Path | What it is |
| --- | --- |
| `src/shop/` | Catalogue, item page, bag, checkout, thank-you page |
| `src/admin/` | Keypad, inventory, item form, inquiries |
| `src/lib/api.ts` | All backend calls, plus the demo-mode stand-in |
| `src/data/samples.ts` | The 12 demo items |
| `src/lib/demo.ts` | Demo mode: the backend's rules kept in the browser, until the Sheet is connected |
| `src/lib/catalog.ts`, `src/lib/route.ts`, `src/lib/photos.ts` | Catalogue filters and sorting, the hash routes, and which photo addresses may reach a page. All three treat the address bar as hostile |
| `src/shop/InfoPages.tsx` | Panduan saiz, Gred keadaan, Polisi and Tentang kami |
| `public/images/samples/` | Placeholder pictures for the demo items |
| `backend/Code.gs` | The Google Apps Script backend |
| `tests/` | Tests for the helpers and for `Code.gs`, run against fake Google services |
| `docs/PRD.md` | What the shop will become, and its limits |

Some CSS class names (`plant-card`, `plant-grid`, `plant-page`) still come from Hana's Garden; the code itself uses `Item` throughout.
