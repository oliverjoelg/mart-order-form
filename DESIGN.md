# MART order form: design

**The drop** (2026-11-27). Oliver asked for a full redo in a streetwear-drop direction: "like a
sneaker or merch drop site: huge product imagery, bold stickers and badges, marquee text,
high-contrast black and one loud colour." Replaces the grey-and-orange "Fitting room" look.
Product facts live in PRODUCT.md; the direction contract in `.impeccable/surfaces/`.

## The idea
A merch drop, not a form. The garment is the product shot, big on black, and the student's own
name prints onto it as they type. Everything else stays quiet and black so the garment and the one
loud colour do the talking.

## Colour: one look, on purpose
Single dark look in both system themes (students order at night in the hostel; black makes the
garment the brightest thing on screen).

| Token | Value | Use |
|---|---|---|
| `--paper` | `#000000` | page |
| `--card` | `#111111` (surfaces `#0b0b0b`–`#0d0d0d`) | fields, cards, rail |
| `--ink` | `#ffffff` | text, selected chips (white with black text) |
| `--muted` | `#a7a7a7` | secondary text |
| `--line` | `#2c2c2c` (`#333` on fields) | borders |
| `--loud` | **Volt `#c8ff2e`** (Batch T-shirt) / **Periwinkle `#9aa6ff`** (Winter Hoodies, the real hoodie print colour) | marquee, primary buttons, price sticker, current item, links, focus, batch numeral, last line of the sign-in headline |
| `--tag`, `--tag-ink`, `--tag-muted` | `#f3eee4`, `#111111`, `#5f5a52` | the garment tag: always light card stock |
| `--ok`, `--bad` | `#5fe08f`, `#ff6f61` | status |

Text on the loud colour is always black. The theme only swaps `--loud` (`:root[data-skin='hoodies']`).

## Type
| Role | Face | Setting |
|---|---|---|
| Display (wordmark, headlines, tabs, buttons, labels, stickers, marquee) | **Big Shoulders Display**, self-hosted in `src/assets/fonts/` | 800–900, all caps, line-height .86–.88 |
| UI text | Archivo (Google Fonts) | 400–800, sentence case |
| Print (back name, sizes on tags, order code) | Michroma | tracked .08–.16em |

Headlines: sign-in up to `min(12vw, 23vh, 210px)` on laptops, `34vw` on phones; step headlines
`clamp(48px, 15vw, 104px)`.

## The drop's devices
- **Marquee band** under the top bar on every order step and the sign-in ticker: the round's own
  title and note (its real closing time) on repeat, in the loud colour. No invented scarcity.
- **The product shot** (Items): black studio stage with a spotlight; garment centred with a faint
  white rim light (so black and brown garments keep their edge); batch numeral outlined behind;
  **stickers**: price (loud, rotated −6°) and the back name (white, Michroma, rotated 4°); the colour
  name huge at the bottom-left with the swatches beside it.
- **Garment tag** (kept brand commitment): the cream item card (size, back name, batch, price),
  mini luggage tags for the item strip and laptop rail (current one in the loud colour), the
  receipt and the Done tag.
- **Snow** on winter rounds (stage, sign-in), behind content; stops with reduced motion.

## Layout
- Phone: the Items step fits one 360×780 screen (tag ends at the bottom bar): marquee, slim details
  line, item strip, product shot 206px, tag, bottom bar (total, + Add, Pay).
- Laptop ≥960px: product shot as a tall sticky column (left), headline + tag (middle), the order as a
  stack of tags (right). Details and Check-and-submit pair the form with a stage on the right;
  My orders is two columns.

## Radius, depth, motion
Radius 8px controls, 10px fields, 14px stage/cards, 6px stickers. Depth only from soft shadows under
stickers and garments. Motion: marquee/ticker loops, the headline stretch-in, the Done tag drop-in
(ease-out `cubic-bezier(.16,1,.3,1)`); reduced motion turns them into short fades and stops the loops.

## Garments
Polo: the 3D model (2D fallback). Hoodie: the 2D drawing after the 2026-11-27 design sheet: oversized,
"mandevian" on the back with the name under a rule, MDI GURGAON on the chest, batch year stacked on
the lower front. Colours black / brown / cream with lavender or sky-blue print (`hoodieInk`). The
lettering is a font stand-in until the real artwork arrives; 3D models from photos are pending.
