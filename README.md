# Hana's Family Preloved

Preloved clothes, tudung, shoes and bags from three wardrobes in our family: Mama's, Papa's and mine. Browse what's available, put a few things in the bag, and send one WhatsApp message to Mama (Hana) to buy them.

> **Status: in development.** This is the Phase 0 copy of [Hana's Garden](https://lamanhana.netlify.app), rebranded for clothes and running on sample items. The full plan, including postage, reserving items and payouts for each owner, is in **[docs/PRD.md](docs/PRD.md)**.

## How buying works today

1. **Browse:** every item has a photo, a price, its size, condition, colour and brand.
2. **Fill the bag:** pick as many items as you like.
3. **Choose a pickup time:** any of the next 7 days, morning or afternoon, in Kampung Undang, Bukit Payong.
4. **Send on WhatsApp:** WhatsApp opens with your list already written. Press send, and Mama replies to confirm.

No app, no account and no online payment. All you need is WhatsApp.

## Coming next (Phase 1, see the PRD)

- Postage anywhere in Malaysia with an estimated postage cost
- **Reserved** and **Sold** states, so one item is never sold twice
- Up to 5 photos, measurements in cm and condition grades for each item
- Item codes like `HFP-042` and a Status Card image for sharing to WhatsApp Status
- Owner on each item (Almari Mama, Papa or mine) and a payout summary

## Under the hood

The same setup as Hana's Garden: a React and TypeScript site built with Vite and hosted on Netlify. A Google Sheet holds the items and inquiries, a Google Drive folder holds new photos, and a small Google Apps Script connects them, so there's no server to pay for. It uses its **own** Sheet, Drive folder and Apps Script deployment, separate from Hana's Garden.

The admin passcode, WhatsApp number and customer details are never stored in this repository. Tests, including attacks an outsider might try, run on every push.

To run it yourself or connect it to Google, see **[docs/SETUP.md](docs/SETUP.md)**.
