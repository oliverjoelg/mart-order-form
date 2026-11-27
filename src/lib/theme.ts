// The form's look per sales round, set by MART super admins (form_rounds.theme in MART Orders).
// Colours live in styles.css under [data-skin]; this file holds the words and the garment.
import { createContext, useContext } from 'react'

export type ThemeId = 'tees' | 'hoodies'
export type Garment = 'polo' | 'hoodie'

export interface Theme {
  id: ThemeId
  /** shown to super admins in the theme picker */
  label: string
  garment: Garment
  /** "polo" / "hoodie": used in headings and buttons */
  noun: string
  /** the giant word behind the garment */
  word: string
  heroLines: [string, string, string]
  lede: string
  ticker: string[]
  /** headline per step: details, items */
  detailsHead: string
  itemsHead: string
  sizeHelp: string
  /** falling snow behind the shirt and the sign-in page */
  snow: boolean
  closedLede: string
}

export const THEMES: Record<ThemeId, Theme> = {
  tees: {
    id: 'tees',
    label: 'Batch T-shirt',
    garment: 'polo',
    noun: 'polo',
    word: 'the batch',
    heroLines: ['Wear', 'the', 'batch.'],
    lede: 'MART merch for MDI Gurgaon. Pick the colour and size, put your name on the back, pay by UPI. Two minutes, start to finish.',
    ticker: ['Navy Blue', 'Baby Pink', 'Black', 'White', 'Your name on the back', 'Batch on the back'],
    detailsHead: 'Who’s wearing it?',
    itemsHead: 'Pick your polo.',
    sizeHelp: 'Polos run true to size. If you’re between two sizes, pick the bigger one.',
    snow: false,
    closedLede: 'There’s no round open right now. Watch the MART group for the next one.',
  },
  hoodies: {
    id: 'hoodies',
    label: 'Winter Hoodies',
    garment: 'hoodie',
    noun: 'hoodie',
    word: 'mandevian',
    heroLines: ['Hood', 'up,', 'batch.'],
    lede: 'MART winter hoodies for MDI Gurgaon. Pick the colour and size, put your name on the back, pay by UPI. Two minutes, then stay warm.',
    ticker: ['Winter hoodies', 'Fleece inside', 'Your name on the back', 'Batch on the back', 'Collect from MART'],
    detailsHead: 'Who’s it keeping warm?',
    itemsHead: 'Pick your hoodie.',
    sizeHelp: 'Hoodies are a relaxed fit. Take your usual size, or one up if you wear layers underneath.',
    snow: true,
    closedLede: 'No hoodie round is open right now. Watch the MART group for the next one.',
  },
}

export const THEME_IDS = Object.keys(THEMES) as ThemeId[]

export const isThemeId = (v: unknown): v is ThemeId => typeof v === 'string' && Object.prototype.hasOwnProperty.call(THEMES, v)

/** Whatever the database says (or nothing, before the migration): a theme we can draw. */
export const resolveTheme = (v: unknown): Theme => THEMES[isThemeId(v) ? v : 'tees']

/** Paints the page: colours and the browser bar follow the theme. */
export function applySkin(t: Theme) {
  document.documentElement.dataset.skin = t.id
}

export const ThemeCtx = createContext<Theme>(THEMES.tees)
export const useTheme = () => useContext(ThemeCtx)
