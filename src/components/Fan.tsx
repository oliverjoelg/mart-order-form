// Garments fanned out behind the batch numeral: the sign-in picture, and the stage beside the
// details and check-and-submit steps on laptops (showing what the student is ordering).
import { batchNumeral } from '../lib/order'
import { useTheme } from '../lib/theme'
import { Garment } from './ShirtStage'
import Snow from './Snow'

export interface FanShirt {
  colour: string
  name: string
}

export default function Fan({ shirts, batch, className = '', snow = true }: { shirts: FanShirt[]; batch: string; className?: string; snow?: boolean }) {
  const theme = useTheme()
  const [c, l, r] = shirts
  return (
    <div className={`fan ${className}`} aria-hidden="true">
      {theme.snow && snow && <Snow />}
      <span className="numeral">{batchNumeral(batch) || '26'}</span>
      {l && <span className="fan-shirt l"><Garment garment={theme.garment} side="back" colour={l.colour} printName={l.name} printBatch={batch} /></span>}
      {r && <span className="fan-shirt r"><Garment garment={theme.garment} side="back" colour={r.colour} printName={r.name} printBatch={batch} /></span>}
      {c && <span className="fan-shirt c"><Garment garment={theme.garment} side="back" colour={c.colour} printName={c.name} printBatch={batch} /></span>}
    </div>
  )
}

/** The colours the sign-in picture shows for each garment. */
export const SHOWCASE: Record<'polo' | 'hoodie', string[]> = {
  polo: ['Navy Blue', 'Baby Pink', 'Black'],
  hoodie: ['Black', 'Brown', 'Cream'],
}
