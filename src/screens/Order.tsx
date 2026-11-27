import { useEffect, useMemo, useState } from 'react'
import { Choice, Field, useApi, useFileUrl, useToast } from '../components/ui'
import type { AuthUser } from '../lib/api'
import { friendlyError } from '../lib/api'
import { compressImage } from '../lib/image'
import { checkoutErrors, draftKey, fitToForm, lineToCart, linesTotal, restoreDraft, type Draft, type Line } from '../lib/order'
import type { OrderForm, StudentDetails, SubmitResult } from '../lib/types'
import { detailsErrors, inr, normalisePhone, normaliseRoll, normaliseTxn, txnError } from '../lib/validate'
import BagList from './BagList'
import Customiser from './Customiser'

function readDraft(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const atCheckout = () => window.location.hash.replace(/^#\/?/, '') === 'checkout'

/** Owns the draft (kept in this browser) and switches between the customiser and the checkout. */
export default function Order({ form, user, onDone }: { form: OrderForm; user: AuthUser; onDone(r: SubmitResult, first: Line | undefined): void }) {
  const round = form.round!
  const key = draftKey(user.id, round.campaign_id)
  // The draft survives a reload: on phones the tab is often killed while the student pays in
  // their UPI app. Kept in this browser only, per account and round, cleared after submitting.
  const [draft, setDraft] = useState<Draft>(() => restoreDraft(readDraft(key), form))

  // the products on sale can change while the form is open: keep the items pointing at real ones
  useEffect(() => setDraft((d) => fitToForm(d, form)), [form])
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(draft))
    } catch {
      /* private mode: no draft, still works */
    }
  }, [key, draft])

  // the browser's Back button leaves the checkout for the customiser
  useEffect(() => {
    if (draft.step === 'checkout' && !atCheckout()) window.history.pushState(null, '', '#/checkout')
    const on = () => !atCheckout() && setDraft((d) => (d.step === 'checkout' ? { ...d, step: 'customise' } : d))
    window.addEventListener('popstate', on)
    return () => window.removeEventListener('popstate', on)
  }, [draft.step])

  const go = (step: Draft['step']) => {
    if (step === 'customise' && atCheckout()) window.history.back()
    setDraft((d) => ({ ...d, step }))
    window.scrollTo(0, 0)
  }

  return draft.step === 'checkout' && draft.bag.length ? (
    <Checkout form={form} user={user} draft={draft} setDraft={setDraft} onBack={() => go('customise')}
      onDone={(r) => {
        try {
          localStorage.removeItem(key)
        } catch {
          /* ignore */
        }
        if (atCheckout()) window.history.replaceState(null, '', '#/')
        onDone(r, draft.bag[0])
      }} />
  ) : (
    <Customiser form={form} draft={draft} setDraft={setDraft} onCheckout={() => go('checkout')} />
  )
}

// ---------------------------------------------------------------------------
function Checkout({ form, user, draft, setDraft, onBack, onDone }: {
  form: OrderForm; user: AuthUser; draft: Draft; setDraft(fn: (d: Draft) => Draft): void; onBack(): void; onDone(r: SubmitResult): void
}) {
  const api = useApi()
  const toast = useToast()
  const round = form.round!
  const { details, bag } = draft
  const total = linesTotal(form, bag)
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const qrUrl = useFileUrl('form-assets', form.qr?.image_path)
  const shotUrl = useFileUrl('payment-screenshots', draft.shot)
  const mobile = useMemo(() => /Android|iPhone|iPad/i.test(navigator.userAgent), [])
  const dErr = touched ? detailsErrors(details, round) : {}
  const tErr = touched ? txnError(draft.txn) : null
  const missing = checkoutErrors(draft, form)
  const set = (k: keyof StudentDetails) => (v: string) => setDraft((d) => ({ ...d, details: { ...d.details, [k]: v } }))

  async function pick(file: File | undefined) {
    if (!file) return
    setUploading(true)
    try {
      const small = await compressImage(file)
      const path = await api.uploadScreenshot(user.id, small)
      setDraft((d) => ({ ...d, shot: path }))
      toast('Screenshot added.')
    } catch (e) {
      toast(friendlyError(e))
    } finally {
      setUploading(false)
    }
  }

  async function submit() {
    setTouched(true)
    if (missing.length || !form.qr || !draft.shot) return toast(missing[0] ?? 'Something is missing.')
    setBusy(true)
    setError(null)
    try {
      const r = await api.submitOrder({
        campaignId: round.campaign_id,
        details: { ...details, phone: normalisePhone(details.phone), roll_no: normaliseRoll(details.roll_no), name: details.name.trim() },
        items: bag.map(lineToCart),
        payment: { qr_id: form.qr.id, txn_id: normaliseTxn(draft.txn), screenshot_path: draft.shot },
      })
      onDone(r)
    } catch (e) {
      setError(friendlyError(e))
      toast('Not submitted. The reason is next to the button.')
    } finally {
      setBusy(false)
    }
  }

  const q = form.qr
  const upiLink = q?.upi_id
    ? `upi://pay?pa=${encodeURIComponent(q.upi_id)}&pn=${encodeURIComponent(q.payee_name)}&am=${total}&cu=INR&tn=${encodeURIComponent('MART order')}`
    : null

  return (
    <div className="co">
      <header className="co-head">
        <button type="button" className="link back" onClick={onBack}>← Back to the {bag.length > 1 ? 'bag' : 'customiser'}</button>
        <h1 className="co-title">Checkout</h1>
        <p className="lede">{bag.length} {bag.length === 1 ? 'item' : 'items'} · {inr(total)}. Fill this in from top to bottom, then submit.</p>
      </header>

      <div className="co-main">
        <section className="co-card" aria-labelledby="co-you">
          <h2 id="co-you"><span className="co-n">1</span> Your details</h2>
          <p className="fineprint">Signed in as <b>{form.email}</b> · <button type="button" className="link" onClick={() => void api.signOut()}>Sign out</button></p>
          {round.team_only && <p className="badge ok">MART team round: only team members can order</p>}
          <div className="form-grid">
            <Field label="Full name" error={dErr.name}>
              {(a) => <input {...a} className="input" autoComplete="name" value={details.name} onChange={(e) => set('name')(e.target.value)} />}
            </Field>
            <Field label="Roll number" error={dErr.roll_no}>
              {(a) => <input {...a} className="input upper" autoCapitalize="characters" spellCheck={false} value={details.roll_no} onChange={(e) => set('roll_no')(e.target.value)} />}
            </Field>
            <Field label="Mobile number" error={dErr.phone} hint="MART calls this number when your order is ready.">
              {(a) => <input {...a} className="input" type="tel" inputMode="tel" autoComplete="tel" value={details.phone} onChange={(e) => set('phone')(e.target.value)} />}
            </Field>
            <Choice legend="Batch" options={round.student_batches} value={details.batch} onChange={set('batch')} error={dErr.batch} variant="seg" />
            <Choice legend="Course" options={round.courses} value={details.course} onChange={set('course')} error={dErr.course} />
            <Choice legend="Section" options={round.sections} value={details.section} onChange={set('section')} error={dErr.section} />
          </div>
        </section>

        <section className="co-card" aria-labelledby="co-pay">
          <h2 id="co-pay"><span className="co-n">2</span> Pay {inr(total)}</h2>
          {!q ? (
            <p className="lede">MART hasn't put up a payment QR yet. Your bag is saved in this browser, so come back in a little while and carry on.</p>
          ) : (
            <div className="co-pay">
              <div className="qr">{qrUrl ? <img src={qrUrl} alt={`UPI QR code for ${q.payee_name}`} width={220} height={220} /> : <div className="qr-ph" aria-label="Loading the QR" />}</div>
              <div className="co-pay-meta">
                <span className="fineprint">Paying</span>
                <b>{q.payee_name}</b>
                {q.upi_id && (
                  <button type="button" className="link" onClick={() => navigator.clipboard?.writeText(q.upi_id!).then(() => toast('UPI ID copied'), () => toast(q.upi_id!))}>
                    {q.upi_id} <span className="copy">Copy</span>
                  </button>
                )}
                <span className="co-amount">{inr(total)}</span>
                {upiLink && mobile && <a className="btn primary" href={upiLink}>Open my UPI app</a>}
                <p className="fineprint">Pay exactly {inr(total)}. Scan with any UPI app, or save the QR and open it from your gallery. Your bag stays saved in this browser while you're in your UPI app.</p>
              </div>
            </div>
          )}
        </section>

        <section className="co-card" aria-labelledby="co-proof">
          <h2 id="co-proof"><span className="co-n">3</span> Proof of payment</h2>
          <Field label="UPI transaction ID (UTR)" error={tErr} hint="12 digits in GPay, PhonePe or Paytm, under the payment details.">
            {(a) => <input {...a} className="input mono" inputMode="text" autoCapitalize="characters" spellCheck={false} autoComplete="off" value={draft.txn} onChange={(e) => { const v = e.target.value; setDraft((d) => ({ ...d, txn: v })) }} />}
          </Field>
          <div className="field">
            <div className="field-top"><span className="label">Payment screenshot</span></div>
            <label className={`drop ${uploading ? 'busy' : ''} ${shotUrl ? 'has' : ''} ${touched && !draft.shot ? 'bad' : ''}`}>
              <input type="file" accept="image/*" onChange={(e) => void pick(e.target.files?.[0])} disabled={uploading} aria-describedby="shot-msg" />
              {shotUrl && <img src={shotUrl} alt="Your payment screenshot" />}
              <span className="drop-text">{uploading ? 'Shrinking and uploading…' : draft.shot ? 'Change screenshot' : 'Add the screenshot'}</span>
            </label>
            {touched && !draft.shot ? <span id="shot-msg" className="hint bad" role="alert">Add the screenshot of your payment</span> : <span id="shot-msg" className="hint">It's shrunk before upload, so it's quick on mobile data.</span>}
          </div>
        </section>
      </div>

      <aside className="co-side" aria-labelledby="co-sum">
        <div className="co-card co-sum">
          <h2 id="co-sum">Your order</h2>
          <BagList form={form} lines={bag} />
          <button type="button" className="link small" onClick={onBack}>Change items</button>
          <div className="bag-total"><span>Total</span><b>{inr(total)}</b></div>
          <p className="co-warn">After you submit you can't change or cancel the order. Check sizes and names now.</p>
          {touched && missing.length > 0 && (
            <ul className="co-missing" role="alert">{missing.map((m) => <li key={m}>{m}</li>)}</ul>
          )}
          {error && <p className="error" role="alert">{error}</p>}
          <button type="button" className="btn primary go" onClick={() => void submit()} disabled={busy || uploading} aria-describedby="co-left">
            <span>{busy ? 'Submitting…' : 'Submit order'}</span><b>{inr(total)}</b>
          </button>
          <p id="co-left" className="fineprint">{missing.length ? `${missing.length} thing${missing.length === 1 ? '' : 's'} left to fill in.` : 'All set.'}</p>
        </div>
      </aside>
    </div>
  )
}
