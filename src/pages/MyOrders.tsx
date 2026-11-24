import { useCallback, useEffect, useState } from 'react'
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
  problem: { label: 'Payment problem: message MART', cls: 'badge bad' },
}

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''

export default function MyOrders({ justPlaced, onOrder }: { justPlaced?: string | null; onOrder(): void }) {
  const api = useApi()
  const [orders, setOrders] = useState<MyOrder[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setError(null)
    api.myOrders().then(setOrders, (e) => setError(friendlyError(e)))
  }, [api])
  useEffect(load, [load])

  return (
    <section className="orders">
      <header className="step-head">
        <h1>My orders</h1>
        <p className="lede">Orders can't be changed or cancelled here. For a problem, message MART with your roll number.</p>
      </header>

      {error ? (
        <div className="empty-box">
          <p className="error" role="alert">{error}</p>
          <button type="button" className="btn ghost" onClick={load}>Try again</button>
        </div>
      ) : !orders ? (
        <Spinner label="Loading your orders…" />
      ) : orders.length === 0 ? (
        <div className="empty-box">
          <p><b>No orders yet.</b> When you place one, you'll follow each item here from ordered to collected.</p>
          <button type="button" className="btn primary" onClick={onOrder}>Place an order</button>
        </div>
      ) : (
        <div className="order-list">
          {orders.map((o) => (
            <article key={o.key} className={`order-card ${o.key === justPlaced ? 'fresh' : ''}`}>
              <header>
                <div>
                  <h2>{o.round}</h2>
                  <span className="fineprint">{when(o.submitted_at)}{o.key === justPlaced ? ' · just now' : ''}</span>
                </div>
                <span className="price">{inr(o.total_inr)}</span>
              </header>
              {o.payment_status && <span className={PAY[o.payment_status].cls}>{PAY[o.payment_status].label}</span>}
              <ul className="tracked">
                {o.items.map((i, n) => {
                  const at = TRACK.findIndex((t) => t.key === i.status)
                  return (
                    <li key={n}>
                      <i className="dot" style={{ background: swatch(i.colour).base }} />
                      <div className="line-text">
                        <b>{i.product} · <span className="print-face">{i.size}</span></b>
                        <small>{i.print_name ? <span className="print-face">{i.print_name}</span> : 'No name'}{i.print_batch ? ` · ${i.print_batch}` : ''}</small>
                        <ol className="track" aria-label={`Status: ${TRACK[at]?.label}`}>
                          {TRACK.map((t, k) => (
                            <li key={t.key} className={k <= at ? 'on' : ''} aria-current={k === at ? 'step' : undefined}><span>{t.label}</span></li>
                          ))}
                        </ol>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </article>
          ))}
        </div>
      )}
      <p className="signed"><button type="button" className="link" onClick={() => void api.signOut()}>Sign out</button></p>
    </section>
  )
}
