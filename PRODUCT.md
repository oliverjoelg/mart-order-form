# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
- **Students** of MDI Gurgaon (PGDM batches), on their phones, in the hostel or between classes. They order 1–2 items of batch merch in about two minutes, switch to a UPI app to pay, then come back to upload the screenshot.
- **Form admins** (1–2 MART members) run sales rounds on laptops: open/close the round, pick shown products, set the live payment QR.
- **MART super admins** also pick each round's theme.

## Product Purpose
MART's student order site. It replaced a Google Form + Sheets: students sign in with their @mdi.ac.in Google account, pick up to 6 items (colour, size, name and batch printed on the back), pay by UPI to the live QR, enter the UTR and upload the screenshot. Orders land straight in MART Orders. Success: a student orders 1–2 items in under two minutes without help, and MART gets clean, checkable orders.

## Positioning
The batch's own merch, made for them: their name and batch printed on the back, previewed live on the garment before they pay. Sold in timed rounds by MART, the student merch team.

## Operating Context
- Sales rounds open and close (one open at a time). A round has a title and a free-text note (e.g. "Orders close Friday 6 pm"); there is no structured deadline field.
- Each round has a theme set by super admins: **Batch T-shirt** (polos) or **Winter Hoodies**. The whole form follows it.
- Payment is outside the site: the student leaves for GPay / PhonePe / Paytm and returns; the order in progress is kept in this browser.
- MART checks payments by hand in MART Orders; students follow items on My orders (Ordered → At the vendor → Ready to collect → Collected).

## Capabilities and Constraints
- Up to 6 items per order; prices, sizes and products come from MART Orders and are read-only here.
- Back name: letters, spaces, . ' - up to 12 (per round), printed in capitals. Optional "no name".
- No edits or cancels by students after submitting.
- Screenshot compressed to ~200 KB before upload; UPI transaction ID required.
- Wording says "this browser", never "this phone".
- 3D garment preview (polo now; hoodie and polo models to be built from real photos), 2D fallback for no-WebGL and reduced motion.
- Static site on GitHub Pages (Vite + React + TypeScript), Supabase backend; all rules enforced in the database.

## Brand Commitments
- **MART** name as the brand.
- **The garment tag** (clothing-tag item card, receipt) stays as a motif.

## Evidence on Hand
- Real product photos: coming from Oliver (not yet in the repo).
- Real order deadlines: per round, as text in the round note only.
- No sales counts, stock numbers, testimonials or "sold out" data exist. Never fabricate them.

## Product Principles
1. Two minutes on a phone: every step fits one screen, the next action is always in reach.
2. The student's own name on the garment is the hook: show it early and big.
3. Never lose an order in progress: the UPI round-trip must be safe.
4. Truthful urgency only: deadlines and limits come from the round, never invented.
5. The theme is the round's identity: tees and hoodies must each feel like their own drop.

## Accessibility & Inclusion
Phone-first at 360px with no sideways scroll; touch targets ≥ 44px; keyboard and screen-reader usable choice groups; reduced motion respected.
