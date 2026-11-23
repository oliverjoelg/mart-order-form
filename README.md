# mart-order-form

MART's student order site. Replaces the Google Form + Google Sheets: students sign in with their
@mdi.ac.in Google account, order up to 6 items, pay by UPI to the live QR and upload the screenshot.
Orders go straight into the **MART Orders** Supabase project and show up there immediately.

- Plan and decisions: `mart-orders/docs/order-form-plan.md` and `mart-orders/docs/decisions.md`
  ("Order form database"). **All database migrations live in the `mart-orders` repo**, so the
  schema has one home. This repo is front-end only.
- MART Orders stays team-only: a student who signs in there gets zero rows.

## Run it

```bash
npm install
npm run dev:demo   # made-up data, no accounts; sign-in is a button; you are also a form admin
npm run dev        # real Supabase: needs .env (copy .env.example)
npm test           # input rules (same rules the database enforces)
npm run build
```

## What's where

| Path | What |
|---|---|
| `src/pages/Order.tsx` | Details → Items (shirt preview) → Payment (live QR, txn ID, screenshot) → Submit |
| `src/pages/MyOrders.tsx` | The student's own orders: Ordered → At the vendor → Ready to collect → Collected |
| `src/pages/Admin.tsx` | Form admins (max 2): open/close the round, products, prices, sizes, photos, payment QRs |
| `src/components/ShirtStage.tsx` | 2D front/back stand-in for the 3D shirt. Swap in the `.glb` viewer here (same props) |
| `src/lib/api-supabase.ts` | Calls `get_order_form`, `submit_order`, `my_orders`, `form_admin_*`, Storage |
| `src/lib/api-demo.ts` | In-memory backend for `dev:demo` (not in the production bundle) |
| `src/lib/validate.ts` | Checks as you type; keep in step with `submit_order()` in the migration |

## How it behaves

- Students have **no table rights**. Everything goes through `security definer` functions that
  check the caller (must be a Google sign-in with an @mdi.ac.in email) and validate every value.
  Prices come from the database; the total is computed there.
- **No edits or cancels** by students. Problems go to MART, who fix them in MART Orders.
- The order in progress is kept in this browser (per account) so it survives the phone killing the
  tab while the student is in their UPI app. Cleared after submitting.
- The form reloads when the student comes back to the page, so a rotated QR or a closed round shows.
- Screenshots are shrunk on the phone to about 200 KB (JPEG) and stored in the private
  `payment-screenshots` bucket, in the student's own folder. Only "Check payments" users read them
  (MART Orders → Payments → "Screenshot").
- Checked at 360px with Android Chrome emulation: no page scrolls sideways.

## Still needed from Oliver

- The real `.glb` shirt model, print artwork (PNG/SVG), exact colour hex codes (`src/lib/colours.ts`).
- Vendor's name-print rules (font, size, max letters: now letters, spaces, `. ' -`, max 12) and
  the size chart numbers (the dashed box on the Items step).

## Deploy

`.github/workflows/deploy.yml` builds on push to `main` and publishes to GitHub Pages
(`https://oliverjoelg.github.io/mart-order-form/`). Needs repo variables `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY`, and Pages needs a public repo or a paid GitHub plan.
Never put the `sb_secret_` key anywhere in this repo.
