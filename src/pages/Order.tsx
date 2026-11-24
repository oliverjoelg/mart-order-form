import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
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
    // the items step places itself (shirt under the top bar); other steps start at the top
    if (s !== 'items') requestAnimationFrame(() => top.current?.scrollIntoView({ block: 'start' }))
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
  form: OrderForm; details: StudentDetails; setDetails: Dispatch<SetStateAction<StudentDetails>>; touched: boolean; onNext(): void
}) {
  const round = form.round!
  const errs = touched ? detailsErrors(details, round) : {}
  const set = (k: keyof StudentDetails) => (v: string) => setDetails((d) => ({ ...d, [k]: v }))
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
// Items step, laid out like the 2026-11-20 prototype: the shirt stays put (left half on wide
// screens, top on phones) and turns as the student scrolls through the sections beside it:
// colour (front), size (side), name (back), check (all the way round), then the order so far.
const SECTIONS = [
  { key: 'colour', angle: 0.35 },
  { key: 'size', angle: 0.85 }, // three-quarter view (straight side-on looks into the sleeve)
  { key: 'name', angle: Math.PI },
  { key: 'check', angle: Math.PI * 2 },
  { key: 'order', angle: Math.PI * 2 },
] as const

const smoothstep = (t: number) => {
  t = Math.max(0, Math.min(1, t))
  return t * t * (3 - 2 * t)
}

function sideOf(a: number): 'Front' | 'Side' | 'Back' {
  const n = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
  return n < 0.6 || n > 5.7 ? 'Front' : n > 2.5 && n < 3.8 ? 'Back' : 'Side'
}

function ItemsStep({ form, cap, cart, setCart, onBack, onNext }: {
  form: OrderForm; cap: number; cart: CartItem[]; setCart: Dispatch<SetStateAction<CartItem[]>>; onBack(): void; onNext(): void
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
  const [nameWarn, setNameWarn] = useState<string | null>(null)
  const photo = useFileUrl('form-assets', product?.photo_paths[0])
  const full = cart.length >= cap

  // --- turning the shirt: scroll position -> angle (read by the 3D view every frame)
  const sectionEls = useRef<(HTMLElement | null)[]>([])
  const stageEl = useRef<HTMLDivElement>(null)
  const scrollAngle = useRef<number>(SECTIONS[0].angle)
  const flipped = useRef(false) // a tap on the shirt turns it half round
  const nameFocus = useRef(false) // typing the name shows the back
  const [label, setLabel] = useState<'Front' | 'Side' | 'Back'>('Front')
  const angle = () => (nameFocus.current ? Math.PI : scrollAngle.current + (flipped.current ? Math.PI : 0))
  const refreshLabel = () => setLabel(sideOf(angle()))

  useEffect(() => {
    let raf = 0
    const compute = () => {
      raf = 0
      const vh = window.innerHeight
      const sr = stageEl.current?.getBoundingClientRect()
      const sideBySide = !!sr && sr.width < window.innerWidth * 0.8
      // the point on screen that "reads" the sections: middle of the screen beside the shirt,
      // or a little below the sticky shirt on phones
      const anchor = sideBySide || !sr ? vh * 0.5 : sr.bottom + (vh - sr.bottom) * 0.4
      const pts = sectionEls.current
        .map((el, i) => (el ? { y: el.getBoundingClientRect().top + Math.min(el.offsetHeight, vh) * 0.3, a: SECTIONS[i].angle } : null))
        .filter((p): p is { y: number; a: number } => !!p)
      if (!pts.length) return
      let a = pts[pts.length - 1].a
      if (anchor <= pts[0].y) a = pts[0].a
      else
        for (let i = 0; i < pts.length - 1; i++) {
          if (anchor < pts[i + 1].y) {
            a = pts[i].a + (pts[i + 1].a - pts[i].a) * smoothstep((anchor - pts[i].y) / (pts[i + 1].y - pts[i].y))
            break
          }
        }
      scrollAngle.current = a
      refreshLabel()
    }
    const on = () => {
      if (!raf) raf = requestAnimationFrame(compute)
    }
    // like the prototype: the shirt starts right under the top bar (the tabs and step bar are one
    // short scroll up), so the full-height shirt isn't cut off at the bottom
    const top = stageEl.current?.closest('.items-step')?.getBoundingClientRect().top
    if (top !== undefined) window.scrollBy({ top: top - (document.querySelector('.topbar')?.getBoundingClientRect().height ?? 48) })
    compute()
    window.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    return () => {
      window.removeEventListener('scroll', on)
      window.removeEventListener('resize', on)
      cancelAnimationFrame(raf)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const goTo = (key: (typeof SECTIONS)[number]['key']) =>
    sectionEls.current[SECTIONS.findIndex((s) => s.key === key)]?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    })

  if (!product) return <section className="panel"><p>No items are on sale right now.</p></section>

  const pickProduct = (id: string) => {
    const p = form.products.find((x) => x.id === id)!
    setProductId(id)
    if (!useCustom && !p.sizes.includes(size)) {
      const next = p.sizes.includes('M') ? 'M' : p.sizes[0] ?? ''
      toast(`${size} isn't made in ${p.colour}, so the size is now ${next}.`)
      setSize(next)
    }
    if (useCustom && !p.allow_custom_size) setUseCustom(false)
  }

  const finalSize = useCustom ? custom.trim() : size
  const add = () => {
    if (full) return toast(`At most ${cap} items per order.`)
    if (!noName && !name.trim()) {
      goTo('name')
      document.getElementById('f-print')?.focus({ preventScroll: true })
      return toast('Type a name for the back, or tick “No name on the back”.')
    }
    if (useCustom && customSizeError(custom)) return toast(customSizeError(custom)!)
    if (!finalSize) return toast('Pick a size.')
    const pe = noName ? null : printNameError(name, round.name_max)
    if (pe) return toast(pe)
    if (!batch) return toast('Pick the batch to print on the back.')
    setCart((c) => [...c, { key: uid(), product_id: product.id, size: finalSize, print_name: noName ? null : name.trim(), print_batch: batch }])
    toast(`Added ${product.colour} ${finalSize}${!noName ? ` · ${name.trim()}` : ''}.`)
    goTo('order')
  }

  const itemNo = Math.min(cart.length + 1, cap)
  const view: ShirtView = label === 'Back' ? 'back' : 'front'
  const ref = (i: number) => (el: HTMLElement | null) => {
    sectionEls.current[i] = el
  }

  return (
    <div className="items-step">
      <div className="stage-wrap" ref={stageEl}>
        <ShirtStage
          colour={product.colour}
          printName={noName ? '' : name.trim()}
          printBatch={batch}
          view={view}
          label={label}
          getAngle={angle}
          onFlip={() => {
            flipped.current = !flipped.current
            refreshLabel()
          }}
        />
      </div>

      <div className="steps">
        <section className="step" ref={ref(0)}>
          <div className="step-head">
            <span className="eyebrow">Item {itemNo} of up to {cap} · Colour</span>
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
        </section>

        <section className="step" ref={ref(1)}>
          <div className="step-head">
            <span className="eyebrow">Item {itemNo} · Size</span>
            <h2>Pick a size</h2>
          </div>
          <Chips label="Size" options={product.sizes} value={useCustom ? '' : size} onChange={(s) => { setSize(s); setUseCustom(false) }} />
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
          <div className="chart-slot">The size chart (chest and length in inches) goes here once the vendor sends the numbers.</div>
        </section>

        <section className="step" ref={ref(2)}>
          <div className="step-head">
            <span className="eyebrow">Item {itemNo} · Back print</span>
            <h2>Your name on the back</h2>
          </div>
          <Field label="Name to print" htmlFor="f-print" error={nameWarn} hint={`Letters, spaces, . ' and - · up to ${round.name_max} · printed in capitals`}>
            <div className="name-row">
              <input id="f-print" className="input name-input" autoComplete="off" autoCapitalize="characters" spellCheck={false}
                placeholder="YOUR NAME" value={name} disabled={noName}
                onFocus={() => { nameFocus.current = true; refreshLabel() }}
                onBlur={() => { nameFocus.current = false; refreshLabel() }}
                onChange={(e) => {
                  const clean = cleanPrintName(e.target.value, round.name_max)
                  setNameWarn(clean !== e.target.value.toUpperCase().replace(/\s{2,}/g, ' ') ? "Only letters, spaces, . ' and - can be printed." : null)
                  setName(clean)
                }} />
              <span className="counter">{name.length}/{round.name_max}</span>
            </div>
          </Field>
          <label className="toggle">
            <input type="checkbox" checked={noName} onChange={(e) => { setNoName(e.target.checked); if (e.target.checked) setName('') }} /> No name on the back
          </label>
          <Field label="Batch printed on the back">
            <Chips label="Batch printed on the back" options={round.print_batches} value={batch} onChange={setBatch} />
          </Field>
        </section>

        <section className="step" ref={ref(3)}>
          <div className="step-head">
            <span className="eyebrow">Item {itemNo} · Check</span>
            <h2>Check and add</h2>
          </div>
          <dl className="receipt">
            <div className="receipt-row"><dt>Item</dt><dd>{product.name}</dd></div>
            <div className="receipt-row"><dt>Size</dt><dd>{finalSize || 'Not picked yet'}</dd></div>
            <div className="receipt-row"><dt>Name on back</dt><dd>{noName ? 'No name' : name.trim() || 'Not filled in yet'}</dd></div>
            <div className="receipt-row"><dt>Batch on back</dt><dd>{batch}</dd></div>
            <div className="receipt-row receipt-total"><dt>Price</dt><dd>{inr(product.price_inr)}</dd></div>
          </dl>
          <div className="actions">
            <button type="button" className="btn primary" onClick={add} disabled={full}>{full ? `Order is full (${cap})` : 'Add to order'}</button>
          </div>
        </section>

        <section className="step step-order" ref={ref(4)}>
          <div className="step-head">
            <span className="eyebrow">Your order</span>
            <h2>{cart.length ? `${cart.length} item${cart.length === 1 ? '' : 's'} · ${inr(cart.reduce((s, c) => s + (form.products.find((p) => p.id === c.product_id)?.price_inr ?? 0), 0))}` : 'Nothing added yet'}</h2>
          </div>
          {cart.length > 0 && <CartList form={form} cart={cart} onRemove={(k) => setCart((cs) => cs.filter((c) => c.key !== k))} />}
          <div className="actions">
            {!full && <button type="button" className="btn" onClick={() => goTo('colour')}>{cart.length ? 'Add another item' : 'Pick an item'}</button>}
            <button type="button" className="btn primary" onClick={onNext} disabled={!cart.length}>Next: payment</button>
          </div>
          <button type="button" className="link small" onClick={onBack}>← Back to your details</button>
        </section>
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
        <p className="muted">MART hasn't put up a payment QR yet. Your order so far is kept in this browser, so you can come back to it in a little while.</p>
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
      <p className="note">Pay exactly {inr(total)} to this QR, then come back to this page. Your order so far is kept in this browser, so switching to your UPI app won't lose it. On a laptop? Scan the QR with your phone.</p>

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
