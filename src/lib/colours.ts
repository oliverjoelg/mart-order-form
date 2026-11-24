// Shirt colours for the preview. Stand-ins until Oliver sends the exact hex codes from the vendor.
export interface Swatch {
  base: string // fabric
  ink: string // main print
  sub: string // secondary print
}

const KNOWN: Record<string, Swatch> = {
  'navy blue': { base: '#1f2945', ink: '#eef1f7', sub: '#aebbd6' },
  navy: { base: '#1f2945', ink: '#eef1f7', sub: '#aebbd6' },
  'baby pink': { base: '#f0c7d1', ink: '#1f2945', sub: '#4d5c80' },
  pink: { base: '#f0c7d1', ink: '#1f2945', sub: '#4d5c80' },
  black: { base: '#18191b', ink: '#e3c48f', sub: '#b8995f' },
  white: { base: '#f2f2ef', ink: '#2b6f86', sub: '#6ea8ba' },
  grey: { base: '#8a8f98', ink: '#141a2a', sub: '#2f3646' },
  gray: { base: '#8a8f98', ink: '#141a2a', sub: '#2f3646' },
  maroon: { base: '#5b1a24', ink: '#f3e6d0', sub: '#c9a98a' },
  green: { base: '#2f4a3a', ink: '#eef1e6', sub: '#a9bfa8' },
}

/** relative brightness 0..1 of a #rrggbb colour */
function lightness(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const ch = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * ch(n >> 16) + 0.7152 * ch((n >> 8) & 255) + 0.0722 * ch(n & 255)
}

/** dark print on light fabric, light print on dark fabric */
function printFor(base: string): Pick<Swatch, 'ink' | 'sub'> {
  return lightness(base) > 0.3 ? { ink: '#141a2a', sub: '#3b4357' } : { ink: '#f2f4f8', sub: '#c9cfdb' }
}

export function swatch(colour: string): Swatch {
  const known = KNOWN[colour.trim().toLowerCase()]
  if (known) return known
  const base = '#9aa1ad' // stand-in until the colour is added above
  return { base, ...printFor(base) }
}
