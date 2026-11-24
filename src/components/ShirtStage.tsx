// Shirt preview. 3D polo (ported from the 2026-11-20 prototype, see lib/shirt3d.ts) when the phone
// can do WebGL and the student hasn't asked for reduced motion; otherwise a 2D front/back flip.
// The real photogrammetry .glb will replace the 3D polo later with the same props.
import { lazy, Suspense, useState } from 'react'
import { swatch } from '../lib/colours'

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
}

// Polo silhouette in a 300 x 320 box: body, sleeves, collar.
const BODY =
  'M96 30 L60 42 L14 86 L40 128 L70 110 L72 300 Q150 312 228 300 L230 110 L260 128 L286 86 L240 42 L204 30 Q150 58 96 30 Z'

export function Polo({ side, colour, printName, printBatch }: Omit<Props, 'view' | 'onFlip' | 'compact'> & { side: ShirtView }) {
  const s = swatch(colour)
  const year = printBatch.replace(/\D/g, '') || '26'
  return (
    <svg viewBox="0 0 300 320" className="polo" role="img" aria-label={`${colour} shirt, ${side}`}>
      <defs>
        <linearGradient id={`shade-${side}`} x1="0" x2="1">
          <stop offset="0" stopColor="#000" stopOpacity=".14" />
          <stop offset=".22" stopColor="#000" stopOpacity="0" />
          <stop offset=".78" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity=".16" />
        </linearGradient>
      </defs>
      <path d={BODY} fill={s.base} stroke="rgba(0,0,0,.25)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d={BODY} fill={`url(#shade-${side})`} />
      {/* sleeve hems */}
      <path d="M14 86 L40 128" stroke="rgba(0,0,0,.25)" strokeWidth="5" />
      <path d="M286 86 L260 128" stroke="rgba(0,0,0,.25)" strokeWidth="5" />
      <path d="M74 292 Q150 304 226 292" stroke="rgba(0,0,0,.18)" strokeWidth="2" strokeDasharray="5 4" fill="none" />
      {side === 'front' ? (
        <g>
          {/* collar and placket */}
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
      )}
    </svg>
  )
}

export default function ShirtStage({ compact, ...p }: Props) {
  const [use3D, setUse3D] = useState(canDo3D)
  if (!use3D) return <Flat {...p} compact={compact} />
  return (
    <div className="stage">
      <Suspense fallback={<Flat {...p} bare />}>
        <Shirt3D {...p} onFail={() => setUse3D(false)} />
      </Suspense>
      <div className="stage-meta">
        <span className="view-label">{p.view === 'front' ? 'Front' : 'Back'}</span>
        <span>{compact ? 'Tap to flip' : 'Drag to turn · tap to flip'}</span>
      </div>
    </div>
  )
}

/** 2D front/back flip (fallback, and while 3D loads) */
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
  return (
    <>
      <button type="button" className={`flipper ${p.view === 'back' ? 'show-back' : ''}`} onClick={p.onFlip} aria-label={`Showing the ${p.view}. Tap to turn the shirt.`}>
        <span className="face front">
          <Polo side="front" colour={p.colour} printName={p.printName} printBatch={p.printBatch} />
        </span>
        <span className="face back">
          <Polo side="back" colour={p.colour} printName={p.printName} printBatch={p.printBatch} />
        </span>
      </button>
    </>
  )
}
