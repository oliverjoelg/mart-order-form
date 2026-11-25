// Form admins (1-2 people, added by a MART super admin): open/close the form, products shown,
// prices, sizes, photos, and the live payment QR. Orders themselves are handled in MART Orders.
import { useCallback, useEffect, useState } from 'react'
import { Choice, Field, Spinner, useApi, useFileUrl, useToast } from '../components/ui'
import { friendlyError } from '../lib/api'
import { swatch } from '../lib/colours'
import { THEMES, THEME_IDS, resolveTheme, type ThemeId } from '../lib/theme'
import type { AdminProduct, AdminQr, AdminRound, AdminState } from '../lib/types'
import { inr } from '../lib/validate'

export default function Admin({ onLook }: { onLook(): void }) {
  const api = useApi()
  const toast = useToast()
  const [state, setState] = useState<AdminState | null>(null)
  const [isSuper, setIsSuper] = useState(false)
  useEffect(() => {
    api.admin.isSuper().then(setIsSuper, () => setIsSuper(false))
  }, [api])
  const [error, setError] = useState<string | null>(null)
  const [roundId, setRoundId] = useState<string>('')

  const load = useCallback(async () => {
    try {
      const s = await api.admin.state()
      setState(s)
      setRoundId((r) => r || s.rounds.find((x) => x.form?.is_open)?.campaign_id || s.rounds[0]?.campaign_id || '')
    } catch (e) {
      setError(friendlyError(e))
    }
  }, [api])
  useEffect(() => void load(), [load])

  const run = async (fn: () => Promise<unknown>, done: string) => {
    try {
      await fn()
      toast(done)
      await load()
    } catch (e) {
      toast(friendlyError(e))
    }
  }

  if (error) return <section className="admin"><div className="empty-box"><p className="error" role="alert">{error}</p><button type="button" className="btn ghost" onClick={() => { setError(null); void load() }}>Try again</button></div></section>
  if (!state) return <Spinner label="Loading settings…" />
  const round = state.rounds.find((r) => r.campaign_id === roundId)

  return (
    <section className="admin">
      <header className="step-head">
        <h1>Form settings</h1>
        <p className="lede">These change only what the form shows. Products, prices and sizes are set in MART Orders (Products page); the form reads them from there.</p>
      </header>

      <Field label="Sales round">
          {(a) => <select {...a} className="input" value={roundId} onChange={(e) => setRoundId(e.target.value)}>
          {state.rounds.map((r) => (
            <option key={r.campaign_id} value={r.campaign_id}>{r.name}{r.form?.is_open ? ' (open)' : ''}</option>
          ))}
        </select>}
        </Field>

      <div className="admin-grid">
        <div className="admin-col">
          <h2>Round</h2>
          {round && <RoundCard round={round} run={run} />}
          {round && <LookCard round={round} isSuper={isSuper} run={run} onLook={onLook} />}
          <h2>Payment QR</h2>
          <p className="note">One QR is live at a time. When a UPI limit is hit, add the next person's QR and make it live. Orders started on the old QR still go through for 2 hours.</p>
          {state.qrs.map((q) => <QrRow key={q.id} q={q} run={run} />)}
          {state.qrs.some((q) => q.active) && (
            <button type="button" className="btn ghost" onClick={() => void run(() => api.admin.setActiveQr(null), 'No QR is live now')}>Take the live QR down</button>
          )}
          <AddQr run={run} />
        </div>
        <div className="admin-col">
          <h2>Products</h2>
          {round && round.products.length === 0 && <p className="note">This round has no products yet. Add them in MART Orders → Products.</p>}
          {round?.products.map((p) => <ProductCard key={p.id} p={p} run={run} />)}
        </div>
      </div>
    </section>
  )
}

type Run = (fn: () => Promise<unknown>, done: string) => Promise<void>

/** The round's look on the order form. Only MART super admins can change it (the database checks too). */
function LookCard({ round, isSuper, run, onLook }: { round: AdminRound; isSuper: boolean; run: Run; onLook(): void }) {
  const api = useApi()
  const current = resolveTheme(round.form?.theme).id
  return (
    <div className="card stack look-card">
      <div className="row-between">
        <b>Look on the form</b>
        <span className="badge">{THEMES[current].label}</span>
      </div>
      {isSuper ? (
        <>
          <Choice<ThemeId> legend="Theme" hideLegend variant="seg" options={THEME_IDS} value={current}
            render={(id) => THEMES[id].label}
            onChange={(id) => void run(async () => {
              await api.admin.setTheme(round.campaign_id, id)
              onLook()
            }, `The form now uses ${THEMES[id].label}`)} />
          <p className="note">Changes colours, words and the garment drawing for everyone ordering in this round, straight away. Only MART super admins see this.</p>
        </>
      ) : (
        <p className="note">Set by MART super admins.</p>
      )}
    </div>
  )
}

function RoundCard({ round, run }: { round: AdminRound; run: Run }) {
  const api = useApi()
  const f = round.form
  const [title, setTitle] = useState(f?.title ?? '')
  const [intro, setIntro] = useState(f?.intro ?? '')
  const [cap, setCap] = useState(f?.item_cap ?? 6)
  const [nameMax, setNameMax] = useState(f?.name_max ?? 12)
  const [teamOnly, setTeamOnly] = useState(f?.team_only ?? false)
  useEffect(() => {
    setTeamOnly(round.form?.team_only ?? false)
    setTitle(round.form?.title ?? '')
    setIntro(round.form?.intro ?? '')
    setCap(round.form?.item_cap ?? 6)
    setNameMax(round.form?.name_max ?? 12)
  }, [round])
  const open = !!f?.is_open
  return (
    <div className="card stack">
      <div className="row-between">
        <div>
          <b>{round.name}</b>
          <div className="fineprint">{round.orders} order{round.orders === 1 ? '' : 's'} from the form</div>
        </div>
        <span className={open ? 'badge ok' : 'badge'}>{open ? (f?.team_only ? 'Open · team only' : 'Open') : 'Closed'}</span>
      </div>
      <button type="button" className={`btn ${open ? 'ghost' : 'primary'}`}
        onClick={() => void run(() => api.admin.setOpen(round.campaign_id, !open), open ? 'Form closed' : 'Form open (any other round was closed)')}>
        {open ? 'Close the form' : 'Open the form for this round'}
      </button>
      <label className="toggle">
        <input type="checkbox" checked={teamOnly} onChange={(e) => setTeamOnly(e.target.checked)} /> MART team only
      </label>
      <p className="note">
        {teamOnly
          ? 'Only people on the MART team list (MART Orders → Team) can see and order in this round, e.g. for a members’ price. Everyone else sees “open for the MART team only”.'
          : 'Every @mdi.ac.in student can order in this round.'}
      </p>
      <Field label="Title on the form" hint={`Empty = “${round.name}”`}>
          {(a) => <input {...a} className="input" value={title} onChange={(e) => setTitle(e.target.value)} />}
        </Field>
      <Field label="Note under the title" hint="e.g. when orders close, where to collect">
          {(a) => <textarea {...a} className="input" rows={2} value={intro} onChange={(e) => setIntro(e.target.value)} />}
        </Field>
      <div className="two">
        <Field label="Items per order (max 6)">
          {(a) => <input {...a} className="input" type="number" min={1} max={6} value={cap} onChange={(e) => setCap(Number(e.target.value))} />}
        </Field>
        <Field label="Letters in back name">
          {(a) => <input {...a} className="input" type="number" min={1} max={30} value={nameMax} onChange={(e) => setNameMax(Number(e.target.value))} />}
        </Field>
      </div>
      <button type="button" className="btn ghost"
        onClick={() => void run(() => api.admin.saveRound(round.campaign_id, {
          title: title.trim() || null, intro: intro.trim() || null, team_only: teamOnly, item_cap: Math.min(6, Math.max(1, cap || 6)), name_max: Math.min(30, Math.max(1, nameMax || 12)),
        }), 'Saved')}>
        Save round settings
      </button>
    </div>
  )
}

function ProductCard({ p, run }: { p: AdminProduct; run: Run }) {
  const api = useApi()
  const toast = useToast()
  const [desc, setDesc] = useState(p.form?.description ?? '')
  const [shown, setShown] = useState(p.form?.shown ?? false)
  const [customOk, setCustomOk] = useState(p.form?.allow_custom_size ?? false)
  const [photos, setPhotos] = useState<string[]>(p.form?.photo_paths ?? [])
  const photo = useFileUrl('form-assets', photos[0])

  return (
    <div className="card stack">
      <div className="row-between">
        <span className="row"><i className="dot" style={{ background: swatch(p.colour).base }} /> <b>{p.name}</b></span>
        <span className="fineprint">{p.ordered} ordered</span>
      </div>
      <label className="toggle"><input type="checkbox" checked={shown} onChange={(e) => setShown(e.target.checked)} /> Show on the form</label>
      <dl className="kv readonly">
        <div><dt>Price</dt><dd>{inr(p.price_inr)}</dd></div>
        <div><dt>Sizes</dt><dd>{p.sizes.join(' · ') || '—'}</dd></div>
        <div><dt /><dd className="fineprint">Read-only here. Change in MART Orders → Products</dd></div>
      </dl>
      <label className="toggle"><input type="checkbox" checked={customOk} onChange={(e) => setCustomOk(e.target.checked)} /> Allow “my size isn't listed”</label>
      <Field label="Description">
          {(a) => <textarea {...a} className="input" rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} />}
        </Field>
      <div className="row">
        {photo && <img className="thumb" src={photo} alt="" />}
        <label className="upload sm">
          <input type="file" accept="image/jpeg,image/png,image/webp" onChange={async (e) => {
            const f = e.target.files?.[0]
            if (!f) return
            try {
              setPhotos([await api.admin.uploadAsset('products', f)])
              toast('Photo uploaded. Save to use it.')
            } catch (err) {
              toast(friendlyError(err))
            }
          }} />
          {photos.length ? 'Replace photo' : 'Add photo'}
        </label>
        {photos.length > 0 && <button type="button" className="link" onClick={() => setPhotos([])}>Remove photo</button>}
      </div>
      <button type="button" className="btn ghost"
        onClick={() => void run(() => api.admin.saveProduct(p.id, { shown, description: desc.trim() || null, allow_custom_size: customOk, photo_paths: photos }), 'Saved')}>
        Save form settings
      </button>
    </div>
  )
}

function QrRow({ q, run }: { q: AdminQr; run: Run }) {
  const api = useApi()
  const img = useFileUrl('form-assets', q.image_path)
  return (
    <div className={`card row qr-row ${q.active ? 'live' : ''}`}>
      {img ? <img className="thumb" src={img} alt={`QR for ${q.payee_name}`} /> : <span className="thumb" />}
      <div className="grow">
        <b>{q.payee_name}</b>
        <div className="fineprint">{q.upi_id ?? 'No UPI ID'}</div>
      </div>
      {q.active ? <span className="badge ok">Live</span> : (
        <button type="button" className="btn ghost sm" onClick={() => void run(() => api.admin.setActiveQr(q.id), `${q.payee_name}'s QR is live`)}>Make live</button>
      )}
    </div>
  )
}

function AddQr({ run }: { run: Run }) {
  const api = useApi()
  const toast = useToast()
  const [name, setName] = useState('')
  const [upi, setUpi] = useState('')
  const [file, setFile] = useState<File | null>(null)
  return (
    <div className="card stack">
      <b>Add a QR</b>
      <Field label="Whose QR (shown to students, saved as “paid to”)">
          {(a) => <input {...a} className="input" value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
      <Field label="UPI ID (optional, for the “Open my UPI app” button)">
          {(a) => <input {...a} className="input mono" value={upi} onChange={(e) => setUpi(e.target.value)} placeholder="name@okhdfcbank" />}
        </Field>
      <label className="upload">
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        {file ? file.name : 'Choose the QR image'}
      </label>
      <button type="button" className="btn ghost" onClick={() => {
        if (!name.trim() || !file) return toast('Give a name and the QR image.')
        if (upi.trim() && !/^[\w.-]+@[\w.-]+$/.test(upi.trim())) return toast('That UPI ID looks wrong (name@bank).')
        void run(async () => {
          const path = await api.admin.uploadAsset('qr', file)
          await api.admin.addQr({ payee_name: name.trim(), upi_id: upi.trim() || null, image_path: path })
          setName('')
          setUpi('')
          setFile(null)
        }, 'QR added. Make it live when you want students to use it.')
      }}>Add QR</button>
    </div>
  )
}
