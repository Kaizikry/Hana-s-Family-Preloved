# Hana's Family Preloved: Product Requirements Document

| | |
| --- | --- |
| **Status** | v1.1, family decisions applied (section 0) |
| **Date** | 13 November 2026 |
| **Base project** | Hana's Garden (`lamanhana.netlify.app`), source in `Downloads\Documents\Garden web` |
| **New project folder** | `D:\preloved web` |

## 0. Decisions (13 November 2026)

These override anything older in this document.

| Question | Decision |
| --- | --- |
| Owners | **Dropped.** No owner on items, no "Almari" filter, no payout summary, no Sales tab |
| Item codes | `HFP-` prefix, e.g. `HFP-042` |
| Hold time | **30 minutes.** An unpaid hold expires by itself and the item is Available again. Marking the order **Dibayar** makes the hold firm |
| Return rule | Accepted: undisclosed flaws only, unboxing video within 48 h |
| Postage | **Flat RM10** for any posted order, whatever the weight or state. No weights, no rate table |
| Washed before posting | Yes, so the policy page says so |

**Who's who in this document**

- **Mama (Hana):** the seller everyone talks to. Every inquiry goes to her WhatsApp, and she confirms, takes payment, reserves and marks items sold.
- **Lister:** you. You photograph, measure and list every item, and look after the site.
- **Buyer:** anyone who opens the site, usually from a WhatsApp link or Status post.

---

## 1. Summary

Hana's Family Preloved is a small online catalogue of the family's preloved clothes, shoes and accessories from three wardrobes: Mama's, Papa's and yours. Buyers browse real photos with measurements and condition notes, put items in a bag, and send one prefilled WhatsApp message to Mama. Mama confirms the items, reserves them, and arranges either **self-pickup in Kampung Undang** or **postage anywhere in Malaysia** after payment by DuitNow QR or bank transfer.

It reuses the Hana's Garden stack: a React and Vite static site on Netlify, with Google Sheets, Drive and Apps Script as the backend and WhatsApp as the checkout. It still costs RM0 a month. Most of the new work comes from how clothes differ from plants:

- every item is one of a kind, so the site needs a Reserve state
- each item needs several photos and measurements
- posted orders need a postage charge (a flat RM10)
- almost all buyers arrive from WhatsApp, so items must be easy to share there

---

## 2. Why build it this way (stress test)

Before writing this PRD, I argued the strongest case against the plan. This section records what came out of that so the decisions below make sense.

### 2.1 The plan at its strongest

Reuse a stack that already works, is security-tested and costs nothing. Sell through the one channel the family's buyers already trust, Mama's WhatsApp, with no marketplace fees (Shopee takes roughly 10–20%), no buyer accounts and no payment gateway. Buyers see photos, sizes and prices up front, and every request is logged in one Sheet instead of getting lost in chat.

### 2.2 The case against: use Carousell, Shopee or Facebook Marketplace instead

| # | Challenge | What the family decided |
| --- | --- | --- |
| 1 | **Discovery.** Nobody searches for "Hana's Family Preloved". Garden works because its buyers are neighbours who already know Hana. | Buyers will come mainly from **WhatsApp contacts and Status**. So the site has to make posting items to Status quick: see the **Status Card** and **item codes**. |
| 2 | **Listing work.** Clothes are one of a kind and each needs 3–5 photos, measurements and a condition grade. Garden's one-photo form and Drive-hosted images weren't designed for hundreds of items. | **The lister does all listing.** The admin needs a quick phone flow for many photos, plus smaller thumbnails and a fallback plan for image hosting. |
| 3 | **Double-selling.** Two buyers ask for the same RM20 dress and both reach Mama. | **Mama taps Reserve** once she confirms a buyer. Other buyers then see *Reserved*. Joining a waitlist is planned for v1.1. |
| 4 | **Payment and trust with postage.** Buyers have to pay before an item is posted, and there's no buyer protection. | Mama confirms first, then the buyer pays by **DuitNow QR or transfer**, then Mama posts. The site reduces the trust problem with honest condition grades, photos of flaws, measurements and a clear policy page. |
| 5 | **Mama handles everything.** Three wardrobes go through one phone, and someone has to know whose item sold. | The lister writes measurements and notes on every item, so Mama never has to remember them. (Owner tracking was proposed here and dropped on 13 Nov 2026.) |

### 2.3 Combining both sides

The **site is the family's own shop window and records everything**, and **WhatsApp handles talking to buyers and taking payment**. The site has to make sharing to WhatsApp quick, because nobody will find the site any other way.

- **Kept from the plan:** RM0 stack, no fees, the WhatsApp flow, direct relationships with buyers.
- **Taken from the counter-argument:** Reserve state, item codes, Status sharing, multi-photo listings, condition and measurement detail.
- **Given up:** marketplace search traffic and buyer protection. The site will only reach the family's own network.

**Confidence: MEDIUM.** The riskiest assumption is that WhatsApp contacts alone bring enough buyers. **Test it** with a soft launch (section 14). If it falls short, cross-list the slowest items on Carousell with their item codes and point buyers back to Mama's WhatsApp.

---

## 3. Goals and non-goals

### Goals

1. Buyers can tell whether an item fits them and what condition it's in **without asking Mama**: photos, measurements and a condition grade.
2. Items are never sold twice by accident: **Reserved** is visible within one page load of Mama tapping it.
3. Sharing an item to WhatsApp Status takes the lister **under 30 seconds**.
4. Listing one item, with photos, takes the lister **under 3 minutes** on a phone.
5. It stays **RM0 a month** to run (domain optional).

### Non-goals for v1

- Online payment (FPX, card or e-wallet gateway) or holding money for buyers
- Buyer accounts, logins, wishlists that sync across devices
- Booking couriers automatically or creating labels (Mama books on EasyParcel or the courier's app herself)
- Search engine visibility (hash routes, see Limitations)
- Reviews or ratings (screenshots of buyer messages can go on the About page instead)
- Listing for anyone outside the family (consignment)
- English version (Malay first like Garden, with common fashion terms left in English)

---

## 4. Users and their main jobs

| User | Main jobs | Where they use it |
| --- | --- | --- |
| **Buyer** | "Does this fit me?", "Is it still available?", "How much with postage?", "Ask Mama a question" | Phone, opened from a WhatsApp link |
| **Mama (Hana)** | Answer inquiries, reserve, take payment, mark sold, send tracking number | Phone, mostly WhatsApp, admin only for status taps |
| **Lister** | Photograph, measure, list, price, post to Status, change prices | Phone for listing, laptop for upkeep |

---

## 5. User journeys

### 5.1 Buyer from WhatsApp Status (the main path)

1. The buyer sees the lister's or Mama's Status card: photo, "HFP-042 · RM25 · Saiz M · Seperti baru", and the site link.
2. They tap the link and land on the **item page** (`#/item/HFP-042`) or the catalogue.
3. They swipe through the photos, check the **measurements**, and read the condition and any flaw notes.
4. They either:
   - **a.** tap **Tanya Mama** to open WhatsApp with "Salam, saya nak tanya tentang HFP-042 …" and no form, or
   - **b.** tap **Masukkan ke beg** and keep browsing.
5. At checkout they choose **Ambil sendiri** (day and time slot, as on Garden) or **Pos** (state, postcode and address).
6. The site shows the **items subtotal plus an estimated postage cost**.
7. They tap **Hantar via WhatsApp**. The inquiry is logged and WhatsApp opens with the full prefilled message.
8. Mama replies, confirms, taps **Reserve** in admin, and sends her DuitNow QR. The buyer pays and sends a receipt screenshot.
9. Mama taps **Paid**, then **Posted** (with the tracking number) or **Collected**.

### 5.2 Buyer sees an item already taken

- On an item page marked **Reserved**, the add button is replaced by "Ditempah. Tanya Mama jika tempahan dibatalkan" with a WhatsApp link. In v1.1 this becomes **Beritahu saya** (join the waitlist).
- On a **Sold** item, the page shows a "Terjual" badge and suggests similar items in the same size or category.
- If an item became Reserved or Sold while it sat in the buyer's bag, the bag and checkout **re-check status when they open** and mark it unavailable before WhatsApp opens.

### 5.3 Lister adds a new batch

1. Admin, then **+ Item baru**.
2. Pick up to **5 photos** from the camera roll and choose the cover. Photos are compressed in the browser and upload one at a time with progress.
3. Fill in title, category, size, measurements, condition and price. Any field can be copied from the previous item.
4. **Simpan & tambah lagi**. The item gets the next code (`HFP-043`).
5. Afterwards, tap **Kad Status** on any item to make a square image ready for WhatsApp Status.

### 5.4 Mama handles an inquiry

1. A new inquiry arrives on WhatsApp, and it's logged in admin under **Pertanyaan** with the status *Baru*.
2. Mama opens it in admin and sees the items, which are still *Available*.
3. She taps **Sahkan & Tempah**. The inquiry becomes *Disahkan*, its items become **Reserved**, and the hold ends in 30 minutes unless she marks it paid.
4. When the receipt arrives she taps **Dibayar**.
5. For postage she taps **Dihantar** and types the tracking number, and **Hantar tracking** opens WhatsApp with a prefilled message. For pickup she taps **Diambil**.
6. Either way the items become **Sold**.
7. If the buyer drops out she taps **Batal**, and the items go back to *Available*.

---

## 6. Feature scope

**P0** must be in the launch. **P1** comes soon after (v1.1). **P2** comes later if needed.

### 6.1 Buyer-facing

| ID | Feature | Pri. | Notes |
| --- | --- | --- | --- |
| B1 | Catalogue grid with cover photo, title, price, size and condition | P0 | Small thumbnails (`sz=w400`), lazy-loaded |
| B2 | **Filters:** category, size, condition, price range | P0 | Filters are saved in the URL hash so a filtered view can be shared |
| B3 | Sort: newest, cheapest, most expensive | P0 | |
| B4 | Search by title, brand, colour or **item code** | P0 | Typing `042` finds HFP-042 |
| B5 | Status badges: Baru masuk (≤7 days), **Ditempah**, **Terjual**, Harga turun | P0 | Sold items can be hidden or shown with a badge, set in Settings (default: shown for 14 days, as proof that things sell) |
| B6 | Item page: swipeable photo gallery (up to 5), pinch to zoom, item code shown prominently | P0 | |
| B7 | **Measurements table** in cm (chest/pit-to-pit, length, shoulder, sleeve, waist, hip, inseam, foot length for shoes), shown only when filled | P0 | Plus a note "Ukuran rata, ±1 cm" |
| B8 | **Condition grade** with a link to what each grade means, and **flaw notes** with a flaw photo | P0 | See section 7.3 |
| B9 | Brand, material, colour, original price (optional, shown crossed out) | P0 | |
| B10 | **"Tanya Mama"**: a direct WhatsApp question about one item, with no checkout | P0 | You asked that buyers can chat with Mama about anything |
| B11 | Floating WhatsApp button on every page for general questions | P0 | |
| B12 | Bag (from Garden's basket): quantity is always 1 per item, re-checks availability when opened | P0 | |
| B13 | Checkout with **delivery method**: Ambil sendiri or Pos | P0 | See section 9 |
| B14 | **Flat postage** of RM10 added when the buyer picks Pos | P0 | See section 9.2 |
| B15 | Prefilled WhatsApp message with item codes, totals, delivery method and reference | P0 | See section 10 |
| B16 | Pages for Panduan saiz (how to measure), Gred keadaan, Polisi (payment, postage, returns, privacy) and Tentang kami | P0 | |
| B17 | **Share button** on each item: native share sheet with the link, or a copied link | P0 | |
| B18 | "Anda mungkin suka": 4 similar items (same size and category, Available) | P1 | |
| B19 | **Waitlist** on Reserved items, "Beritahu saya": name and phone go into a Waitlist tab | P1 | Mama contacts them by hand when she releases the item |
| B20 | Bundle deal, e.g. "Beli 3, potong RM5", worked out in the bag | P1 | Rule set in Settings |
| B21 | "Boleh runding" (negotiable) tag on chosen items | P1 | Only a label, Mama does the negotiating |
| B22 | Link previews for each item in WhatsApp (photo and price in the link card) | P2 | Needs a Netlify Edge Function, see section 12.3 |
| B23 | English text | P2 | |

### 6.2 Admin (lister and Mama, one shared 6-digit PIN like Garden)

| ID | Feature | Pri. | Notes |
| --- | --- | --- | --- |
| A1 | PIN login, lockout and 6-hour session, unchanged from Garden | P0 | |
| A2 | Item list with a status filter and counts per status | P0 | |
| A3 | **Quick listing form**: up to 5 photos, cover choice, all item fields | P0 | |
| A4 | **One photo per upload request**, with progress, retry and reordering | P0 | Avoids Apps Script timeouts, see section 12.2 |
| A5 | **Simpan & tambah lagi** and **Salin item** (copy the previous item's fields) | P0 | For batches of the same brand or category |
| A6 | Automatic **item code** (`HFP-001`, `HFP-002` …), never reused | P0 | Code counter kept in Script Properties |
| A7 | Item statuses: Draf, Available, Reserved, Sold, Disembunyi (hidden) | P0 | See section 8 |
| A8 | **Inquiry workflow**: Baru, Disahkan & Tempah, Dibayar, Dihantar or Diambil, Selesai, or Batal | P0 | Each step is one tap, and items follow automatically |
| A9 | **Reserve for 30 minutes.** An unpaid hold expires by itself; Dibayar makes it firm. Admin shows the time left | P0 | Section 8.1 |
| A10 | Tracking number field and **Hantar tracking** (prefilled WhatsApp with the courier's tracking link) | P0 | |
| A11 | **Status Card**: a square 1080×1080 image (cover photo, code, price, size, condition, shop name) drawn in the browser and shared or downloaded | P0 | Uses the canvas the photo compressor already uses. The phone's share sheet sends it to WhatsApp Status |
| A13 | Change a price straight from the list, with an "Harga turun" flag | P1 | |
| A14 | Waitlist count on Reserved and Available items, with a WhatsApp button to the first person waiting | P1 | |
| A15 | Settings screen to edit postage rates, hold length and bundle rule from admin | P1 | In v1 these are edited directly in the Sheet |
| A16 | Separate admin roles (Mama can only change statuses, the lister can do everything) | P2 | Only if sharing one PIN causes trouble |
| A17 | Export a month's sales to CSV | P2 | The Sheet already does most of this |

---

## 7. Item data

### 7.1 Categories

Top level: **Wanita**, **Lelaki**, **Unisex**. Type:

`Baju` · `Blaus & Kemeja` · `Baju Kurung & Kebaya` · `Jubah & Abaya` · `Dress` · `Seluar` · `Skirt` · `Tudung & Selendang` · `Jaket & Sweater` · `Baju Sukan` · `Kasut` · `Beg` · `Aksesori` · `Lain-lain`

### 7.2 Sizes

- **Clothes:** XS, S, M, L, XL, 2XL, 3XL, 4XL+, Free Size
- **Shoes:** EU 35–46, with optional UK size
- **Others:** "—"

Measurements matter more than the size label, so they are **required for clothing** (at least two measurements).

### 7.3 Condition grades

These are shown on every item and explained on the Gred keadaan page.

| Grade | Meaning |
| --- | --- |
| **Baru dengan tag** | Never worn, tags still on |
| **Seperti baru** | Worn 1–3 times, no signs of wear |
| **Baik** | Worn regularly but well kept, with slight fading or bobbling allowed |
| **Ada kecacatan** | Has a flaw (stain, small hole, missing button). The **flaw note and a photo of the flaw are required** |

---

## 8. Item and inquiry states

### 8.1 Item

```
Draf ──publish──▶ Available ──Mama: Sahkan & Tempah──▶ Reserved ──Dihantar/Diambil──▶ Sold
                     ▲                                    │
                     └──────────── Batal / Lepas ─────────┘
Any state ──▶ Disembunyi (hidden from the shop, kept in the Sheet)
```

- **Only Available items** can be added to the bag or checked out.
- Reserving runs **inside the backend lock** (`LockService`, as in Garden). If one of the items isn't Available any more, the whole reserve is refused and the response names that item, so Mama doesn't confirm something that's gone.
- A hold lasts **30 minutes**. When it runs out unpaid, the item shows as Available again and can be reserved by someone else. **Dibayar** makes the hold firm, with no expiry.
- A Sold or actively Reserved item can't be deleted or edited back to Available. It can be hidden.

### 8.2 Inquiry

`Baru` ▶ `Disahkan` (items Reserved) ▶ `Dibayar` ▶ `Dihantar` (postage) **or** `Diambil` (pickup) ▶ `Selesai`. From any step before Dihantar or Diambil it can go to `Batal`, which releases its items.

Mama can confirm only some of the items in an inquiry, for example 2 of 3 because one was already taken. The remaining items are recorded on the inquiry as dropped.

---

## 9. Delivery and payment

### 9.1 Self-pickup

Same as Garden: the next 7 days, three time slots, at Kampung Undang, Bukit Payong. Payment by cash or DuitNow QR when the buyer collects. Postage: RM0.

### 9.2 Postage

- **A flat RM10** is added to any order the buyer chooses to have posted, whatever the number of items, their weight or the state. It is set once in `backend/Code.gs` (`POSTAGE_FEE`) and sent to the shop with the catalogue.
- The buyer picks their state from the list of 16 and types a 5-digit postcode. Both are checked by the backend.
- **Address privacy:** the buyer types their address at checkout. It goes **only into the WhatsApp message**. The backend logs just the **state and postcode**, so the Sheet never holds full home addresses (section 13.3).

### 9.3 Payment

1. The buyer sends the inquiry.
2. Mama confirms the items and the final total, including postage, and taps **Sahkan & Tempah**.
3. Mama sends her **DuitNow QR** image or bank details on WhatsApp. **The site never shows payment details**, so nobody pays for an item that isn't confirmed yet.
4. The buyer pays within the hold time (30 minutes) and sends a receipt.
5. Mama taps **Dibayar**, posts within the promised number of days (e.g. 3 working days), and sends the tracking number.

### 9.4 Policy page content (confirmed by the family)

- Items are preloved and sold as described. Measurements are taken flat, ±1 cm.
- No returns for size or a change of mind. If an item arrives with an **undisclosed flaw**, a refund or return is possible (buyer sends an unboxing video within 48 h).
- Unpaid holds are released after 30 minutes.
- Postage is posted within N working days. The family isn't responsible for courier delays but will help chase a lost parcel.
- Every item is washed before it is posted.
- Privacy notice, reusing Garden's PDPA wording.

---

## 10. WhatsApp messages

All messages are built in the browser and opened with `wa.me/<number>?text=…`, as on Garden.

**Inquiry from checkout**

```
Salam Hana's Family Preloved, saya nak beli item berikut:

1. HFP-042 Blaus Linen Putih (M) = RM25
2. HFP-057 Seluar Slack Hitam (L) = RM30

Jumlah item: RM55
Penghantaran: Pos ke Selangor (40150), pos RM10
Jumlah anggaran: RM65

Nama: Nurul Aisyah
Telefon: 012-345 6789
Alamat: <full address, only in this message>
Nota: Boleh hantar minggu ni?

Rujukan: INQ-1763021234567
Terima kasih!
```

For pickup, the Penghantaran line reads `Ambil sendiri: Esok, 14 Nov · 2–5 petang`.

**Tanya Mama** (one item): `Salam, saya nak tanya tentang HFP-042 Blaus Linen Putih (RM25): <link>`

**Tracking** (sent by Mama from admin): `Salam Aisyah, barang anda (INQ-…) dah dipos. No. tracking: ER123456789MY. Semak di: <courier link>. Terima kasih!`

Garden and this shop both go to Mama's number. The **shop name opens every message** and every reference uses the **HFP-** prefix, so Mama can tell which shop a message is for.

---

## 11. Data model (Google Sheet)

Use a **new Sheet, Drive folder and Apps Script deployment**, separate from Garden's, so a mistake in one shop can't affect the other.

### 11.1 `Items` tab

| Column | Type | Public? | Notes |
| --- | --- | --- | --- |
| `id` | text | yes | Internal, `ITM-<time>-<row>` like Garden |
| `code` | text | yes | `HFP-042`, shown to buyers |
| `name` | text | yes | e.g. "Blaus Linen Putih" |
| `category` | from list 7.1 | yes | |
| `brand` | text | yes | Optional |
| `size` | text | yes | From list 7.2 |
| `measurementsJson` | JSON | yes | `{ "chest": 48, "length": 66 }` in cm |
| `colour` | text | yes | |
| `condition` | grade 7.3 | yes | |
| `flawNotes` | text | yes | Required when the grade is *Ada kecacatan* |
| `price` | number | yes | RM |
| `originalPrice` | number | yes | Optional |
| `photosJson` | JSON array | yes | Up to 5 Drive URLs, the first is the cover |
| `status` | Draf / Available / Reserved / Sold / Disembunyi | yes | The shop only receives Available, Reserved, and Sold within the display window |
| `reservedFor` | inquiryId | **no** | |
| `reservedUntil` | ISO time | **no** | |
| `createdAt`, `updatedAt`, `soldAt` | ISO time | createdAt yes | createdAt drives the "Baru masuk" badge |

> **Change from Garden:** Garden's `doGet` sends every Inventory column to anyone who asks. The new `doGet` must **send only the columns marked public**, using an allow-list, and must leave out Draf and Disembunyi items. There's a security test for this (section 13.2).

### 11.2 `Inquiries` tab

`inquiryId`, `timestamp`, `customerName`, `customerPhone`, `deliveryMethod` (pickup/post), `pickupPreference`, `postState`, `postcode`, `itemsJson` (id, code, name, price), `itemsTotal`, `postage`, `total`, `notes`, `status`, `confirmedJson` (the item ids Mama reserved), `holdUntil`, `trackingNo`, `updatedAt`.

There's **no address column**, on purpose.

### 11.3 Settings

No Settings tab: the few numbers live as constants at the top of `backend/Code.gs`: `POSTAGE_FEE` (10), `HOLD_MINUTES` (30), `SOLD_VISIBLE_DAYS` (14). The postage fee and hold time are sent to the shop with the catalogue, so the site and the backend never disagree. The `ADMIN_PIN`, `WHATSAPP_NUMBER`, `DRIVE_FOLDER_ID` and `NOTIFY_EMAIL` stay in **Script Properties**, as on Garden.

### 11.5 `Waitlist` tab (P1)

`itemId`, `code`, `name`, `phone`, `timestamp`, `contacted`.

---

## 12. Architecture

### 12.1 What carries over from Garden unchanged

| Part | Garden today | Preloved |
| --- | --- | --- |
| Frontend | React 19, TypeScript, Vite 8, hand-written CSS, Fontsource fonts | Same. New visual identity (colours, fonts, logo) |
| Routing | Hash routes (`#/`, `#/pokok/:id`, `#/admin`) | Same, with `#/item/:code`, `#/saiz`, `#/polisi` and `#/tentang` |
| Hosting | Netlify static site, `netlify.toml` security headers, page CSP added at build | Same |
| Backend | One Apps Script web app: `doGet` for the catalogue, `doPost` with `action` switch | Same pattern, new actions (12.2) |
| Data | Google Sheet tabs created on first use | Items, Inquiries, Waitlist (P1) |
| Photos | Compressed in the browser to JPEG (800×1000, quality 0.82), uploaded as base64, stored in Drive, served from `drive.google.com/thumbnail` | 1200 px long side for detail views. Thumbnails use `sz=w400` |
| Auth | 6-digit PIN, 5 tries then a 15-minute lockout, UUID session in CacheService for 6 h | Same |
| Safety | `safeCell` blocks formula injection, server checks prices, 30 inquiries an hour, 1000-character limit, `LockService` around writes | Same, plus availability checks on items and an allow-list for public columns |
| Tests | Vitest with fake Apps Script services, security tests, GitHub Actions on push | Same harness, new tests |
| Demo mode | Runs on sample data in localStorage when `VITE_APPS_SCRIPT_URL` is empty | Same, with ~12 sample clothing items |
| Request trick | `text/plain` POST to skip the CORS preflight. The inquiry log gets a 4 s head start, then WhatsApp opens whether or not logging worked | Same |

### 12.2 Backend actions

| Action | Who | Change |
| --- | --- | --- |
| `GET` | public | Returns public item columns, public settings and the WhatsApp number |
| `SUBMIT_INQUIRY` | public | Now checks every item is **Available**, and returns `unavailable: [codes]` alongside the logged inquiry |
| `VERIFY_PIN`, `LOGOUT` | — | Unchanged |
| `UPLOAD_PHOTO` | admin | **New.** One compressed image per call, returns the Drive URL |
| `SAVE_ITEM` | admin | Replaces `SAVE_PLANT`. Gives out the next code on the first save |
| `SET_ITEM_STATUS` | admin | Draf, Available, Disembunyi only. Reserved and Sold only change through inquiries |
| `CONFIRM_INQUIRY` | admin | **New.** Takes the inquiry and the items to confirm. Reserves them inside the lock, or refuses and names any item that's been taken |
| `SET_INQUIRY_STATUS` | admin | Dibayar, Dihantar (+tracking), Diambil, Selesai, Batal. Dihantar and Diambil mark items Sold. Batal releases items |
| `LIST_INQUIRIES` | admin | Unchanged |
| `DELETE_ITEM` | admin | Only allowed for Draf items or items that never sold. Otherwise hide them |
| `JOIN_WAITLIST` | public (P1) | Rate-limited like inquiries |

### 12.3 Optional later addition: link previews for each item (P2)

With hash routes, a WhatsApp link to `#/item/HFP-042` always shows the **site's** preview card, never the item's photo. To fix that, add a **Netlify Edge Function** on `/i/:code`. It would fetch the catalogue from Apps Script (cached about 5 minutes), return a small HTML page with that item's `og:image` and `og:title`, and redirect people to `/#/item/:code`. That adds one small serverless piece and should stay within Netlify's free plan, but check the limits first. Until then, the **Status Card** (A11) does the job, because Status posts are images anyway.

---

## 13. Non-functional requirements

### 13.1 Performance

- First catalogue load under **3 s on 4G** for 100 items. Apps Script usually takes 1–3 s to answer a GET, so show placeholder cards while it loads.
- Catalogue cards load **one thumbnail each** (`w400`, lazy-loaded). The full gallery loads only on the item page.
- Cache the catalogue in `sessionStorage` for the visit and refresh it in the background. The bag and checkout always fetch fresh data before WhatsApp opens.

### 13.2 Security (carry over everything from Garden, plus these tests)

- GET never returns `reservedFor`, `reservedUntil`, sale data or Draf and Disembunyi items.
- `SUBMIT_INQUIRY` can't change the status of any item.
- `CONFIRM_INQUIRY` and `SET_INQUIRY_STATUS` refuse requests without a valid session.
- Confirming an item that is already Reserved or Sold is refused.
- Tampered prices or codes in a request are ignored, because the server looks them up from the Sheet (as Garden does).
- `UPLOAD_PHOTO` refuses anything that isn't an image and anything over about 2 MB after decoding.

### 13.3 Privacy (Malaysian PDPA)

- Keep only the buyer details needed to handle an order: name, phone, state and postcode. **Full addresses are never stored.**
- The privacy notice at checkout (Garden's wording, adapted) explains how buyers can ask to see or delete their details.
- Don't share the Sheet with anyone outside the family.
- Every 12 months, delete or anonymise inquiries that finished more than 12 months ago. In v1 this is done by hand, with a reminder in the setup docs.

### 13.4 Accessibility and phone use

- Designed for phones first, at 360 px width. Buttons at least 44 px.
- Photos have alt text (title, colour, which side of the item).
- Keep Garden's focus handling, labelled controls and status messages.

---

## 14. Launch plan and success measures

| Phase | Scope | Exit criteria |
| --- | --- | --- |
| **0. Copy Garden** | Copy the Garden repo into `D:\preloved web`, start a new git history, rename, new Sheet, Drive folder and deployment, demo mode working | Tests pass, demo runs |
| **1. MVP (P0)** | Everything marked P0 in section 6 | New security tests pass. One complete order run end to end, for both pickup and postage |
| **2. Soft launch** | About 30 items across all three wardrobes. Post 2–3 Status cards a day for **2 weeks**, to WhatsApp contacts only | See the measures below |
| **3. v1.1 (P1)** | Waitlist, bundle deal, similar items, change prices from the list, Settings screen | Based on what the soft launch shows |
| **4. P2** | Per-item link previews, separate roles, English | Only if a real need appears |

**Soft launch success measures, and the decision they drive**

- **≥ 10 inquiries and ≥ 5 items sold in 2 weeks:** WhatsApp alone is enough, keep going.
- **Fewer than that:** cross-list the 10 slowest items on Carousell, with item codes and "WhatsApp Mama", and run the test again.
- **Also track:** how many days items take to sell, how many inquiries get as far as Dibayar, how many double-inquiry conflicts happen (if more than 2 a week, move the waitlist up), and how long one listing takes (if more than 3 min, simplify the form).

---

## 15. Limitations

These come from the stack and from the choices above, and they're accepted for v1.

| Area | Limitation | Effect | If it becomes a problem |
| --- | --- | --- | --- |
| **Discovery** | Hash routes and a site rendered in the browser, so Google effectively can't index items | Buyers only come from shared links | Status Cards now. Per-item preview Edge Function in P2. Cross-list on Carousell if needed |
| **Link previews** | Every WhatsApp link shows the same site-wide card | Shared item links look generic | Status Card image (P0), Edge Function (P2) |
| **Images** | Drive's `thumbnail` endpoint isn't built to serve lots of images. With hundreds of photos it can be slow or occasionally fail to load | Broken or slow photos in the grid | Small thumbnails, lazy loading, Garden's photo-failed placeholder. If it happens often, move images to a free image service (e.g. Cloudinary's free tier) and add that host to the CSP |
| **Drive storage** | The 15 GB free Google storage is shared with Mama's Gmail and Photos | About 300 KB per photo, so 1,000 photos ≈ 0.3 GB, which is fine | Use a separate Google account for the shop |
| **Apps Script speed** | Cold starts take 1–3 s. Each request can run for at most 6 min. There's a limit on how many requests run at once (about 30) | Slow first load. Bursts can queue | Cache the catalogue in the browser. Upload one photo per request |
| **Email alerts** | `MailApp` on a free Google account can send about 100 emails a day | Not an issue at this volume | WhatsApp is the main alert anyway |
| **Sessions** | CacheService keeps a login for at most 6 h | Admin has to log in again every 6 h | Accepted, same as Garden |
| **Shared PIN** | One 6-digit PIN for the lister and Mama, with no record of who did what | Can't tell who changed something | Separate roles (P2) if needed |
| **Lockout** | 5 wrong PINs lock **everyone** out for 15 min, including Mama | A prankster could block admin for a while | Clear `pinLockedUntil` in Script Properties (documented in Garden's setup). Use a strong PIN |
| **Double-selling gap** | Items stay Available until Mama taps Reserve | Two buyers can ask for the same item | Reserve check inside the lock, fresh status at checkout, waitlist in P1 |
| **No payment protection** | Bank transfer or QR only, nothing held for the buyer | Some strangers won't pay first | Honest grades, flaw photos, measurements, policy page, pickup option, screenshots of buyer messages |
| **Flat postage** | RM10 whatever the parcel | A heavy parcel to Sabah costs the family more than RM10 | Change `POSTAGE_FEE` if it stops covering the courier |
| **Manual shipping** | No courier connection | Mama books, packs and types tracking numbers by hand | Accepted for low volume |
| **Rate limit** | 30 inquiries per clock hour for the whole shop | A viral Status post could hit the cap. Buyers still reach WhatsApp, but some inquiries aren't logged | Raise the constant if it happens |
| **One WhatsApp number** | Garden and Preloved both go to Mama | Messages for both shops mixed in one chat | Shop-name opening line and HFP- codes. WhatsApp Business labels |
| **Netlify free plan** | Build and bandwidth limits apply | Photos come from Drive, so the site itself stays small | Check the current Netlify plan limits once a year |

---

## 16. Risks

| Risk | Likelihood | Effect | What to do about it |
| --- | --- | --- | --- |
| Not enough buyers from WhatsApp alone | Medium | High | The soft launch test and Carousell fallback (section 14) |
| Listing takes so long that the lister stops updating | Medium | High | Copy-item, under 3 min per item, list in batches of 10 |
| Mama gets overwhelmed by inquiries and statuses | Medium | Medium | Statuses change with one tap. Measurements and notes on the item page answer most questions. WhatsApp quick replies for common answers |
| A buyer complains an item isn't as described | Low–Medium | Medium | Flaw photos are required, measurements are given, policy on unboxing videos |
| Images stop loading from Drive | Low–Medium | High | Fallback to an image service (section 15) |
| Fake or prank inquiries | Low | Low | Rate limit. An inquiry doesn't reserve anything, only Mama does |

---

## 17. Open questions for the family

1. ~~**Shop name and codes:**~~ Answered: the `HFP-` prefix stays; no wardrobe labels.
2. **Kids' clothes, household items or tudung only?** Category scope affects the filters.
3. ~~**Hold time:** 48 h, or 24 h?~~ Answered: 30 minutes.
4. ~~**Washed before posting**~~ Answered: yes. (Pet-free or smoke-free home is still open.)
5. ~~**Return policy:**~~ Answered: accepted.
6. **Sold items:** show them for 14 days as proof things sell, or hide them straight away?
7. ~~**Payout timing:**~~ No longer applies: owners were dropped.
8. **Custom domain:** keep a free `*.netlify.app` address, or buy a `.my` domain (about RM50–100 a year)?
9. ~~**Which courier** for the postage rates~~ Answered: no rate table, a flat RM10.
10. **Does Mama want email alerts** for new inquiries as well as WhatsApp?

---

## 18. Files that change after copying Garden

| Garden file | Preloved change |
| --- | --- |
| `src/types.ts` | `Plant` becomes `Item`. Adds measurements, condition, photos, code and new statuses |
| `src/config.ts` | Shop name, pickup details |
| `src/lib/api.ts` | New actions, demo mode for clothing |
| `src/lib/whatsapp.ts` | Messages with codes, delivery method, postage, Tanya Mama and tracking |
| `src/lib/format.ts` | Keeps `pickupDays` and phone checks. Adds postcode and state |
| `src/lib/image.ts` | 1200 px size, square Status Card renderer |
| `src/store.tsx` | Bag quantity fixed at 1, re-check status on open, filters in the URL |
| `src/shop/Catalog.tsx` | Filters, sort, badges |
| `src/shop/PlantPage.tsx` becomes `ItemPage.tsx` | Gallery, measurements, condition, Tanya Mama, share |
| `src/shop/Checkout.tsx` | Delivery method, address field (sent only in WhatsApp), postage estimate |
| **new** `src/shop/InfoPages.tsx` | Panduan saiz, Gred keadaan, Polisi, Tentang kami |
| `src/admin/PlantForm.tsx` becomes `ItemForm.tsx` | Multi-photo upload, copy item, save and add another |
| `src/admin/Inquiries.tsx` | Full status flow, partial confirm, tracking |
| **new** `src/admin/StatusCard.tsx` | Status Card maker |
| `backend/Code.gs` | New tabs, public-column allow-list, new actions (12.2) |
| `tests/*` | New backend and security tests from 13.2 |
| `docs/SETUP.md`, `README.md` | Rewritten for the preloved shop |
