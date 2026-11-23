// `npm run dev:demo`: an in-memory backend with made-up data, for trying the form without
// accounts. Applies the same rules as submit_order() so errors look real. Not in the production bundle.
import type { Api } from './api'
import type { AdminQr, AdminRound, MyOrder, OrderForm, PaymentStatus } from './types'
import { detailsErrors, normalisePhone, normaliseRoll, normaliseTxn, printNameError, sizeOk, txnError } from './validate'

const delay = (ms = 250) => new Promise((r) => setTimeout(r, ms))
const uid = () => Math.random().toString(36).slice(2, 10)

const svg = (body: string, w = 240, h = 240) =>
  'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>`)

/** A fake QR-looking square (not scannable) with DEMO across it. */
function demoQr(seed: string): string {
  let cells = ''
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0
  for (let y = 0; y < 25; y++)
    for (let x = 0; x < 25; x++) {
      h = (h * 1103515245 + 12345) >>> 0
      const finder = (x < 7 && y < 7) || (x > 17 && y < 7) || (x < 7 && y > 17)
      const on = finder ? (x % 6 === 0 || y % 6 === 0 || (x % 6 > 1 && x % 6 < 5 && y % 6 > 1 && y % 6 < 5)) : h % 3 === 0
      if (on) cells += `<rect x="${20 + x * 8}" y="${20 + y * 8}" width="8" height="8"/>`
    }
  return svg(`<rect width="240" height="240" fill="#fff"/><g fill="#111">${cells}</g><rect x="60" y="104" width="120" height="32" rx="6" fill="#d2491b"/><text x="120" y="126" font-family="sans-serif" font-size="18" font-weight="700" fill="#fff" text-anchor="middle">DEMO</text>`)
}

export function createDemoApi(): Api {
  const me = { id: 'demo-student', email: 'pgdm26demo_s@mdi.ac.in' }
  let signedIn = false
  const listeners = new Set<() => void>()
  const notify = () => listeners.forEach((f) => f())

  const campaignId = 'demo-round'
  const round = {
    campaign_id: campaignId, is_open: true, title: 'Batch Tees 2026', intro: 'Orders close Friday 6 pm. Collect from MART when your item is ready.',
    item_cap: 6, name_max: 12,
    student_batches: ["PG'24", "PG'25", "PG'26"], courses: ['PGDM', 'PGDM-HRM', 'PGDM-IB', 'PGDM-BFS', 'PGDM-BN'],
    sections: ['A', 'B', 'C', 'D', 'E', 'F', 'NA'], print_batches: ["PG'24", "PG'25", "PG'26"],
  }
  const classic = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']
  const premium = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']
  const products = [
    { id: 'navy', name: 'Classic MDI Navy Blue', colour: 'Navy Blue', price_inr: 699, sizes: classic, ordered: 3, form: { shown: true, description: 'Cotton polo, MDI print on the back.', photo_paths: [], allow_custom_size: true } },
    { id: 'pink', name: 'Classic MDI Baby Pink', colour: 'Baby Pink', price_inr: 699, sizes: classic, ordered: 1, form: { shown: true, description: 'Cotton polo, MDI print on the back.', photo_paths: [], allow_custom_size: true } },
    { id: 'black', name: 'Premium UCB Black', colour: 'Black', price_inr: 1049, sizes: premium, ordered: 0, form: { shown: true, description: 'United Colors of Benetton polo.', photo_paths: [], allow_custom_size: false } },
    { id: 'white', name: 'Premium UCB White', colour: 'White', price_inr: 1049, sizes: premium, ordered: 0, form: { shown: true, description: 'United Colors of Benetton polo.', photo_paths: [], allow_custom_size: false } },
  ]
  const now = () => new Date().toISOString()
  const qrs: AdminQr[] = [
    { id: 'qr1', payee_name: 'Animesh (MART)', upi_id: 'animesh@okdemo', image_path: 'qr/animesh.svg', active: true, activated_at: now(), deactivated_at: null, created_at: now() },
    { id: 'qr2', payee_name: 'Ekta (MART)', upi_id: 'ekta@okdemo', image_path: 'qr/ekta.svg', active: false, activated_at: null, deactivated_at: null, created_at: now() },
  ]
  const files = new Map<string, string>()
  const usedTxns = new Set<string>(['400000000001'])
  let profile: OrderForm['me'] = null
  const orders: MyOrder[] = [
    {
      key: 'old', round: 'Reopening round 2025', submitted_at: '2025-11-02T10:15:00+05:30', total_inr: 599, payment_status: 'received',
      items: [{ product: 'Classic MDI Navy Blue', colour: 'Navy Blue', size: 'M', print_name: 'DEMO', print_batch: "PG'26", status: 'handed_over', price_inr: 599 }],
    },
  ]

  const fail = (msg: string): never => {
    throw new Error(msg)
  }

  return {
    mode: 'demo',
    async getUser() {
      await delay(100)
      return signedIn ? me : null
    },
    onAuthChange(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    async signIn() {
      await delay(300)
      signedIn = true
      notify()
    },
    async signOut() {
      signedIn = false
      notify()
    },

    async getForm() {
      await delay()
      const active = qrs.find((q) => q.active)
      return {
        round: round.is_open ? { ...round, title: round.title || 'Batch Tees 2026' } : null,
        products: round.is_open
          ? products.filter((p) => p.form.shown).map((p) => ({
              id: p.id, name: p.name, colour: p.colour, price_inr: p.price_inr, sizes: p.sizes,
              description: p.form.description, photo_paths: p.form.photo_paths, allow_custom_size: p.form.allow_custom_size,
            }))
          : [],
        qr: active ? { id: active.id, payee_name: active.payee_name, upi_id: active.upi_id, image_path: active.image_path } : null,
        me: profile,
        email: me.email,
        is_form_admin: true,
      }
    },

    async fileUrl(_bucket, path) {
      return files.get(path) ?? (path.startsWith('qr/') ? demoQr(path) : svg('<rect width="240" height="240" fill="#ccd"/>'))
    },

    async uploadScreenshot(userId, file) {
      await delay(400)
      const path = `${userId}/${Date.now()}.jpg`
      files.set(path, URL.createObjectURL(file))
      return path
    },

    async submitOrder({ campaignId: cid, details, items, payment }) {
      await delay(600)
      if (cid !== campaignId || !round.is_open) fail('Orders for this round are closed')
      const de = Object.values(detailsErrors(details, round))
      if (de.length) fail(de[0]!)
      if (items.length < 1) fail('Add at least one item')
      if (items.length > Math.min(round.item_cap, 6)) fail(`At most ${Math.min(round.item_cap, 6)} items per order`)
      items.forEach((it, i) => {
        const p = products.find((x) => x.id === it.product_id && x.form.shown) ?? fail(`Item ${i + 1}: this product is not on the form`)
        if (!sizeOk({ ...p, ...p.form }, it.size)) fail(`Item ${i + 1}: pick a size from the list`)
        if (!round.print_batches.includes(it.print_batch)) fail(`Item ${i + 1}: pick the batch to print`)
        if (it.print_name && printNameError(it.print_name, round.name_max)) fail(`Item ${i + 1}: name on the back can have letters, spaces, . ' - (max ${round.name_max})`)
      })
      const qr = qrs.find((q) => q.id === payment.qr_id && (q.active || (q.deactivated_at && Date.now() - Date.parse(q.deactivated_at) < 7.2e6)))
      if (!qr) fail('That payment QR is no longer in use. Reload the page and pay to the new QR.')
      const te = txnError(payment.txn_id)
      if (te) fail(te)
      const txn = normaliseTxn(payment.txn_id)
      if (usedTxns.has(txn)) fail('This transaction ID is already used for an order')
      if (!files.has(payment.screenshot_path)) fail('Upload the payment screenshot')
      usedTxns.add(txn)
      profile = { ...details, phone: normalisePhone(details.phone), roll_no: normaliseRoll(details.roll_no) }
      const lines = items.map((it) => {
        const p = products.find((x) => x.id === it.product_id)!
        p.ordered++
        const std = p.sizes.includes(it.size.toUpperCase())
        return { product: p.name, colour: p.colour, size: std ? it.size.toUpperCase() : it.size.trim(), print_name: it.print_name, print_batch: it.print_batch, status: 'ordered' as const, price_inr: p.price_inr }
      })
      const total = lines.reduce((s, l) => s + l.price_inr, 0)
      const at = now()
      orders.unshift({ key: uid(), round: round.title, submitted_at: at, total_inr: total, payment_status: 'unchecked' as PaymentStatus, items: lines })
      return { order_id: orders[0]!.key, items: lines.length, total_inr: total, submitted_at: at }
    },

    async myOrders() {
      await delay()
      return structuredClone(orders)
    },

    admin: {
      async state() {
        await delay()
        const r: AdminRound = { campaign_id: campaignId, name: 'Batch Tees 2026', orders: orders.length - 1, form: { ...round }, products: structuredClone(products) }
        const other: AdminRound = { campaign_id: 'hoodies', name: 'Hoodies 2027', orders: 0, form: null, products: [] }
        return { rounds: [r, other], qrs: structuredClone(qrs) }
      },
      async setOpen(cid, open) {
        await delay()
        if (cid === campaignId) round.is_open = open
        else fail('Demo: only Batch Tees 2026 has products')
      },
      async saveRound(_cid, patch) {
        await delay()
        Object.assign(round, patch)
      },
      async saveProduct(id, patch) {
        await delay()
        const p = products.find((x) => x.id === id) ?? fail('Unknown product')
        if (patch.price_inr !== undefined) p.price_inr = patch.price_inr
        if (patch.sizes) p.sizes = patch.sizes.map((s) => s.trim().toUpperCase()).filter(Boolean)
        const { price_inr: _a, sizes: _b, ...rest } = patch
        Object.assign(p.form, rest)
      },
      async uploadAsset(folder, file) {
        await delay(300)
        const path = `${folder}/${Date.now()}.jpg`
        files.set(path, URL.createObjectURL(file))
        return path
      },
      async addQr(q) {
        await delay()
        qrs.unshift({ ...q, id: uid(), active: false, activated_at: null, deactivated_at: null, created_at: now() })
      },
      async setActiveQr(id) {
        await delay()
        for (const q of qrs) {
          if (q.active && q.id !== id) {
            q.active = false
            q.deactivated_at = now()
          }
        }
        const q = id ? qrs.find((x) => x.id === id) : null
        if (q && !q.active) {
          q.active = true
          q.activated_at = now()
        }
      },
    },
  }
}
