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
  grey: { base: '#8a8f98', ink: '#ffffff', sub: '#dfe2e8' },
  maroon: { base: '#5b1a24', ink: '#f3e6d0', sub: '#c9a98a' },
  green: { base: '#2f4a3a', ink: '#eef1e6', sub: '#a9bfa8' },
}

export function swatch(colour: string): Swatch {
  return KNOWN[colour.trim().toLowerCase()] ?? { base: '#9aa1ad', ink: '#ffffff', sub: '#e6e8ec' }
}
