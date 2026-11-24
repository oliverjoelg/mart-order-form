# MART order form: design

Direction **A, "Fitting room"** (chosen by Oliver, 2026-11-24, from the mockups at
https://claude.ai/artifact/B8QYJ9yQToSBSBPiyFZaMw), plus B's one-line details for returning students.
Pushed further to become MART's identity: *Wear the batch.*

## The job
A student orders 1–2 polos in under 2 minutes, mostly on a phone, often switching to a UPI app and back.

- **One screen per step, one card per item.** Colour, size, back name and batch for an item fit on
  one 360px screen without scrolling.
- **The bottom bar is the way forward.** It is always there on phones, with the running total and the
  next action. Nobody scrolls to find "Next".
- **The shirt serves the choice.** It's a small live stage beside the colours on phones, and a big
  sticky stage on laptops. It shows the back by default, because that's what the student customises.
- **Returning students skip Details.** If the saved details are complete, the order opens on Items
  with a one-line "Asha Verma · PG26123 · PGDM B · Edit" summary.

## Identity: one bold thing
**The batch numeral.** The two digits of the batch printed on the back (`PG'26` → `26`) sit huge
and outlined in MART orange behind the shirt, like a jersey number. They change when the batch
changes. The same numeral shows on the Done tag and the login hero. Everything around it stays quiet:
grey paper, ink, one orange.

Supporting moves (all in service of that one idea):
- The wordmark and headlines use Archivo's **width axis** expressively: 125% wide, weight 900.
- Back names, sizes on tags, and order codes are set in **Michroma**, the print face, so what you
  type looks like what gets printed.
- The **garment tag** carries the order from start to finish, because that's what you get with a
  shirt. On Items, the size, back name and batch sit on a cream tag (clipped top corners, punched
  hole with a string up to the shirt, a tear line, and the price at the foot). Each item is a mini
  luggage tag in the item strip and the laptop rail, and the one being edited is filled (ink in light
  mode, orange in dark). The receipt and the Done screen are tags too. Tags are always light card
  stock (`--tag`) in both themes, so controls on a tag use fixed light-theme colours. Added
  2026-11-24 at Oliver's request, from the mockup at https://claude.ai/artifact/11WdEQyqa2iWRgT8uom3kd.

## Tokens

### Colour
| Token | Light | Dark | Use |
|---|---|---|---|
| `--paper` | `#eceef1` | `#0d1018` | page |
| `--card` | `#fbfbfc` | `#161a24` | cards, dock, inputs |
| `--ink` | `#121726` | `#eef0f5` | text, selected chips |
| `--muted` | `#586074` | `#9aa2b5` | secondary text |
| `--line` | `#d4d8e1` | `#2a3040` | borders |
| `--orange` | `#c8431a` | `#f2763f` | MART orange: primary action, batch numeral, focus of attention |
| `--orange-ink` | `#ffffff` | `#1a0b04` | text on orange |
| `--stage-1` / `--stage-2` | `#f9fafb` / `#d8dce5` | `#252b39` / `#0d1018` | shirt stage gradient |
| `--ok` | `#1d7a46` | `#4cc38a` | payment confirmed, collected |
| `--bad` | `#b42318` | `#ff7a6b` | errors |
| `--focus` | `#2b59d9` | `#8fb0ff` | focus ring, links |
| `--tag` | `#f6f3ee` | `#f6f3ee` | garment tag (always light, like card stock) |
| `--tag-on` / `--tag-on-ink` | `#121726` / `#f6f3ee` | `#f2763f` / `#1a0b04` | the item tag being edited |

Orange is used only for: the main action, the batch numeral, the active step, and the "new" order
highlight. Status colours (ok/bad) never stand in for the accent.

### Type
| Role | Face | Setting |
|---|---|---|
| Display (wordmark, h1, prices in the dock) | Archivo | 900, `font-stretch: 125%`, tight leading 0.95 |
| Headings (h2/h3) | Archivo | 800, `font-stretch: 112%` |
| Body, labels, buttons | Inter | 400/500/600/700, 15px base, sentence case |
| Print (back name, tag sizes, order code) | Michroma | 0.12em tracking, uppercase only where the print is uppercase |

Scale (px): 12 · 13 · 15 · 17 · 22 · 28 · 40 · clamp(44, 13vw, 88).
No all-caps eyebrow labels. Labels are sentence case, 13px, 600.

### Spacing
4px base: `--s1` 4 · `--s2` 8 · `--s3` 12 · `--s4` 16 · `--s5` 24 · `--s6` 32 · `--s7` 48.
Side gutter is 16px on phones and 32px on laptops. Groups are spaced with `gap`, never with margins.

### Radius
`--r-chip` 10 (size chips, batch segments) · `--r-ctl` 14 (inputs, buttons) · `--r-card` 20
(stage, cards) · `999px` (pills, swatches). Tags use 6px with a punched hole.

### Elevation
Flat by default. There are only two shadows: the dock (`0 -8px 24px` at 8% ink), and the shirt's
own drop shadow. Cards don't get shadows.

### Motion
| Token | Value | Use |
|---|---|---|
| `--t-fast` | 140ms | chip/swatch press, button feedback |
| `--t-med` | 280ms | step change (fade + 8px rise), numeral swap |
| `--t-slow` | 650ms | the one orchestrated moment per screen: login headline width-stretch, Done tag swing |
| `--ease-out` | `cubic-bezier(.2,.7,.2,1)` | default |
| `--ease-swing` | `cubic-bezier(.34,1.56,.64,1)` | tag swing only |

Only `transform` and `opacity` are animated. With `prefers-reduced-motion: reduce`, every
transition becomes a ≤150ms opacity fade, the login ticker stops, and the shirt is the 2D version.

## Layout
- **Phone (<960px):** sticky top bar (wordmark, Order / My orders / Admin). Under it, a progress line
  shows four segments and the step's name. Then the content, then the **dock**, which is sticky to the
  bottom and holds the total and the actions. The toast sits above the dock.
- **Laptop (≥960px):** content up to 1180px wide. The Items step has three columns: a sticky shirt
  stage, the item card, and an order rail with the lines, total and Pay. The rail replaces the dock.
  Other steps use a 2-column layout where it helps (Payment: the QR ticket beside the fields).

## States (per frontend-design-direction)
| State | Where | What the student sees |
|---|---|---|
| Loading | app start, My orders, Admin | wordmark + spinner in place, layout doesn't jump |
| Empty | no products on sale; no orders yet | a sentence plus the next action ("Watch the MART group", "Place an order") |
| Error | network/database | the specific message from `friendlyError`, plus "Try again" |
| Partial | QR not live yet | items saved in this browser; payment says it isn't open yet |
| Success | Done | garment tag with the order code, items and total; "See my orders" |
| Permission | non-MDI account, team-only round, in-app browser | says exactly who can order and what to do |

## Accessibility
- All choice groups (colour, size, batch, course, section) are native radio inputs styled as chips,
  so arrow keys and screen readers work without extra code.
- Inputs have `<label>`s. Errors are linked with `aria-describedby` and announced.
- Touch targets are at least 44px. Focus is a 2px `--focus` ring with a 2px offset.
- Contrast: ink on paper is above 14:1, orange-ink on orange is above 4.5:1 in both themes.
- No sideways scroll at 360px.
