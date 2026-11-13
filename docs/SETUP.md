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

> Phase 0 note: the item fields will change in Phase 1 (photos, measurements, item codes, owners). Connecting the backend now is fine for testing, but hold off entering the real wardrobe until Phase 1 is done, or you'll have to edit those items again.

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

- **Inventori:** switch an item between in stock and sold out, or add, edit and delete items. Photos are shrunk in the browser before uploading.
- **Pertanyaan:** see every inquiry, move it through Baru, Disahkan and Selesai, and press **Balas** to reply on WhatsApp.
- After 5 wrong passcodes, admin locks for 15 minutes for everyone, including Mama. Anyone already logged in stays logged in. To unlock early, delete `pinLockedUntil` from Script properties.
- A login lasts up to 6 hours, or until **Log keluar**.

## Security

- **Private, never in this repository:** the admin passcode, WhatsApp number and Drive folder ID (Script properties), and customer details (the Google Sheet). Don't share the sheet.
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
| `public/images/samples/` | Placeholder pictures for the demo items |
| `backend/Code.gs` | The Google Apps Script backend |
| `tests/` | Tests for the helpers and for `Code.gs`, run against fake Google services |
| `docs/PRD.md` | What the shop will become, and its limits |

Some code names (`Plant`, `savePlant`, `SAVE_PLANT`, `PlantPage`) still come from Hana's Garden. Phase 1 replaces them along with the new item model.
