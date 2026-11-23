// 2D stand-in for the 3D shirt (docs/order-form-plan.md in mart-orders: real .glb model is being made).
// Same inputs the 3D viewer will take: colour, name, batch, and which side faces the student.
// It also stays as the fallback for old phones / reduced motion once the 3D model arrives.
import { swatch } from '../lib/colours'

export type ShirtView = 'front' | 'back'

interface Props {
  colour: string
  printName: string
  printBatch: string
  view: ShirtView
  onFlip(): void
}

// Polo silhouette in a 300 x 320 box: body, sleeves, collar.
const BODY =
  'M96 30 L60 42 L14 86 L40 128 L70 110 L72 300 Q150 312 228 300 L230 110 L260 128 L286 86 L240 42 L204 30 Q150 58 96 30 Z'

function Polo({ side, colour, printName, printBatch }: Omit<Props, 'view' | 'onFlip'> & { side: ShirtView }) {
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

export default function ShirtStage(p: Props) {
  return (
    <div className="stage">
      <button type="button" className={`flipper ${p.view === 'back' ? 'show-back' : ''}`} onClick={p.onFlip} aria-label={`Showing the ${p.view}. Tap to turn the shirt.`}>
        <span className="face front">
          <Polo side="front" colour={p.colour} printName={p.printName} printBatch={p.printBatch} />
        </span>
        <span className="face back">
          <Polo side="back" colour={p.colour} printName={p.printName} printBatch={p.printBatch} />
        </span>
      </button>
      <div className="stage-meta">
        <span className="view-label">{p.view === 'front' ? 'Front' : 'Back'}</span>
        <span>Tap to turn · 3D model coming</span>
      </div>
    </div>
  )
}
