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
npm test           # input rules (same rules the database enforces) + order/draft logic
npm run build
```

## What's where

| Path | What |
|---|---|
| `DESIGN.md` | The look: tokens (colour, type, spacing, radius, motion), layout, states. Read before changing styles |
| `src/pages/Order.tsx` | Details (skipped when saved details are complete) → Items (one card per item, bottom bar with total) → Payment (live QR, txn ID, screenshot) → Check and submit |
| `src/lib/order.ts` | Items being edited, the draft kept in this browser (also reads pre-redesign drafts), per-item checks. Tested in `order.test.ts` |
| `src/pages/MyOrders.tsx` | The student's own orders: Ordered → At the vendor → Ready to collect → Collected |
| `src/pages/Admin.tsx` | Form admins (max 2): open/close the round, which products show, photos, descriptions, payment QRs. Prices and sizes are read-only here (set in MART Orders) |
| `src/components/ShirtStage.tsx` | Shirt preview: 3D polo (`src/lib/shirt3d.ts`, three.js, ported from the 2026-11-20 prototype, loaded on demand) with a 2D front/back flip for phones without WebGL or with reduced motion. Swap the real `.glb` in here later (same props) |
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

- The real `.glb` shirt model (the 3D polo is drawn in code for now; no downloaded model, so no licence or credit needed), print artwork (PNG/SVG), exact colour hex codes (`src/lib/colours.ts`).
- Vendor's name-print rules (font, size, max letters: now letters, spaces, `. ' -`, max 12) and
  the size chart numbers (the dashed box on the Items step).

## Deploy

`.github/workflows/deploy.yml` builds on push to `main` and publishes to GitHub Pages
(`https://oliverjoelg.github.io/mart-order-form/`). Needs repo variables `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY`, and Pages needs a public repo or a paid GitHub plan.
Never put the `sb_secret_` key anywhere in this repo.
