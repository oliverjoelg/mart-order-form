import { Garment } from '../components/ShirtStage'
import { lineToCart, priceOf, type Line } from '../lib/order'
import { useTheme } from '../lib/theme'
import type { OrderForm } from '../lib/types'
import { inr } from '../lib/validate'

/** The bag's items as cards with a little garment: colour, size, name, batch, price. */
export default function BagList({ form, lines, onEdit, onRemove }: { form: OrderForm; lines: Line[]; onEdit?(key: string): void; onRemove?(key: string): void }) {
  const theme = useTheme()
  return (
    <ul className="bag-list">
      {lines.map((l, i) => {
        const p = form.products.find((x) => x.id === l.product_id)
        const c = lineToCart(l)
        return (
          <li key={l.key}>
            <span className="bag-mini" aria-hidden="true">
              <Garment garment={theme.garment} side="back" colour={p?.colour ?? ''} printName={c.print_name ?? ''} printBatch={c.print_batch} />
            </span>
            <span className="bag-text">
              <b>{p?.colour ?? 'Item'} · <span className="print-face">{c.size}</span></b>
              <small>{c.print_name ? <span className="print-face">{c.print_name}</span> : 'No name'} · {c.print_batch}</small>
            </span>
            <span className="bag-price">{inr(priceOf(form, l))}</span>
            {(onEdit || onRemove) && (
              <span className="bag-acts">
                {onEdit && <button type="button" className="link small" onClick={() => onEdit(l.key)} aria-label={`Edit item ${i + 1}`}>Edit</button>}
                {onRemove && <button type="button" className="link small" onClick={() => onRemove(l.key)} aria-label={`Remove item ${i + 1}`}>Remove</button>}
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}
