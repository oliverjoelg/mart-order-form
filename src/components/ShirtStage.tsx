// Garment preview. Polo rounds: the 3D polo (ported from the 2026-11-20 prototype, see lib/shirt3d.ts)
// when the phone can do WebGL and the student hasn't asked for reduced motion; otherwise a 2D
// front/back flip. Hoodie rounds: the 2D hoodie for now (a 3D hoodie model comes later, same props).
import { lazy, Suspense, useState } from 'react'
import { swatch } from '../lib/colours'
import type { Garment as GarmentKind } from '../lib/theme'

const Shirt3D = lazy(() => import('./Shirt3D'))

function canDo3D(): boolean {
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

export type ShirtView = 'front' | 'back'

interface Props {
  colour: string
  printName: string
  printBatch: string
  view: ShirtView
  onFlip(): void
  /** small stage beside the colours on phones: shorter hint */
  compact?: boolean
  garment?: GarmentKind
}

type ArtProps = { side: ShirtView; colour: string; printName: string; printBatch: string }

const Shade = ({ id }: { id: string }) => (
  <defs>
    <linearGradient id={id} x1="0" x2="1">
      <stop offset="0" stopColor="#000" stopOpacity=".16" />
      <stop offset=".22" stopColor="#000" stopOpacity="0" />
      <stop offset=".78" stopColor="#000" stopOpacity="0" />
      <stop offset="1" stopColor="#000" stopOpacity=".18" />
    </linearGradient>
  </defs>
)

/** The back print both garments share: MDI, the batch emblem, the name. `top` moves it down under a hood. */
function BackPrint({ colour, printName, printBatch, top = 0 }: Omit<ArtProps, 'side'> & { top?: number }) {
  const s = swatch(colour)
  const year = printBatch.replace(/\D/g, '').slice(-2) || '26'
  return (
    <g transform={`translate(0 ${top})`}>
      <text x="150" y="112" textAnchor="middle" className="print-big" fill={s.ink}>MDI</text>
      <text x="150" y="128" textAnchor="middle" className="print-sub" fill={s.sub}>MANAGEMENT DEVELOPMENT INSTITUTE</text>
      <circle cx="150" cy="170" r="27" fill="none" stroke={s.ink} strokeWidth="2.5" />
      <text x="150" y="166" textAnchor="middle" className="print-pg" fill={s.ink}>PG'</text>
      <text x="150" y="187" textAnchor="middle" className="print-year" fill={s.ink}>{year}</text>
      <line x1="88" y1="212" x2="212" y2="212" stroke={s.sub} strokeWidth="1.5" />
      {printName && (
        <text x="150" y="240" textAnchor="middle" className="print-name" fill={s.ink} textLength={printName.length > 8 ? 150 : undefined} lengthAdjust="spacingAndGlyphs">
          {printName}
        </text>
      )}
    </g>
  )
}

// Polo silhouette in a 300 x 320 box: body, sleeves, collar.
const POLO =
  'M96 30 L60 42 L14 86 L40 128 L70 110 L72 300 Q150 312 228 300 L230 110 L260 128 L286 86 L240 42 L204 30 Q150 58 96 30 Z'

export function Polo({ side, colour, printName, printBatch }: ArtProps) {
  const s = swatch(colour)
  const shade = `shade-polo-${side}`
  return (
    <svg viewBox="0 0 300 320" className="polo" role="img" aria-label={`${colour} polo, ${side}`}>
      <Shade id={shade} />
      <path d={POLO} fill={s.base} stroke="rgba(0,0,0,.25)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d={POLO} fill={`url(#${shade})`} />
      <path d="M14 86 L40 128" stroke="rgba(0,0,0,.25)" strokeWidth="5" />
      <path d="M286 86 L260 128" stroke="rgba(0,0,0,.25)" strokeWidth="5" />
      <path d="M74 292 Q150 304 226 292" stroke="rgba(0,0,0,.18)" strokeWidth="2" strokeDasharray="5 4" fill="none" />
      {side === 'front' ? (
        <g>
          <path d="M96 30 Q150 58 204 30 L192 22 Q150 40 108 22 Z" fill={s.base} stroke="rgba(0,0,0,.3)" strokeWidth="1.5" />
          <path d="M96 30 L128 62 L150 48 Z M204 30 L172 62 L150 48 Z" fill={s.base} stroke="rgba(0,0,0,.3)" strokeWidth="1.5" />
          <rect x="143" y="48" width="14" height="70" fill="rgba(0,0,0,.06)" stroke="rgba(0,0,0,.25)" />
          <circle cx="150" cy="78" r="3.2" fill="rgba(0,0,0,.35)" />
          <circle cx="150" cy="102" r="3.2" fill="rgba(0,0,0,.35)" />
          <text x="200" y="104" textAnchor="middle" className="print-logo" fill={s.ink}>MDI</text>
        </g>
      ) : (
        <g>
          <path d="M96 30 Q150 46 204 30 L198 20 Q150 32 102 20 Z" fill={s.base} stroke="rgba(0,0,0,.3)" strokeWidth="1.5" />
          <BackPrint colour={colour} printName={printName} printBatch={printBatch} />
        </g>
      )}
    </svg>
  )
}

// Hoodie silhouette in the same 300 x 320 box: body with dropped shoulders, long sleeves, ribbed cuffs and hem.
const HOODIE =
  'M92 52 L52 66 Q32 74 26 98 L8 252 Q24 264 46 258 L62 150 L62 290 Q150 302 238 290 L238 150 L254 258 Q276 264 292 252 L274 98 Q268 74 248 66 L208 52 Z'

export function Hoodie({ side, colour, printName, printBatch }: ArtProps) {
  const s = swatch(colour)
  const shade = `shade-hoodie-${side}`
  const rib = 'rgba(0,0,0,.16)'
  return (
    <svg viewBox="0 0 300 320" className="polo hoodie" role="img" aria-label={`${colour} hoodie, ${side}`}>
      <Shade id={shade} />
      <path d={HOODIE} fill={s.base} stroke="rgba(0,0,0,.25)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d={HOODIE} fill={`url(#${shade})`} />
      {/* ribbed cuffs and hem */}
      <path d="M11 236 L48 244 L46 258 Q24 264 8 252 Z" fill={rib} />
      <path d="M289 236 L252 244 L254 258 Q276 264 292 252 Z" fill={rib} />
      <path d="M62 274 Q150 286 238 274 L238 290 Q150 302 62 290 Z" fill={rib} />
      <path d="M70 279 Q150 290 230 279" stroke="rgba(0,0,0,.12)" strokeWidth="1.5" strokeDasharray="2 5" fill="none" />
      {side === 'front' ? (
        <g>
          {/* hood rim, the opening, drawstrings, kangaroo pocket */}
          <path d="M94 62 Q90 14 150 10 Q210 14 206 62 Q196 76 186 72 Q150 30 114 72 Q104 76 94 62 Z" fill={s.base} stroke="rgba(0,0,0,.28)" strokeWidth="1.5" />
          <path d="M114 72 Q150 30 186 72 Q150 100 114 72 Z" fill="rgba(0,0,0,.38)" />
          <path d="M138 90 L134 150 M162 90 L166 150" stroke={s.sub} strokeWidth="3" strokeLinecap="round" />
          <circle cx="134" cy="152" r="3.5" fill={s.sub} />
          <circle cx="166" cy="152" r="3.5" fill={s.sub} />
          <path d="M96 200 L204 200 L222 262 L78 262 Z" fill="rgba(0,0,0,.07)" stroke="rgba(0,0,0,.2)" strokeWidth="1.5" strokeLinejoin="round" />
          <text x="150" y="184" textAnchor="middle" className="print-logo" fill={s.ink}>MDI</text>
        </g>
      ) : (
        <g>
          {/* the hood lying flat on the back */}
          <path d="M96 56 Q92 8 150 6 Q208 8 204 56 Q200 98 150 106 Q100 98 96 56 Z" fill={s.base} stroke="rgba(0,0,0,.28)" strokeWidth="1.5" />
          <path d="M150 8 L150 104" stroke="rgba(0,0,0,.14)" strokeWidth="1.5" />
          <path d="M96 56 Q92 8 150 6 Q208 8 204 56 Q200 98 150 106 Q100 98 96 56 Z" fill={`url(#${shade})`} />
          <BackPrint colour={colour} printName={printName} printBatch={printBatch} top={22} />
        </g>
      )}
    </svg>
  )
}

/** The right drawing for the round's garment. */
export function Garment({ garment = 'polo', ...p }: ArtProps & { garment?: GarmentKind }) {
  return garment === 'hoodie' ? <Hoodie {...p} /> : <Polo {...p} />
}

export default function ShirtStage({ compact, garment = 'polo', ...p }: Props) {
  const [use3D, setUse3D] = useState(canDo3D)
  // only the polo has a 3D model so far
  if (!use3D || garment !== 'polo') return <Flat {...p} garment={garment} compact={compact} />
  return (
    <div className="stage">
      <Suspense fallback={<Flat {...p} garment={garment} bare />}>
        <Shirt3D {...p} onFail={() => setUse3D(false)} />
      </Suspense>
      <div className="stage-meta">
        <span className="view-label">{p.view === 'front' ? 'Front' : 'Back'}</span>
        <span>{compact ? 'Tap to flip' : 'Drag to turn · tap to flip'}</span>
      </div>
    </div>
  )
}

/** 2D front/back flip (hoodies, the polo fallback, and while 3D loads) */
function Flat({ compact, ...p }: Props & { bare?: boolean }) {
  if (p.bare) return <FlatFlipper {...p} />
  return (
    <div className="stage">
      <FlatFlipper {...p} />
      <div className="stage-meta">
        <span className="view-label">{p.view === 'front' ? 'Front' : 'Back'}</span>
        <span>{compact ? 'Tap to flip' : 'Tap to turn'}</span>
      </div>
    </div>
  )
}

function FlatFlipper(p: Omit<Props, 'compact'> & { bare?: boolean }) {
  const noun = p.garment === 'hoodie' ? 'hoodie' : 'shirt'
  return (
    <button type="button" className={`flipper ${p.view === 'back' ? 'show-back' : ''}`} onClick={p.onFlip} aria-label={`Showing the ${p.view}. Tap to turn the ${noun}.`}>
      <span className="face front">
        <Garment garment={p.garment} side="front" colour={p.colour} printName={p.printName} printBatch={p.printBatch} />
      </span>
      <span className="face back">
        <Garment garment={p.garment} side="back" colour={p.colour} printName={p.printName} printBatch={p.printBatch} />
      </span>
    </button>
  )
}
