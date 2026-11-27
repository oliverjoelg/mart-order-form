// Garment preview. Polo rounds: the 3D polo (ported from the 2026-11-20 prototype, see lib/shirt3d.ts)
// when the phone can do WebGL and the student hasn't asked for reduced motion; otherwise a 2D
// front/back flip. Hoodie rounds: the 2D hoodie for now (a 3D hoodie model comes later, same props).
import { lazy, Suspense, useState } from 'react'
import { hoodieInk, swatch } from '../lib/colours'
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

// Oversized hoodie in the same 300 x 320 box, after the 2026-11-27 design sheet: dropped shoulders,
// long sleeves with ribbed cuffs, ribbed hem. Back: "mandevian" across the shoulders, the name under a rule.
// Front: MDI GURGAON on the chest, the batch year stacked large at the lower left.
// shortcut: the lettering is a font stand-in, swap in the real artwork (SVG/PNG) when it arrives.
const HOODIE =
  'M98 50 L44 64 Q26 72 22 96 L10 262 Q26 274 50 268 L60 162 L60 284 Q150 296 240 284 L240 162 L250 268 Q274 274 290 262 L278 96 Q274 72 256 64 L202 50 Z'

export function Hoodie({ side, colour, printName, printBatch }: ArtProps) {
  const s = swatch(colour)
  const ink = hoodieInk(colour)
  const shade = `shade-hoodie-${side}`
  const rib = 'rgba(0,0,0,.18)'
  const year = printBatch.replace(/\D/g, '').slice(-2) || '27'
  return (
    <svg viewBox="0 0 300 320" className="polo hoodie" role="img" aria-label={`${colour} hoodie, ${side}`}>
      <Shade id={shade} />
      <path d={HOODIE} fill={s.base} stroke="rgba(0,0,0,.3)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d={HOODIE} fill={`url(#${shade})`} />
      <path d="M12 246 L52 252 L50 268 Q26 274 10 262 Z" fill={rib} />
      <path d="M288 246 L248 252 L250 268 Q274 274 290 262 Z" fill={rib} />
      <path d="M60 268 Q150 280 240 268 L240 284 Q150 296 60 284 Z" fill={rib} />
      <path d="M60 162 L60 120 M240 162 L240 120" stroke="rgba(0,0,0,.14)" strokeWidth="1.5" />
      {side === 'front' ? (
        <g>
          {/* hood rim and opening */}
          <path d="M100 56 Q96 10 150 6 Q204 10 200 56 Q190 72 178 68 Q150 26 122 68 Q110 72 100 56 Z" fill={s.base} stroke="rgba(0,0,0,.3)" strokeWidth="1.5" />
          <path d="M122 68 Q150 26 178 68 Q150 92 122 68 Z" fill="rgba(0,0,0,.4)" />
          <text x="196" y="104" textAnchor="middle" className="hd-chest" fill={ink}>MDI</text>
          <text x="196" y="111" textAnchor="middle" className="hd-chest-sub" fill={ink}>GURGAON</text>
          <text x="72" y="190" className="hd-tiny" fill={ink}>Future is us :)</text>
          <text x="70" y="226" className="hd-year" fill={ink}>20</text>
          <text x="70" y="262" className="hd-year" fill={ink}>{year}</text>
          <circle cx="104" cy="232" r="22" fill="none" stroke={ink} strokeOpacity=".35" strokeWidth="2" />
          <text x="86" y="276" className="hd-tiny" fill={ink}>batch</text>
        </g>
      ) : (
        <g>
          {/* the hood lying on the back */}
          <path d="M100 52 Q96 4 150 2 Q204 4 200 52 Q196 96 150 104 Q104 96 100 52 Z" fill={s.base} stroke="rgba(0,0,0,.3)" strokeWidth="1.5" />
          <path d="M100 52 Q96 4 150 2 Q204 4 200 52 Q196 96 150 104 Q104 96 100 52 Z" fill={`url(#${shade})`} />
          <text x="150" y="146" textAnchor="middle" className="hd-word" fill={ink} transform="skewX(-12) translate(31 0)">mandevian</text>
          <line x1="104" y1="156" x2="196" y2="156" stroke={ink} strokeWidth="1.5" />
          {printName && (
            <text x="150" y="172" textAnchor="middle" className="hd-name" fill={ink} textLength={printName.length > 9 ? 120 : undefined} lengthAdjust="spacingAndGlyphs">
              + {printName} +
            </text>
          )}
          <circle cx="92" cy="122" r="4" fill="none" stroke={ink} strokeWidth="1.2" />
          <circle cx="212" cy="168" r="4" fill="none" stroke={ink} strokeWidth="1.2" />
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
