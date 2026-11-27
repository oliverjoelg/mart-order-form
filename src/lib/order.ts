// The order being built in the customiser, and the draft kept in this browser.
// Pure functions only (tested in order.test.ts); the screens live in src/screens/.
import type { CartItem, FormProduct, FormRound, OrderForm, StudentDetails } from './types'
import { MAX_ITEMS, customSizeError, detailsErrors, printNameError, txnError } from './validate'

/** One item while it's being edited. Becomes a CartItem on submit. */
export interface Line {
  key: string
  product_id: string
  size: string
  /** "My size isn't listed" */
  custom: boolean
  custom_size: string
  name: string
  /** the student chose no name on the back */
  no_name: boolean
  batch: string
}

/** Two screens: the customiser (with the bag over it) and the one-page checkout. */
export type Step = 'customise' | 'checkout'

export interface Draft {
  v: 3
  step: Step
  details: StudentDetails
  /** items added to the bag, in order */
  bag: Line[]
  /** the item on the stage, not in the bag yet (or a copy of the bag item being edited) */
  wip: Line
  /** key of the bag item the stage is editing; null while building a new one */
  editing: string | null
  txn: string
  shot: string | null
}

export const uid = () => Math.random().toString(36).slice(2, 10)

export const itemCap = (round: FormRound) => Math.max(1, Math.min(round.item_cap, MAX_ITEMS))

/** "PG'26" -> "26" (the numeral behind the shirt) */
export const batchNumeral = (batch: string) => (batch.match(/\d+/g)?.join('') ?? '').slice(-2)

/** Size to start on for a product: the wanted one if it's made, else M, else the first. */
export function fitSize(p: FormProduct, want: string): string {
  if (p.sizes.includes(want)) return want
  return p.sizes.includes('M') ? 'M' : p.sizes[0] ?? ''
}

/** A new item. Copies size, name and batch from the previous one, so a second polo is one or two taps. */
export function newLine(form: OrderForm, prev?: Line): Line {
  const round = form.round!
  const product = (prev && form.products.find((p) => p.id === prev.product_id)) || form.products[0]
  const batch = prev?.batch || form.round!.print_batches.find((b) => b === form.me?.batch) || round.print_batches[round.print_batches.length - 1] || ''
  return {
    key: uid(),
    product_id: product?.id ?? '',
    size: product ? fitSize(product, prev && !prev.custom ? prev.size : 'M') : '',
    custom: false,
    custom_size: '',
    name: prev?.name ?? '',
    no_name: prev?.no_name ?? false,
    batch,
  }
}

/** Switch an item to another product (colour). Keeps the size if it's made, otherwise says what changed. */
export function pickProduct(line: Line, p: FormProduct): { line: Line; note: string | null } {
  let note: string | null = null
  let size = line.size
  let custom = line.custom
  if (custom && !p.allow_custom_size) {
    custom = false
    size = fitSize(p, 'M')
    note = `${p.colour} only comes in the listed sizes, so the size is now ${size}.`
  } else if (!custom && !p.sizes.includes(size)) {
    size = fitSize(p, size)
    note = `${line.size} isn't made in ${p.colour}, so the size is now ${size}.`
  }
  return { line: { ...line, product_id: p.id, size, custom }, note }
}

export type LineErrors = Partial<Record<'product' | 'size' | 'name' | 'batch', string>>

export function lineErrors(line: Line, form: OrderForm): LineErrors {
  const round = form.round!
  const e: LineErrors = {}
  const p = form.products.find((x) => x.id === line.product_id)
  if (!p) e.product = 'This item is no longer on sale. Pick another colour.'
  if (line.custom) {
    const ce = p && !p.allow_custom_size ? 'Pick a size from the list' : customSizeError(line.custom_size)
    if (ce) e.size = ce
  } else if (!p || !p.sizes.includes(line.size)) e.size = 'Pick a size'
  if (!line.no_name) {
    if (!line.name.trim()) e.name = 'Type a name for the back, or choose No name'
    else {
      const ne = printNameError(line.name, round.name_max)
      if (ne) e.name = ne
    }
  }
  if (!round.print_batches.includes(line.batch)) e.batch = 'Pick the batch to print on the back'
  return e
}

/** Index of the first item with a problem, or -1 when every item is ready. */
export const firstBadLine = (lines: Line[], form: OrderForm) => lines.findIndex((l) => Object.keys(lineErrors(l, form)).length > 0)

export function lineToCart(l: Line): CartItem {
  return {
    key: l.key,
    product_id: l.product_id,
    size: l.custom ? l.custom_size.trim() : l.size,
    print_name: l.no_name ? null : l.name.trim(),
    print_batch: l.batch,
  }
}

export const priceOf = (form: OrderForm, l: Pick<Line, 'product_id'>) => form.products.find((p) => p.id === l.product_id)?.price_inr ?? 0
export const linesTotal = (form: OrderForm, lines: Line[]) => lines.reduce((s, l) => s + priceOf(form, l), 0)

export const detailsReady = (d: StudentDetails, round: FormRound) => Object.keys(detailsErrors(d, round)).length === 0

export function initialDetails(form: OrderForm): StudentDetails {
  const m = form.me ?? {}
  return { name: m.name ?? '', phone: m.phone ?? '', roll_no: m.roll_no ?? '', batch: m.batch ?? '', course: m.course ?? '', section: m.section ?? '' }
}

/**
 * The products on sale can change while the form is open (MART edits the round, or the form reloads
 * after the student comes back from their UPI app). Drops bag items whose product is gone and gives
 * the stage a product that's on sale. Returns the same object when nothing changed.
 */
export function fitToForm(d: Draft, form: OrderForm): Draft {
  if (!form.products.length) return d
  const onSale = (id: string) => form.products.some((p) => p.id === id)
  if (d.bag.every((l) => onSale(l.product_id)) && onSale(d.wip.product_id)) return d
  const bag = d.bag.filter((l) => onSale(l.product_id))
  const editing = bag.some((l) => l.key === d.editing) ? d.editing : null
  const wip = onSale(d.wip.product_id) && (editing || !d.editing) ? d.wip : newLine(form, bag[bag.length - 1])
  return { ...d, bag, wip, editing, step: d.step === 'checkout' && !bag.length ? 'customise' : d.step }
}

/** Everything the checkout needs before Submit lights up. */
export function checkoutErrors(d: Draft, form: OrderForm): string[] {
  const e: string[] = []
  if (!d.bag.length) e.push('Your bag is empty.')
  const bad = firstBadLine(d.bag, form)
  if (bad !== -1) e.push(`Item ${bad + 1}: ${Object.values(lineErrors(d.bag[bad]!, form))[0]}`)
  if (!detailsReady(d.details, form.round!)) e.push('Fill in your details.')
  if (!form.qr) e.push("Payment isn't open yet.")
  if (txnError(d.txn)) e.push('Add the UPI transaction ID.')
  if (!d.shot) e.push('Add the payment screenshot.')
  return e
}

// ---- draft kept in this browser ----
export const DRAFT_PREFIX = 'mart-order-draft:'
export const draftKey = (userId: string, roundId: string) => `${DRAFT_PREFIX}${userId}:${roundId}`

/**
 * Removes every order draft from this browser. Called on sign-out so the next person on a shared
 * computer can't find the last student's name, phone and roll number in the browser's storage.
 */
export function clearDrafts(store: Pick<Storage, 'length' | 'key' | 'removeItem'>) {
  const keys: string[] = []
  for (let i = 0; i < store.length; i++) {
    const k = store.key(i)
    if (k?.startsWith(DRAFT_PREFIX)) keys.push(k)
  }
  keys.forEach((k) => store.removeItem(k))
}

interface OldDraft {
  v?: number
  step?: string
  details?: StudentDetails
  cart?: CartItem[]
  lines?: Line[]
  bag?: Line[]
  wip?: Line
  editing?: string | null
  txn?: string
  shot?: string | null
}

/**
 * Reads a saved draft (this shape, the four-step one, or the pre-redesign cart) and fits it to the
 * form as it is now: items whose product left the form are dropped. Fresh draft when nothing usable.
 */
export function restoreDraft(raw: string | null, form: OrderForm): Draft {
  const details = initialDetails(form)
  const fresh: Draft = { v: 3, step: 'customise', details, bag: [], wip: newLine(form), editing: null, txn: '', shot: null }
  let d: OldDraft | null = null
  try {
    d = raw ? JSON.parse(raw) : null
  } catch {
    d = null
  }
  if (!d || typeof d !== 'object') return fresh

  const onSale = (id: string) => form.products.some((p) => p.id === id)
  const ok = (l: Line) => Object.keys(lineErrors(l, form)).length === 0
  let bag: Line[]
  let wip: Line | undefined
  if (d.v === 3 && Array.isArray(d.bag)) {
    bag = d.bag.filter((l) => onSale(l.product_id))
    wip = d.wip && onSale(d.wip.product_id) ? d.wip : undefined
  } else if (d.v === 2 && Array.isArray(d.lines)) {
    // four-step drafts: finished items go in the bag, the first unfinished one goes on the stage
    const lines = d.lines.filter((l) => onSale(l.product_id))
    bag = lines.filter(ok)
    wip = lines.find((l) => !ok(l))
  } else {
    bag = (d.cart ?? []).filter((c) => onSale(c.product_id)).map((c) => {
      const p = form.products.find((x) => x.id === c.product_id)!
      const listed = p.sizes.includes(c.size)
      return {
        key: c.key || uid(), product_id: c.product_id, size: listed ? c.size : fitSize(p, 'M'), custom: !listed, custom_size: listed ? '' : c.size,
        name: c.print_name ?? '', no_name: c.print_name === null, batch: c.print_batch,
      }
    })
  }
  bag = bag.slice(0, itemCap(form.round!))
  const editing = d.v === 3 && bag.some((l) => l.key === d!.editing) ? d.editing ?? null : null
  const wantCheckout = d.step === 'checkout' || d.step === 'payment' || d.step === 'review'
  const step: Step = wantCheckout && bag.length && firstBadLine(bag, form) === -1 ? 'checkout' : 'customise'
  return {
    v: 3, step, details: { ...details, ...(d.details ?? {}) }, bag,
    wip: wip ?? newLine(form, bag[bag.length - 1]), editing,
    txn: d.txn ?? '', shot: d.shot ?? null,
  }
}
