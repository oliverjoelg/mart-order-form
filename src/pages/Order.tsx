import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import ShirtStage, { type ShirtView } from '../components/ShirtStage'
import { Choice, Dock, Field, Sheet, useApi, useFileUrl, useToast } from '../components/ui'
import type { AuthUser } from '../lib/api'
import { friendlyError } from '../lib/api'
import { swatch } from '../lib/colours'
import { compressImage } from '../lib/image'
import {
  batchNumeral, detailsReady, draftKey, firstBadLine, itemCap, lineErrors, lineToCart, linesTotal, newLine, pickProduct, priceOf, restoreDraft,
  type Draft, type Line, type Step,
} from '../lib/order'
import type { OrderForm, StudentDetails, SubmitResult } from '../lib/types'
import { cleanPrintName, customSizeError, detailsErrors, inr, normalisePhone, normaliseRoll, normaliseTxn, txnError } from '../lib/validate'

const STEPS: { key: Step; label: string }[] = [
  { key: 'details', label: 'Your details' },
  { key: 'items', label: 'Pick your items' },
  { key: 'payment', label: 'Pay' },
  { key: 'review', label: 'Check and submit' },
]

function readDraft(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function useWide(min = 960) {
  const q = `(min-width: ${min}px)`
  const [wide, setWide] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const m = window.matchMedia(q)
    const on = () => setWide(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [q])
  return wide
}

/** "Classic MDI Navy Blue" -> "Classic MDI" (the colour is shown separately) */
const lineName = (p: { name: string; colour: string }) => p.name.replace(p.colour, '').trim() || p.name

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`

export default function Order({ form, user, onDone }: { form: OrderForm; user: AuthUser; onDone(r: SubmitResult, batch: string): void }) {
  const round = form.round!
  const api = useApi()
  const toast = useToast()
  const key = draftKey(user.id, round.campaign_id)
  // The draft survives a reload: on phones the tab is often killed while the student pays in
  // their UPI app. Kept in this browser only, per account and round, cleared after submitting.
  const [draft, setDraft] = useState<Draft>(() => restoreDraft(readDraft(key), form))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(draft))
    } catch {
      /* private mode: no draft, still works */
    }
  }, [key, draft])

  const { step, details, lines } = draft
  const total = linesTotal(form, lines)

  const go = (s: Step) => {
    setError(null)
    setTouched(false)
    setDraft((d) => ({ ...d, step: s }))
    window.scrollTo({ top: 0 })
  }

  async function submit() {
    if (!form.qr || !draft.shot) return
    setBusy(true)
    setError(null)
    try {
      const r = await api.submitOrder({
        campaignId: round.campaign_id,
        details: { ...details, phone: normalisePhone(details.phone), roll_no: normaliseRoll(details.roll_no), name: details.name.trim() },
        items: lines.map(lineToCart),
        payment: { qr_id: form.qr.id, txn_id: normaliseTxn(draft.txn), screenshot_path: draft.shot },
      })
      try {
        localStorage.removeItem(key)
      } catch {
        /* ignore */
      }
      onDone(r, lines[0]?.batch ?? '')
    } catch (e) {
      setError(friendlyError(e))
      toast('Not submitted. The reason is above the button.')
    } finally {
      setBusy(false)
    }
  }

  const idx = STEPS.findIndex((s) => s.key === step)

  return (
    <div className={`order step-${step}`}>
      <ol className="progress" aria-label="Order steps">
        {STEPS.map((s, i) => (
          <li key={s.key} aria-current={i === idx ? 'step' : undefined} className={i < idx ? 'done' : ''}>
            <span className="sr-only">{i < idx ? 'Done: ' : ''}{s.label}</span>
          </li>
        ))}
      </ol>
      <p className="progress-label" aria-hidden="true"><b>{STEPS[idx]?.label}</b> <span>{idx + 1} of 4</span></p>

      <div className="step-body" key={step}>
        {step === 'details' && (
          <DetailsStep form={form} details={details} touched={touched}
            setDetails={(fn) => setDraft((d) => ({ ...d, details: fn(d.details) }))}
            onNext={() => {
              setTouched(true)
              if (detailsReady(details, round)) go('items')
              else toast('Fill in the fields marked in red.')
            }} />
        )}

        {step === 'items' && (
          <ItemsStep form={form} draft={draft} setDraft={setDraft} total={total} onEditDetails={() => go('details')} onPay={() => go('payment')} />
        )}

        {step === 'payment' && (
          <PaymentStep form={form} user={user} total={total} count={lines.length} txn={draft.txn} shot={draft.shot} touched={touched}
            setTxn={(t) => setDraft((d) => ({ ...d, txn: t }))}
            setShot={(s) => setDraft((d) => ({ ...d, shot: s }))}
            onBack={() => go('items')}
            onNext={() => {
              setTouched(true)
              if (!txnError(draft.txn) && draft.shot) go('review')
              else toast(txnError(draft.txn) ?? 'Add the screenshot of your payment.')
            }} />
        )}

        {step === 'review' && (
          <section className="review">
            <header className="step-head">
              <h1>Check, then submit.</h1>
              <p className="lede">After you submit you can't change or cancel the order. Check sizes and names now.</p>
            </header>
            <div className="tag receipt">
              <span className="tag-hole" aria-hidden="true" />
              <dl className="kv">
                <div><dt>Name</dt><dd>{details.name.trim()}</dd></div>
                <div><dt>Roll no.</dt><dd>{normaliseRoll(details.roll_no)}</dd></div>
                <div><dt>Phone</dt><dd>{normalisePhone(details.phone)}</dd></div>
                <div><dt>Batch, course, section</dt><dd>{details.batch} · {details.course} · {details.section}</dd></div>
                <div><dt>Email</dt><dd>{form.email}</dd></div>
              </dl>
              <hr className="perf" />
              <LineList form={form} lines={lines} />
              <hr className="perf" />
              <dl className="kv">
                <div><dt>Paid to</dt><dd>{form.qr?.payee_name ?? '—'}</dd></div>
                <div><dt>Transaction ID</dt><dd className="mono">{normaliseTxn(draft.txn)}</dd></div>
                <div className="kv-total"><dt>Total</dt><dd>{inr(total)}</dd></div>
              </dl>
            </div>
            <p className="fineprint">Something wrong? Go back and fix it: your payment details stay filled in.</p>
            {error && <p className="error" role="alert">{error}</p>}
            <Dock>
              <button type="button" className="btn ghost" onClick={() => go('payment')} disabled={busy}>Back</button>
              <button type="button" className="btn primary grow" onClick={submit} disabled={busy}>
                {busy ? 'Submitting…' : `Submit order · ${inr(total)}`}
              </button>
            </Dock>
          </section>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
function DetailsStep({ form, details, setDetails, touched, onNext }: {
  form: OrderForm; details: StudentDetails; setDetails(fn: (d: StudentDetails) => StudentDetails): void; touched: boolean; onNext(): void
}) {
  const api = useApi()
  const round = form.round!
  const errs = touched ? detailsErrors(details, round) : {}
  const set = (k: keyof StudentDetails) => (v: string) => setDetails((d) => ({ ...d, [k]: v }))
  return (
    <section className="details">
      <header className="step-head">
        {round.team_only && <span className="badge ok">MART team round: only team members can order</span>}
        <h1>{round.title}</h1>
        {round.intro && <p className="lede">{round.intro}</p>}
      </header>
      <p className="signed">Signed in as <b>{form.email}</b> <button type="button" className="link" onClick={() => void api.signOut()}>Sign out</button></p>
      <div className="form-grid">
        <Field label="Full name" error={errs.name}>
          {(a) => <input {...a} className="input" autoComplete="name" value={details.name} onChange={(e) => set('name')(e.target.value)} />}
        </Field>
        <Field label="Roll number" error={errs.roll_no}>
          {(a) => <input {...a} className="input upper" autoCapitalize="characters" spellCheck={false} value={details.roll_no} onChange={(e) => set('roll_no')(e.target.value)} />}
        </Field>
        <Field label="Mobile number" error={errs.phone} hint="MART calls this number when your order is ready.">
          {(a) => <input {...a} className="input" type="tel" inputMode="tel" autoComplete="tel" value={details.phone} onChange={(e) => set('phone')(e.target.value)} />}
        </Field>
        <Choice legend="Batch" options={round.student_batches} value={details.batch} onChange={set('batch')} error={errs.batch} variant="seg" />
        <Choice legend="Course" options={round.courses} value={details.course} onChange={set('course')} error={errs.course} />
        <Choice legend="Section" options={round.sections} value={details.section} onChange={set('section')} error={errs.section} />
      </div>
      <Dock>
        <button type="button" className="btn primary grow" onClick={onNext}>Next: pick your items</button>
      </Dock>
    </section>
  )
}

// ---------------------------------------------------------------------------
function ItemsStep({ form, draft, setDraft, total, onEditDetails, onPay }: {
  form: OrderForm; draft: Draft; setDraft: Dispatch<SetStateAction<Draft>>; total: number; onEditDetails(): void; onPay(): void
}) {
  const round = form.round!
  const toast = useToast()
  const wide = useWide()
  const cap = itemCap(round)
  const { lines, details } = draft
  const cur = Math.min(draft.cur, lines.length - 1)
  const line = lines[cur]
  const product = line && form.products.find((p) => p.id === line.product_id)
  const [view, setView] = useState<ShirtView>('back')
  const [shown, setShown] = useState<Set<string>>(() => new Set())
  const [sheet, setSheet] = useState<'size' | 'photo' | null>(null)
  const card = useRef<HTMLDivElement>(null)
  const bag = useRef<HTMLUListElement>(null)
  const photo = useFileUrl('form-assets', product?.photo_paths[0])
  // keep the item being edited visible in the scrolling strip of items
  useEffect(() => {
    const el = bag.current?.querySelector<HTMLElement>('li.on')
    const strip = bag.current
    if (el && strip) strip.scrollTo({ left: el.offsetLeft - 8, behavior: 'smooth' })
  }, [cur, lines.length])
  const errs = line && shown.has(line.key) ? lineErrors(line, form) : {}
  const full = lines.length >= cap

  if (!form.products.length || !line) {
    return (
      <section className="empty">
        <h1>Nothing on sale yet.</h1>
        <p className="lede">MART hasn't put any items on this round. Check back soon or watch the MART group.</p>
      </section>
    )
  }

  const edit = (fn: (l: Line) => Line) => setDraft((d) => ({ ...d, lines: d.lines.map((l) => (l.key === line.key ? fn(l) : l)) }))
  const select = (i: number) => {
    setDraft((d) => ({ ...d, cur: i }))
    if (!wide) card.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }
  const showErrors = (l: Line) => {
    setShown((s) => new Set(s).add(l.key))
    // a missing back name is the usual reason: put the cursor there
    if (lineErrors(l, form).name) requestAnimationFrame(() => document.querySelector<HTMLInputElement>('.input.print')?.focus())
  }

  const add = () => {
    if (full) return toast(`That's the most for one order (${cap}).`)
    if (Object.keys(lineErrors(line, form)).length) {
      showErrors(line)
      return toast(`Finish item ${cur + 1} first.`)
    }
    setDraft((d) => ({ ...d, lines: [...d.lines, newLine(form, line)], cur: d.lines.length }))
    toast(`Item ${lines.length + 1} added, same size and name. Change anything you like.`)
    setView('back')
  }
  const remove = (k: string) => {
    setDraft((d) => {
      const at = d.lines.findIndex((l) => l.key === k)
      const next = d.lines.filter((l) => l.key !== k)
      return { ...d, lines: next, cur: Math.max(0, Math.min(d.cur > at ? d.cur - 1 : d.cur, next.length - 1)) }
    })
    toast('Item removed.')
  }
  const pay = () => {
    const bad = firstBadLine(lines, form)
    if (bad === -1) return onPay()
    select(bad)
    showErrors(lines[bad]!)
    toast(`Item ${bad + 1}: ${Object.values(lineErrors(lines[bad]!, form))[0]}`)
  }

  const numeral = batchNumeral(line.batch)
  const sw = swatch(product?.colour ?? '')
  const stage = (
    <div className="stage-box" style={{ ['--shirt' as string]: sw.base }}>
      {numeral && <span className="numeral" aria-hidden="true" key={numeral}>{numeral}</span>}
      <ShirtStage compact={!wide} colour={product?.colour ?? ''} printName={line.no_name ? '' : line.name.trim()} printBatch={line.batch}
        view={view} onFlip={() => setView((v) => (v === 'front' ? 'back' : 'front'))} />
    </div>
  )

  return (
    <section className="items" aria-label="Pick your items">
      <div className="who">
        <span className="who-text"><b>{details.name.trim()}</b> · {normaliseRoll(details.roll_no)} · {details.course} {details.section}</span>
        <button type="button" className="link" onClick={onEditDetails}>Edit</button>
      </div>

      <ul className="bag" ref={bag} aria-label="Items in this order">
        {lines.map((l, i) => {
          const p = form.products.find((x) => x.id === l.product_id)
          return (
            <li key={l.key} className={i === cur ? 'on' : ''}>
              <button type="button" className="bag-item" aria-current={i === cur ? 'true' : undefined} onClick={() => select(i)}>
                <i className="dot" style={{ background: swatch(p?.colour ?? '').base }} />
                <span>{i + 1}. {p?.colour ?? 'Item'} · {l.custom ? 'custom' : l.size}{!l.no_name && l.name.trim() ? ` · ${l.name.trim()}` : ''}</span>
              </button>
              {lines.length > 1 && <button type="button" className="bag-x" aria-label={`Remove item ${i + 1}`} onClick={() => remove(l.key)}>×</button>}
            </li>
          )
        })}
        {!full && <li><button type="button" className="bag-add" onClick={add}>+ Add item</button></li>}
      </ul>

      <div className="item-card" ref={card}>
        <div className="item-top">
          {stage}
          <div className="pick">
            <p className="item-no">Item {cur + 1} of up to {cap}</p>
            <h2>{product?.colour ?? 'Pick a colour'}</h2>
            <p className="pick-line">{product ? `${lineName(product)} · ${inr(product.price_inr)}` : ''}</p>
            <Choice legend="Colour" hideLegend variant="swatches" options={form.products.map((p) => p.id)} value={product?.id ?? ''} error={errs.product}
              onChange={(id) => {
                const p = form.products.find((x) => x.id === id)!
                const r = pickProduct(line, p)
                edit(() => r.line)
                if (r.note) toast(r.note)
              }}
              render={(id) => {
                const p = form.products.find((x) => x.id === id)!
                return <><i className="swatch" style={{ background: swatch(p.colour).base }} /><span className="sr-only">{p.colour}, {p.name}, {inr(p.price_inr)}</span></>
              }} />
            {(product?.description || photo) && (
              <p className="pick-desc">
                {product?.description}{' '}
                {photo && <button type="button" className="link" onClick={() => setSheet('photo')}>See photo</button>}
              </p>
            )}
          </div>
        </div>

        <div className="item-opts">
          <Choice legend="Size" variant="sizes" options={product?.sizes ?? []} value={line.custom ? '' : line.size} error={line.custom ? null : errs.size}
            onChange={(s) => edit((l) => ({ ...l, size: s, custom: false }))}
            aside={
              <span className="links">
                {product?.allow_custom_size && !line.custom && (
                  <button type="button" className="link small" onClick={() => edit((l) => ({ ...l, custom: true }))}>Not listed?</button>
                )}
                <button type="button" className="link small" onClick={() => setSheet('size')}>Size help</button>
              </span>
            } />
          {product?.allow_custom_size && line.custom && (
            <Field label="Your size" error={errs.size ?? (line.custom_size ? customSizeError(line.custom_size) : null)} hint="e.g. Chest 38 / Length 28"
              aside={<button type="button" className="link small" onClick={() => edit((l) => ({ ...l, custom: false }))}>Use the list</button>}>
              {(a) => <input {...a} className="input" value={line.custom_size} maxLength={40} autoFocus onChange={(e) => { const v = e.target.value; edit((l) => ({ ...l, custom_size: v })) }} />}
            </Field>
          )}

          <Field label="Name on the back" error={errs.name}
            hint={line.no_name ? 'Only the batch will be printed.' : `Letters, spaces, . ' and - · up to ${round.name_max}`}
            aside={
              <label className="switch">
                <input type="checkbox" checked={line.no_name} onChange={(e) => { const on = e.target.checked; edit((l) => ({ ...l, no_name: on })); setView('back') }} />
                <span>No name</span>
              </label>
            }>
            {(a) => (
              <div className="print-wrap">
                <input {...a} className="input print" autoComplete="off" autoCapitalize="characters" spellCheck={false} enterKeyHint="done"
                  placeholder={line.no_name ? 'NO NAME' : 'YOUR NAME'} value={line.no_name ? '' : line.name} disabled={line.no_name}
                  onFocus={() => setView('back')}
                  onChange={(e) => { const v = cleanPrintName(e.target.value, round.name_max); edit((l) => ({ ...l, name: v })) }} />
                {!line.no_name && <span className="counter" aria-hidden="true">{line.name.length}/{round.name_max}</span>}
              </div>
            )}
          </Field>

          <Choice legend="Batch on the back" variant="seg" options={round.print_batches} value={line.batch} error={errs.batch}
            onChange={(b) => { edit((l) => ({ ...l, batch: b })); setView('back') }} />
        </div>
      </div>

      <aside className="rail" aria-label="Your order">
        <h2>Your order</h2>
        <LineList form={form} lines={lines} cur={cur} onPick={select} onRemove={lines.length > 1 ? remove : undefined} />
        {!full ? <button type="button" className="btn ghost" onClick={add}>+ Add another item</button> : <p className="fineprint">That's the most for one order ({cap}).</p>}
        <div className="rail-total"><span>{plural(lines.length, 'item')}</span><b>{inr(total)}</b></div>
        <button type="button" className="btn primary" onClick={pay}>Pay {inr(total)}</button>
        <p className="fineprint">Saved in this browser as you go.</p>
      </aside>

      <Dock className="items-dock">
        <div className="tot"><span>{plural(lines.length, 'item')}</span><b>{inr(total)}</b></div>
        {!full && <button type="button" className="btn ghost" onClick={add}>+ Add</button>}
        <button type="button" className="btn primary" onClick={pay}>Pay</button>
      </Dock>

      <Sheet open={sheet === 'size'} onClose={() => setSheet(null)} title="Size help">
        <p>Polos run true to size. If you're between two sizes, pick the bigger one.</p>
        <p className="fineprint">The vendor's chart (chest and length in inches) goes here once MART has the numbers.</p>
        {product?.allow_custom_size && <p>Need something else? Close this and tap <b>My size isn't listed</b> to type your measurements.</p>}
      </Sheet>
      <Sheet open={sheet === 'photo'} onClose={() => setSheet(null)} title={product?.name ?? 'Photo'}>
        {photo && <img className="sheet-photo" src={photo} alt={product?.name ?? ''} />}
        {product?.description && <p>{product.description}</p>}
      </Sheet>
    </section>
  )
}

function LineList({ form, lines, cur, onPick, onRemove }: { form: OrderForm; lines: Line[]; cur?: number; onPick?(i: number): void; onRemove?(key: string): void }) {
  return (
    <ul className="lines">
      {lines.map((l, i) => {
        const p = form.products.find((x) => x.id === l.product_id)
        const c = lineToCart(l)
        const body = (
          <>
            <i className="dot" style={{ background: swatch(p?.colour ?? '').base }} />
            <span className="line-text">
              <b>{p?.colour ?? 'Item'} · <span className="print-face">{c.size}</span></b>
              <small>{c.print_name ? <span className="print-face">{c.print_name}</span> : 'No name'} · {c.print_batch}{p ? ` · ${lineName(p)}` : ''}</small>
            </span>
            <span className="price">{inr(priceOf(form, l))}</span>
          </>
        )
        return (
          <li key={l.key} className={cur === i ? 'on' : ''}>
            {onPick ? <button type="button" className="line-btn" aria-current={cur === i ? 'true' : undefined} onClick={() => onPick(i)}>{body}</button> : <div className="line-btn">{body}</div>}
            {onRemove && <button type="button" className="bag-x" aria-label={`Remove item ${i + 1}`} onClick={() => onRemove(l.key)}>×</button>}
          </li>
        )
      })}
    </ul>
  )
}

// ---------------------------------------------------------------------------
function PaymentStep({ form, user, total, count, txn, setTxn, shot, setShot, onBack, onNext, touched }: {
  form: OrderForm; user: AuthUser; total: number; count: number; txn: string; setTxn(t: string): void; shot: string | null; setShot(p: string | null): void
  onBack(): void; onNext(): void; touched: boolean
}) {
  const api = useApi()
  const toast = useToast()
  const qrUrl = useFileUrl('form-assets', form.qr?.image_path)
  const shotUrl = useFileUrl('payment-screenshots', shot)
  const [uploading, setUploading] = useState(false)
  const tErr = touched ? txnError(txn) : null
  const mobile = useMemo(() => /Android|iPhone|iPad/i.test(navigator.userAgent), [])

  if (!form.qr) {
    return (
      <section className="empty">
        <h1>Payment isn't open yet.</h1>
        <p className="lede">MART hasn't put up a payment QR. Your items are saved in this browser, so come back in a little while and carry on.</p>
        <Dock><button type="button" className="btn ghost grow" onClick={onBack}>Back to items</button></Dock>
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
      toast('Screenshot added.')
    } catch (e) {
      toast(friendlyError(e))
    } finally {
      setUploading(false)
    }
  }

  return (
    <section className="payment">
      <header className="step-head">
        <h1 className="amount-head"><span>Pay</span> {inr(total)}</h1>
        <p className="lede">{plural(count, 'item')}. Scan with any UPI app, or save the QR and open it from your gallery.</p>
      </header>

      <div className="pay-grid">
        <div className="ticket">
          <div className="qr">{qrUrl ? <img src={qrUrl} alt={`UPI QR code for ${q.payee_name}`} width={240} height={240} /> : <div className="qr-ph" aria-label="Loading the QR" />}</div>
          <div className="ticket-meta">
            <span className="fineprint">Paying</span>
            <b>{q.payee_name}</b>
            {q.upi_id && (
              <button type="button" className="link" onClick={() => navigator.clipboard?.writeText(q.upi_id!).then(() => toast('UPI ID copied'), () => toast(q.upi_id!))}>
                {q.upi_id} <span className="copy">Copy</span>
              </button>
            )}
            <span className="ticket-amount">{inr(total)}</span>
          </div>
          {upiLink && mobile && <a className="btn primary" href={upiLink}>Open my UPI app</a>}
        </div>

        <div className="pay-fields">
          <p className="note">Pay exactly <b>{inr(total)}</b>. Your order is saved in this browser while you're in your UPI app, so come back here after paying.</p>
          <Field label="UPI transaction ID (UTR)" error={tErr} hint="12 digits in GPay, PhonePe or Paytm, under the payment details.">
            {(a) => <input {...a} className="input mono" inputMode="text" autoCapitalize="characters" spellCheck={false} autoComplete="off" value={txn} onChange={(e) => setTxn(e.target.value)} />}
          </Field>
          <div className="field">
            <div className="field-top"><span className="label">Payment screenshot</span></div>
            <label className={`drop ${uploading ? 'busy' : ''} ${shotUrl ? 'has' : ''} ${touched && !shot ? 'bad' : ''}`}>
              <input type="file" accept="image/*" onChange={(e) => void pick(e.target.files?.[0])} disabled={uploading} aria-describedby="shot-msg" />
              {shotUrl && <img src={shotUrl} alt="Your payment screenshot" />}
              <span className="drop-text">{uploading ? 'Shrinking and uploading…' : shot ? 'Change screenshot' : 'Add the screenshot'}</span>
            </label>
            {touched && !shot ? <span id="shot-msg" className="hint bad" role="alert">Add the screenshot of your payment</span> : <span id="shot-msg" className="hint">It's shrunk before upload, so it's quick on mobile data.</span>}
          </div>
        </div>
      </div>

      <Dock>
        <button type="button" className="btn ghost" onClick={onBack}>Back</button>
        <button type="button" className="btn primary grow" onClick={onNext} disabled={uploading}>Check order</button>
      </Dock>
    </section>
  )
}
