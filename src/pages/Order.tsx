import { useEffect, useMemo, useRef, useState } from 'react'
import ShirtStage, { type ShirtView } from '../components/ShirtStage'
import { Chips, Field, useApi, useFileUrl, useToast } from '../components/ui'
import type { AuthUser } from '../lib/api'
import { friendlyError } from '../lib/api'
import { swatch } from '../lib/colours'
import { compressImage } from '../lib/image'
import type { CartItem, OrderForm, StudentDetails, SubmitResult } from '../lib/types'
import {
  MAX_ITEMS, cleanPrintName, customSizeError, detailsErrors, inr, normalisePhone, normaliseRoll, normaliseTxn, printNameError, txnError,
} from '../lib/validate'

type Step = 'details' | 'items' | 'payment' | 'review'
const STEPS: { key: Step; label: string }[] = [
  { key: 'details', label: 'Details' },
  { key: 'items', label: 'Items' },
  { key: 'payment', label: 'Payment' },
  { key: 'review', label: 'Submit' },
]

interface Draft {
  step: Step
  details: StudentDetails
  cart: CartItem[]
  txn: string
  shot: string | null
}

// The draft survives a reload: on phones the browser tab is often killed while the student
// is in their UPI app paying. Kept in this browser only, per account, cleared after submitting.
const draftKey = (u: AuthUser, roundId: string) => `mart-order-draft:${u.id}:${roundId}`
function loadDraft(key: string): Draft | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as Draft) : null
  } catch {
    return null
  }
}

const uid = () => Math.random().toString(36).slice(2, 10)

export default function Order({ form, user, onDone }: { form: OrderForm; user: AuthUser; onDone(r: SubmitResult): void }) {
  const round = form.round!
  const api = useApi()
  const toast = useToast()
  const key = draftKey(user, round.campaign_id)
  const initial = useMemo(() => loadDraft(key), [key])
  const cap = Math.min(round.item_cap, MAX_ITEMS)

  const [step, setStep] = useState<Step>(initial?.step ?? 'details')
  const [details, setDetails] = useState<StudentDetails>(
    initial?.details ?? {
      name: form.me?.name ?? '', phone: form.me?.phone ?? '', roll_no: form.me?.roll_no ?? '',
      batch: form.me?.batch ?? '', course: form.me?.course ?? '', section: form.me?.section ?? '',
    },
  )
  // drop cart lines whose product left the form since the draft was saved
  const [cart, setCart] = useState<CartItem[]>(() => (initial?.cart ?? []).filter((c) => form.products.some((p) => p.id === c.product_id)))
  const [txn, setTxn] = useState(initial?.txn ?? '')
  const [shot, setShot] = useState<string | null>(initial?.shot ?? null)
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const top = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify({ step, details, cart, txn, shot } satisfies Draft))
    } catch {
      /* private mode: no draft, still works */
    }
  }, [key, step, details, cart, txn, shot])

  const go = (s: Step) => {
    setError(null)
    setTouched(false)
    setStep(s)
    requestAnimationFrame(() => top.current?.scrollIntoView({ block: 'start' }))
  }

  const total = cart.reduce((s, c) => s + (form.products.find((p) => p.id === c.product_id)?.price_inr ?? 0), 0)
  const idx = STEPS.findIndex((s) => s.key === step)

  async function submit() {
    if (!form.qr || !shot) return
    setBusy(true)
    setError(null)
    try {
      const r = await api.submitOrder({
        campaignId: round.campaign_id,
        details: { ...details, phone: normalisePhone(details.phone), roll_no: normaliseRoll(details.roll_no), name: details.name.trim() },
        items: cart,
        payment: { qr_id: form.qr.id, txn_id: normaliseTxn(txn), screenshot_path: shot },
      })
      try {
        localStorage.removeItem(key)
      } catch {
        /* ignore */
      }
      onDone(r)
    } catch (e) {
      setError(friendlyError(e))
      toast('Not submitted. See the message above the button.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div ref={top} className="order">
      <ol className="progress" aria-label="Order steps">
        {STEPS.map((s, i) => (
          <li key={s.key} aria-current={i === idx ? 'step' : undefined} className={i < idx ? 'done' : ''}>
            <span className="num">{i + 1}</span> {s.label}
          </li>
        ))}
      </ol>

      {step === 'details' && (
        <DetailsStep form={form} details={details} setDetails={setDetails} touched={touched}
          onNext={() => {
            setTouched(true)
            if (Object.keys(detailsErrors(details, round)).length === 0) go('items')
          }} />
      )}

      {step === 'items' && (
        <ItemsStep form={form} cap={cap} cart={cart} setCart={setCart} onBack={() => go('details')}
          onNext={() => (cart.length ? go('payment') : toast('Add at least one item first.'))} />
      )}

      {step === 'payment' && (
        <PaymentStep form={form} user={user} total={total} txn={txn} setTxn={setTxn} shot={shot} setShot={setShot}
          onBack={() => go('items')}
          onNext={() => {
            setTouched(true)
            if (!txnError(txn) && shot) go('review')
          }} touched={touched} />
      )}

      {step === 'review' && (
        <section className="panel stack">
          <div className="step-head">
            <span className="eyebrow">Step 4 of 4</span>
            <h2>Check and submit</h2>
          </div>
          <dl className="receipt">
            <Row k="Name" v={details.name.trim()} />
            <Row k="Roll no." v={normaliseRoll(details.roll_no)} />
            <Row k="Phone" v={normalisePhone(details.phone)} />
            <Row k="Batch · course · section" v={`${details.batch} · ${details.course} · ${details.section}`} />
            <Row k="Email" v={form.email} />
          </dl>
          <CartList form={form} cart={cart} />
          <dl className="receipt">
            <Row k="Paid to" v={form.qr?.payee_name ?? '—'} />
            <Row k="Transaction ID" v={normaliseTxn(txn)} />
            <div className="receipt-row receipt-total"><dt>Total</dt><dd>{inr(total)}</dd></div>
          </dl>
          <p className="note warn-box">After you submit you can't change or cancel the order. Check the sizes and names now.</p>
          {error && <p className="error" role="alert">{error}</p>}
          <div className="actions">
            <button type="button" className="btn" onClick={() => go('payment')} disabled={busy}>Back</button>
            <button type="button" className="btn primary" onClick={submit} disabled={busy}>
              {busy ? 'Submitting…' : `Submit order · ${inr(total)}`}
            </button>
          </div>
        </section>
      )}
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="receipt-row">
      <dt>{k}</dt>
      <dd>{v}</dd>
    </div>
  )
}

// ---------------------------------------------------------------------------
function DetailsStep({ form, details, setDetails, touched, onNext }: {
  form: OrderForm; details: StudentDetails; setDetails(d: StudentDetails): void; touched: boolean; onNext(): void
}) {
  const round = form.round!
  const errs = touched ? detailsErrors(details, round) : {}
  const set = (k: keyof StudentDetails) => (v: string) => setDetails({ ...details, [k]: v })
  return (
    <section className="panel stack">
      <div className="step-head">
        <span className="eyebrow">{round.title}</span>
        {round.team_only && <span className="badge ok">MART team round · only team members can order</span>}
        <h1>Wear the batch.</h1>
        {round.intro && <p className="lede">{round.intro}</p>}
      </div>
      <p className="muted small">Signed in as <b>{form.email}</b></p>
      <Field label="Full name" htmlFor="f-name" error={errs.name}>
        <input id="f-name" className="input" autoComplete="name" value={details.name} onChange={(e) => set('name')(e.target.value)} />
      </Field>
      <Field label="Roll number" htmlFor="f-roll" error={errs.roll_no}>
        <input id="f-roll" className="input upper" autoCapitalize="characters" spellCheck={false} value={details.roll_no} onChange={(e) => set('roll_no')(e.target.value)} />
      </Field>
      <Field label="Mobile number" htmlFor="f-phone" error={errs.phone} hint="MART calls this number when your order is ready.">
        <input id="f-phone" className="input" type="tel" inputMode="tel" autoComplete="tel" value={details.phone} onChange={(e) => set('phone')(e.target.value)} />
      </Field>
      <Field label="Batch" error={errs.batch}>
        <Chips label="Batch" options={round.student_batches} value={details.batch} onChange={set('batch')} />
      </Field>
      <Field label="Course" error={errs.course}>
        <Chips label="Course" options={round.courses} value={details.course} onChange={set('course')} />
      </Field>
      <Field label="Section" error={errs.section}>
        <Chips label="Section" options={round.sections} value={details.section} onChange={set('section')} />
      </Field>
      <div className="actions">
        <button type="button" className="btn primary" onClick={onNext}>Next: pick items</button>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------------------
function ItemsStep({ form, cap, cart, setCart, onBack, onNext }: {
  form: OrderForm; cap: number; cart: CartItem[]; setCart(c: CartItem[]): void; onBack(): void; onNext(): void
}) {
  const round = form.round!
  const toast = useToast()
  const [productId, setProductId] = useState(form.products[0]?.id ?? '')
  const product = form.products.find((p) => p.id === productId) ?? form.products[0]
  const [size, setSize] = useState('M')
  const [custom, setCustom] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [name, setName] = useState('')
  const [noName, setNoName] = useState(false)
  const [batch, setBatch] = useState(round.print_batches[round.print_batches.length - 1] ?? '')
  const [view, setView] = useState<ShirtView>('front')
  const [nameWarn, setNameWarn] = useState<string | null>(null)
  const photo = useFileUrl('form-assets', product?.photo_paths[0])
  const full = cart.length >= cap

  if (!product) return <section className="panel"><p>No items are on sale right now.</p></section>

  const pickProduct = (id: string) => {
    const p = form.products.find((x) => x.id === id)!
    setProductId(id)
    setView('front')
    if (!useCustom && !p.sizes.includes(size)) {
      const next = p.sizes.includes('M') ? 'M' : p.sizes[0] ?? ''
      toast(`${size} isn't made in ${p.colour}, so the size is now ${next}.`)
      setSize(next)
    }
    if (useCustom && !p.allow_custom_size) setUseCustom(false)
  }

  const add = () => {
    if (full) return toast(`At most ${cap} items per order.`)
    if (!noName && !name.trim()) {
      setView('back')
      document.getElementById('f-print')?.focus()
      return toast('Type a name for the back, or tick “No name on the back”.')
    }
    const finalSize = useCustom ? custom.trim() : size
    if (useCustom && customSizeError(custom)) return toast(customSizeError(custom)!)
    if (!finalSize) return toast('Pick a size.')
    const pe = noName ? null : printNameError(name, round.name_max)
    if (pe) return toast(pe)
    if (!batch) return toast('Pick the batch to print on the back.')
    setCart([...cart, { key: uid(), product_id: product.id, size: finalSize, print_name: noName ? null : name.trim(), print_batch: batch }])
    toast(`Added ${product.colour} ${finalSize}${!noName ? ` · ${name.trim()}` : ''}.`)
  }

  return (
    <div className="items-step">
      <div className="stage-wrap">
        <ShirtStage colour={product.colour} printName={noName ? '' : name.trim()} printBatch={batch} view={view} onFlip={() => setView(view === 'front' ? 'back' : 'front')} />
      </div>
      <div className="panel stack">
        <div className="step-head">
          <span className="eyebrow">Step 2 of 4 · item {Math.min(cart.length + 1, cap)} of up to {cap}</span>
          <h2>Pick a colour</h2>
        </div>
        <div className="choices" role="radiogroup" aria-label="Colour">
          {form.products.map((p) => (
            <button key={p.id} type="button" role="radio" aria-checked={p.id === product.id} aria-label={`${p.name}, ${inr(p.price_inr)}`} className="choice" onClick={() => pickProduct(p.id)}>
              <span className="dot" style={{ background: swatch(p.colour).base }} />
              <span className="choice-text">
                <span className="choice-name">{p.colour}</span>
                <span className="choice-line">{p.name.replace(p.colour, '').trim() || p.name} · {inr(p.price_inr)}</span>
              </span>
            </button>
          ))}
        </div>
        {(product.description || photo) && (
          <div className="product-info">
            {photo && <img src={photo} alt={product.name} loading="lazy" />}
            {product.description && <p className="note">{product.description}</p>}
          </div>
        )}

        <h3>Size</h3>
        <Chips label="Size" options={product.sizes} value={useCustom ? '' : size} onChange={(s) => { setSize(s); setUseCustom(false); setView('front') }} />
        {product.allow_custom_size && (
          <label className="toggle">
            <input type="checkbox" checked={useCustom} onChange={(e) => setUseCustom(e.target.checked)} /> My size isn't listed
          </label>
        )}
        {useCustom && (
          <Field label="Your size" htmlFor="f-custom" error={custom ? customSizeError(custom) : null} hint="e.g. Chest 38 / Length 28">
            <input id="f-custom" className="input" value={custom} maxLength={40} onChange={(e) => setCustom(e.target.value)} />
          </Field>
        )}
        <div className="chart-slot">Size chart (chest and length in inches) goes here once the vendor sends the numbers.</div>

        <h3>Name on the back</h3>
        <Field label="Name to print" htmlFor="f-print" error={nameWarn} hint={`Letters, spaces, . ' and - · up to ${round.name_max} · printed in capitals`}>
          <div className="name-row">
            <input id="f-print" className="input name-input" autoComplete="off" autoCapitalize="characters" spellCheck={false}
              placeholder="YOUR NAME" value={name} disabled={noName}
              onFocus={() => setView('back')}
              onChange={(e) => {
                const clean = cleanPrintName(e.target.value, round.name_max)
                setNameWarn(clean !== e.target.value.toUpperCase().replace(/\s{2,}/g, ' ') ? "Only letters, spaces, . ' and - can be printed." : null)
                setName(clean)
              }} />
            <span className="counter">{name.length}/{round.name_max}</span>
          </div>
        </Field>
        <label className="toggle">
          <input type="checkbox" checked={noName} onChange={(e) => { setNoName(e.target.checked); if (e.target.checked) setName(''); setView('back') }} /> No name on the back
        </label>
        <Field label="Batch printed on the back">
          <Chips label="Batch printed on the back" options={round.print_batches} value={batch} onChange={(b) => { setBatch(b); setView('back') }} />
        </Field>

        <div className="actions">
          <button type="button" className="btn primary" onClick={add} disabled={full}>{full ? `Order is full (${cap})` : `Add to order · ${inr(product.price_inr)}`}</button>
        </div>

        <div className="step-head">
          <h2>Your order ({cart.length}/{cap})</h2>
        </div>
        {cart.length === 0 ? <p className="muted">Nothing added yet.</p> : <CartList form={form} cart={cart} onRemove={(k) => setCart(cart.filter((c) => c.key !== k))} />}
        <div className="actions">
          <button type="button" className="btn" onClick={onBack}>Back</button>
          <button type="button" className="btn primary" onClick={onNext} disabled={!cart.length}>Next: payment</button>
        </div>
      </div>
    </div>
  )
}

function CartList({ form, cart, onRemove }: { form: OrderForm; cart: CartItem[]; onRemove?(key: string): void }) {
  return (
    <ul className="cart">
      {cart.map((c, i) => {
        const p = form.products.find((x) => x.id === c.product_id)
        return (
          <li key={c.key}>
            <span className="dot sm" style={{ background: swatch(p?.colour ?? '').base }} />
            <span className="cart-text">
              <b>{i + 1}. {p?.name ?? 'Item'} · {c.size}</b>
              <span className="muted small">{c.print_name ? `“${c.print_name}”` : 'No name'} · {c.print_batch}</span>
            </span>
            <span className="price">{inr(p?.price_inr ?? 0)}</span>
            {onRemove && <button type="button" className="btn-x" aria-label={`Remove item ${i + 1}`} onClick={() => onRemove(c.key)}>×</button>}
          </li>
        )
      })}
    </ul>
  )
}

// ---------------------------------------------------------------------------
function PaymentStep({ form, user, total, txn, setTxn, shot, setShot, onBack, onNext, touched }: {
  form: OrderForm; user: AuthUser; total: number; txn: string; setTxn(t: string): void; shot: string | null; setShot(p: string | null): void
  onBack(): void; onNext(): void; touched: boolean
}) {
  const api = useApi()
  const toast = useToast()
  const qrUrl = useFileUrl('form-assets', form.qr?.image_path)
  const shotUrl = useFileUrl('payment-screenshots', shot)
  const [uploading, setUploading] = useState(false)
  const tErr = touched ? txnError(txn) : null

  if (!form.qr) {
    return (
      <section className="panel stack">
        <h2>Payment isn't open yet</h2>
        <p className="muted">MART hasn't put up a payment QR. Your order is saved on this phone; come back in a little while.</p>
        <div className="actions"><button type="button" className="btn" onClick={onBack}>Back</button></div>
      </section>
    )
  }
  const q = form.qr
  const upiLink = q.upi_id
    ? `upi://pay?pa=${encodeURIComponent(q.upi_id)}&pn=${encodeURIComponent(q.payee_name)}&am=${total}&cu=INR&tn=${encodeURIComponent('MART order')}`
    : null

  async function pick(file: File | undefined) {
    if (!file) return
    setUploading(true)
    try {
      const small = await compressImage(file)
      setShot(await api.uploadScreenshot(user.id, small))
    } catch (e) {
      toast(friendlyError(e))
    } finally {
      setUploading(false)
    }
  }

  return (
    <section className="panel stack">
      <div className="step-head">
        <span className="eyebrow">Step 3 of 4</span>
        <h2>Pay {inr(total)}</h2>
        <p className="lede">Scan with any UPI app, or save the QR and open it from your gallery.</p>
      </div>
      <div className="qr-card">
        {qrUrl ? <img src={qrUrl} alt={`UPI QR code for ${q.payee_name}`} width={240} height={240} /> : <div className="qr-ph" />}
        <div className="qr-meta">
          <b>{q.payee_name}</b>
          {q.upi_id && (
            <button type="button" className="link" onClick={() => navigator.clipboard?.writeText(q.upi_id!).then(() => toast('UPI ID copied'))}>
              {q.upi_id} · Copy
            </button>
          )}
          <span className="amount">{inr(total)}</span>
        </div>
      </div>
      {upiLink && <a className="btn" href={upiLink}>Open my UPI app</a>}
      <p className="note">Pay exactly {inr(total)} to this QR. Then come back here: your order is saved on this phone.</p>

      <Field label="UPI transaction ID (UTR)" htmlFor="f-txn" error={tErr} hint="12 digits in GPay / PhonePe / Paytm, under the payment details.">
        <input id="f-txn" className="input mono" inputMode="text" autoCapitalize="characters" spellCheck={false} value={txn} onChange={(e) => setTxn(e.target.value)} />
      </Field>

      <Field label="Payment screenshot" error={touched && !shot ? 'Upload the screenshot of the payment' : null}>
        <label className={`upload ${uploading ? 'busy' : ''}`}>
          <input type="file" accept="image/*" onChange={(e) => void pick(e.target.files?.[0])} disabled={uploading} />
          {uploading ? 'Uploading…' : shot ? 'Change screenshot' : 'Choose screenshot'}
        </label>
        {shotUrl && <img className="shot" src={shotUrl} alt="Your payment screenshot" />}
      </Field>

      <div className="actions">
        <button type="button" className="btn" onClick={onBack}>Back</button>
        <button type="button" className="btn primary" onClick={onNext} disabled={uploading}>Next: check</button>
      </div>
    </section>
  )
}
