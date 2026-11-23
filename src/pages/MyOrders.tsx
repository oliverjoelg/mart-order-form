import { useEffect, useState } from 'react'
import { Spinner, useApi } from '../components/ui'
import { friendlyError } from '../lib/api'
import { swatch } from '../lib/colours'
import type { ItemStatus, MyOrder, PaymentStatus } from '../lib/types'
import { inr } from '../lib/validate'

const TRACK: { key: ItemStatus; label: string }[] = [
  { key: 'ordered', label: 'Ordered' },
  { key: 'sent_to_vendor', label: 'At the vendor' },
  { key: 'received', label: 'Ready to collect' },
  { key: 'handed_over', label: 'Collected' },
]

const PAY: Record<PaymentStatus, { label: string; cls: string }> = {
  unchecked: { label: 'Payment being checked', cls: 'badge' },
  received: { label: 'Payment confirmed', cls: 'badge ok' },
  problem: { label: 'Payment problem: contact MART', cls: 'badge bad' },
}

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''

export default function MyOrders({ justPlaced }: { justPlaced?: string | null }) {
  const api = useApi()
  const [orders, setOrders] = useState<MyOrder[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.myOrders().then(setOrders, (e) => setError(friendlyError(e)))
  }, [api])

  if (error) return <section className="panel"><p className="error">{error}</p></section>
  if (!orders) return <Spinner />

  return (
    <section className="panel stack">
      <div className="step-head">
        <h2>My orders</h2>
        <p className="lede">Orders can't be changed or cancelled here. For a problem, message MART with your roll number.</p>
      </div>
      {orders.length === 0 && <p className="muted">No orders yet.</p>}
      {orders.map((o) => (
        <article key={o.key} className={`order-card ${o.key === justPlaced ? 'fresh' : ''}`}>
          <header>
            <div>
              <b>{o.round}</b>
              <span className="muted small">{when(o.submitted_at)}</span>
            </div>
            <span className="price">{inr(o.total_inr)}</span>
          </header>
          {o.payment_status && <span className={PAY[o.payment_status].cls}>{PAY[o.payment_status].label}</span>}
          <ul className="cart">
            {o.items.map((i, n) => {
              const at = TRACK.findIndex((t) => t.key === i.status)
              return (
                <li key={n} className="tracked">
                  <span className="dot sm" style={{ background: swatch(i.colour).base }} />
                  <span className="cart-text">
                    <b>{i.product} · {i.size}</b>
                    <span className="muted small">{i.print_name ? `“${i.print_name}”` : 'No name'}{i.print_batch ? ` · ${i.print_batch}` : ''}</span>
                    <ol className="track" aria-label={`Status: ${TRACK[at]?.label}`}>
                      {TRACK.map((t, k) => (
                        <li key={t.key} className={k <= at ? 'on' : ''} aria-current={k === at ? 'step' : undefined}>{t.label}</li>
                      ))}
                    </ol>
                  </span>
                </li>
              )
            })}
          </ul>
        </article>
      ))}
    </section>
  )
}
