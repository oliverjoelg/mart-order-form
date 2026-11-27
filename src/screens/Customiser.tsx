import { useRef, useState, type Dispatch, type SetStateAction } from 'react'
import type { ShirtView } from '../components/ShirtStage'
import SpinGarment from '../components/SpinGarment'
import Snow from '../components/Snow'
import { Choice, Field, Sheet, useFileUrl, useToast } from '../components/ui'
import { swatch } from '../lib/colours'
import { itemCap, lineErrors, linesTotal, newLine, pickProduct, type Draft, type Line, type LineErrors } from '../lib/order'
import { useTheme } from '../lib/theme'
import type { OrderForm } from '../lib/types'
import { cleanPrintName, customSizeError, inr } from '../lib/validate'
import BagList from './BagList'

const TABS = ['Colour', 'Size', 'Name', 'Batch'] as const
type Tab = (typeof TABS)[number]
const TAB_OF: Record<keyof LineErrors, Tab> = { product: 'Colour', size: 'Size', name: 'Name', batch: 'Batch' }

/** "Classic MDI Navy Blue" -> "Classic MDI" (the colour is shown separately) */
export const lineName = (p: { name: string; colour: string }) => p.name.replace(p.colour, '').trim() || p.name

/**
 * The home screen after sign-in: the garment fills the screen and turns as you scroll, drag or
 * add it to the bag. Phones: one control at a time under tabs. Laptops: every control in a column.
 */
export default function Customiser({ form, draft, setDraft, onCheckout }: {
  form: OrderForm; draft: Draft; setDraft: Dispatch<SetStateAction<Draft>>; onCheckout(): void
}) {
  const round = form.round!
  const theme = useTheme()
  const toast = useToast()
  const cap = itemCap(round)
  const { bag, wip, editing } = draft
  const product = form.products.find((p) => p.id === wip.product_id)
  const [tab, setTab] = useState<Tab>('Colour')
  const [view, setView] = useState<ShirtView>('back')
  const [shown, setShown] = useState(false)
  const [spin, setSpin] = useState(0)
  const [bump, setBump] = useState(0)
  const [sheet, setSheet] = useState<'bag' | 'size' | 'photo' | null>(null)
  const photo = useFileUrl('form-assets', product?.photo_paths[0])
  const nameIn = useRef<HTMLInputElement>(null)
  const errs = shown ? lineErrors(wip, form) : {}
  const full = !editing && bag.length >= cap

  if (!form.products.length) {
    return (
      <section className="empty">
        <h1>Nothing on sale yet.</h1>
        <p className="lede">MART hasn't put any items on this round. Check back soon or watch the MART group.</p>
      </section>
    )
  }

  const edit = (fn: (l: Line) => Line) => setDraft((d) => ({ ...d, wip: fn(d.wip) }))

  const commit = () => {
    if (full) return toast(`That's the most for one order (${cap}).`)
    const e = lineErrors(wip, form)
    const first = Object.keys(e)[0] as keyof LineErrors | undefined
    if (first) {
      setShown(true)
      setTab(TAB_OF[first])
      if (first === 'name') {
        setView('back')
        requestAnimationFrame(() => nameIn.current?.focus())
      }
      return toast(e[first]!)
    }
    setDraft((d) => {
      const nextBag = d.editing ? d.bag.map((l) => (l.key === d.editing ? d.wip : l)) : [...d.bag, d.wip]
      return { ...d, bag: nextBag, wip: newLine(form, d.wip), editing: null }
    })
    setShown(false)
    setSpin((n) => n + 1)
    setBump((n) => n + 1)
    setView('back')
    toast(editing ? 'Item updated.' : `In the bag. ${bag.length + 1} of ${cap}. Same size and name are ready for another.`)
  }

  const editItem = (key: string) => {
    const l = bag.find((x) => x.key === key)
    if (!l) return
    setDraft((d) => ({ ...d, wip: { ...l }, editing: key }))
    setSheet(null)
    setShown(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const remove = (key: string) => {
    setDraft((d) => ({
      ...d, bag: d.bag.filter((l) => l.key !== key),
      ...(d.editing === key ? { editing: null, wip: newLine(form, d.wip) } : {}),
    }))
    toast('Item removed.')
  }
  const cancelEdit = () => {
    setDraft((d) => ({ ...d, editing: null, wip: newLine(form, d.bag[d.bag.length - 1]) }))
    setShown(false)
  }

  const printName = wip.no_name ? '' : wip.name.trim()
  const sw = swatch(product?.colour ?? '')
  const total = linesTotal(form, bag)
  const cta = editing ? 'Update item' : full ? `Bag full (${cap})` : 'Add to bag'

  return (
    <div className="cz" style={{ ['--shirt' as string]: sw.base }}>
      <div className="cz-stage">
        {theme.snow && <Snow />}
        <div className="cz-orbit" aria-hidden="true" />
        <div className="cz-orbit two" aria-hidden="true" />
        <p className="cz-word" aria-hidden="true">{theme.word}</p>
        <p className="cz-round">{round.title}{round.intro ? <><span aria-hidden="true"> ✦ </span>{round.intro}</> : null}</p>
        <span className="sparkle s1" aria-hidden="true" /><span className="sparkle s2" aria-hidden="true" /><span className="sparkle s3" aria-hidden="true" />
        <SpinGarment garment={theme.garment} colour={product?.colour ?? ''} printName={printName} printBatch={wip.batch}
          view={view} onView={setView} spin={spin}
          label={`${product?.colour ?? ''} ${theme.noun}, ${view} view${printName ? `, ${printName} printed on the back` : ''}`} />
        {spin > 0 && <span className="burst" key={spin} aria-hidden="true">{Array.from({ length: 10 }, (_, i) => <i key={i} style={{ ['--i' as string]: i }} />)}</span>}
        <div className="cz-views" role="group" aria-label="Side">
          {(['front', 'back'] as const).map((v) => (
            <button key={v} type="button" className="pill" aria-pressed={view === v} onClick={() => setView(v)}>{v === 'front' ? 'Front' : 'Back'}</button>
          ))}
        </div>
        <p className="cz-hint" aria-hidden="true">Drag to spin <span>↻</span></p>
        <button type="button" className="bag-btn" key={bump} onClick={() => setSheet('bag')} aria-label={`Bag, ${bag.length} ${bag.length === 1 ? 'item' : 'items'}`}>
          Bag <b>{bag.length}</b>
        </button>
      </div>

      <div className="cz-panel">
        <span className="cz-grip" aria-hidden="true" />
        {editing && (
          <p className="cz-editing">Editing item {bag.findIndex((l) => l.key === editing) + 1} <button type="button" className="link" onClick={cancelEdit}>Cancel</button></p>
        )}
        <div className="cz-tabs" role="tablist" aria-label="Customise">
          {TABS.map((t) => (
            <button key={t} type="button" role="tab" id={`tab-${t}`} aria-controls={`pane-${t}`} aria-selected={tab === t} className={errs[(Object.keys(TAB_OF) as (keyof LineErrors)[]).find((k) => TAB_OF[k] === t)!] ? 'bad' : ''}
              onClick={() => { setTab(t); if (t === 'Name' || t === 'Batch') setView('back') }}>{t}</button>
          ))}
        </div>

        <section className="cz-sec" id="pane-Colour" role="tabpanel" aria-labelledby="tab-Colour" data-on={tab === 'Colour'}>
          <h2 className="cz-h">Colour</h2>
          <Choice legend="Colour" hideLegend variant="swatches" options={form.products.map((p) => p.id)} value={product?.id ?? ''} error={errs.product}
            onChange={(id) => {
              const r = pickProduct(wip, form.products.find((x) => x.id === id)!)
              edit(() => r.line)
              if (r.note) toast(r.note)
            }}
            render={(id) => {
              const p = form.products.find((x) => x.id === id)!
              return <><i className="swatch" style={{ background: swatch(p.colour).base }} /><span className="sr-only">{p.colour}, {inr(p.price_inr)}</span></>
            }} />
          <p className="cz-cap">
            <b>{product?.colour}</b> · {product ? lineName(product) : ''} · {inr(product?.price_inr ?? 0)}
            {photo && <> · <button type="button" className="link" onClick={() => setSheet('photo')}>See photo</button></>}
          </p>
        </section>

        <section className="cz-sec" id="pane-Size" role="tabpanel" aria-labelledby="tab-Size" data-on={tab === 'Size'}>
          <Choice legend={<span className="cz-h">Size</span>} variant="sizes" options={product?.sizes ?? []} value={wip.custom ? '' : wip.size} error={wip.custom ? null : errs.size}
            onChange={(s) => edit((l) => ({ ...l, size: s, custom: false }))}
            aside={
              <span className="links">
                {product?.allow_custom_size && !wip.custom && <button type="button" className="link small" onClick={() => edit((l) => ({ ...l, custom: true }))}>Not listed?</button>}
                <button type="button" className="link small" onClick={() => setSheet('size')}>Size help</button>
              </span>
            } />
          {product?.allow_custom_size && wip.custom && (
            <Field label="Your size" error={errs.size ?? (wip.custom_size ? customSizeError(wip.custom_size) : null)} hint="e.g. Chest 38 / Length 28"
              aside={<button type="button" className="link small" onClick={() => edit((l) => ({ ...l, custom: false }))}>Use the list</button>}>
              {(a) => <input {...a} className="input" placeholder="Chest 38 / Length 28" value={wip.custom_size} maxLength={40} onChange={(e) => { const v = e.target.value; edit((l) => ({ ...l, custom_size: v })) }} />}
            </Field>
          )}
        </section>

        <section className="cz-sec" id="pane-Name" role="tabpanel" aria-labelledby="tab-Name" data-on={tab === 'Name'}>
          <Field label={<span className="cz-h">Name on the back</span>} error={errs.name}
            hint={wip.no_name ? 'Only the batch will be printed.' : `Letters, spaces, . ' and - · up to ${round.name_max}`}
            aside={
              <label className="switch">
                <input type="checkbox" checked={wip.no_name} onChange={(e) => { const on = e.target.checked; edit((l) => ({ ...l, no_name: on })); setView('back') }} />
                <span>No name</span>
              </label>
            }>
            {(a) => (
              <div className="print-wrap">
                <input {...a} ref={nameIn} className="input print" autoComplete="off" autoCapitalize="characters" spellCheck={false} enterKeyHint="done"
                  placeholder={wip.no_name ? 'NO NAME' : 'YOUR NAME'} value={wip.no_name ? '' : wip.name} disabled={wip.no_name}
                  onFocus={() => setView('back')}
                  onChange={(e) => { const v = cleanPrintName(e.target.value, round.name_max); edit((l) => ({ ...l, name: v })) }} />
                {!wip.no_name && <span className="counter" aria-hidden="true">{wip.name.length}/{round.name_max}</span>}
              </div>
            )}
          </Field>
        </section>

        <section className="cz-sec" id="pane-Batch" role="tabpanel" aria-labelledby="tab-Batch" data-on={tab === 'Batch'}>
          <Choice legend={<span className="cz-h">Batch on the back</span>} variant="chips" options={round.print_batches} value={wip.batch} error={errs.batch}
            onChange={(b) => { edit((l) => ({ ...l, batch: b })); setView('back') }} />
        </section>

        <div className="cz-cta">
          <button type="button" className="btn primary go" onClick={commit} disabled={full}>
            <span>{cta}</span><b>{inr(product?.price_inr ?? 0)}</b>
          </button>
          {bag.length > 0 && !editing && (
            <button type="button" className="btn ghost" onClick={onCheckout}>Checkout · {inr(total)}</button>
          )}
        </div>
        <p className="fineprint">Saved in this browser as you go.</p>
      </div>

      <Sheet open={sheet === 'bag'} onClose={() => setSheet(null)} title={`Your bag · ${bag.length} of ${cap}`}>
        {bag.length ? (
          <>
            <BagList form={form} lines={bag} onEdit={editItem} onRemove={remove} />
            <div className="bag-total"><span>Total</span><b>{inr(total)}</b></div>
            <button type="button" className="btn primary go" onClick={() => { setSheet(null); onCheckout() }}><span>Checkout</span><b>{inr(total)}</b></button>
            {!full && <button type="button" className="btn ghost wide" onClick={() => setSheet(null)}>Add another</button>}
          </>
        ) : (
          <p className="lede">Nothing in the bag yet. Make one, then tap <b>Add to bag</b>.</p>
        )}
      </Sheet>
      <Sheet open={sheet === 'size'} onClose={() => setSheet(null)} title="Size help">
        <p>{theme.sizeHelp}</p>
        <p className="fineprint">The vendor's chart (chest and length in inches) goes here once MART has the numbers.</p>
        {product?.allow_custom_size && <p>Need something else? Close this and tap <b>Not listed?</b> to type your measurements.</p>}
      </Sheet>
      <Sheet open={sheet === 'photo'} onClose={() => setSheet(null)} title={product?.name ?? 'Photo'}>
        {photo && <img className="sheet-photo" src={photo} alt={product?.name ?? ''} />}
        {product?.description && <p>{product.description}</p>}
      </Sheet>
    </div>
  )
}
