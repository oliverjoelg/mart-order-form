import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Api } from './api'
import { clearDrafts } from './order'
import { resolveTheme } from './theme'
import type { AdminState, MyOrder, OrderForm, SubmitResult } from './types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
// Publishable (anon) key: public by design. Students have no table rights; they use RPCs.
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

function client(): SupabaseClient {
  if (!url || !key) throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY are not set (see .env.example)')
  if (key.startsWith('sb_secret_')) throw new Error('A secret Supabase key must never be used in the browser')
  return createClient(url, key, {
    auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'mart-order-form-auth' },
  })
}

function ok<T>(res: { data: T; error: unknown }): T {
  if (res.error) throw res.error
  return res.data
}

const ext = (b: Blob) => (b.type === 'image/png' ? 'png' : b.type === 'image/webp' ? 'webp' : 'jpg')
const rand = () => Math.random().toString(36).slice(2, 8)

export function createSupabaseApi(): Api {
  const sb = client()

  return {
    mode: 'supabase',

    async getUser() {
      const { data } = await sb.auth.getSession()
      const u = data.session?.user
      return u ? { id: u.id, email: (u.email ?? '').toLowerCase() } : null
    },

    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange(() => cb())
      return () => data.subscription.unsubscribe()
    },

    async signIn() {
      const redirectTo = window.location.origin + import.meta.env.BASE_URL
      const { error } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, queryParams: { hd: 'mdi.ac.in', prompt: 'select_account' } },
      })
      if (error) throw error
    },

    async signOut() {
      try {
        clearDrafts(localStorage)
      } catch {
        /* storage blocked: nothing to clear */
      }
      await sb.auth.signOut()
    },

    async getLook() {
      // form_look() is in the 2026-11-25 migration; until it's applied, the T-shirt look
      const { data, error } = await sb.rpc('form_look')
      return error ? 'tees' : resolveTheme(data).id
    },

    async getForm() {
      return ok(await sb.rpc('get_order_form')) as OrderForm
    },

    async fileUrl(bucket, path) {
      const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, 3600)
      if (error) throw error
      return data.signedUrl
    },

    async uploadScreenshot(userId, file) {
      const path = `${userId}/${Date.now()}-${rand()}.${ext(file)}`
      const res = await sb.storage.from('payment-screenshots').upload(path, file, { contentType: file.type, upsert: false })
      // the database allows 10 screenshot uploads per student per 24 hours
      if (res.error && /row-level security|unauthorized/i.test(res.error.message)) {
        throw new Error("You've uploaded 10 screenshots in the last 24 hours. Use one you already picked, try again tomorrow, or contact MART.")
      }
      ok(res)
      return path
    },

    async submitOrder({ campaignId, details, items, payment }) {
      return ok(
        await sb.rpc('submit_order', {
          p_campaign_id: campaignId,
          p_details: details,
          p_items: items.map(({ product_id, size, print_name, print_batch }) => ({ product_id, size, print_name, print_batch })),
          p_payment: payment,
        }),
      ) as SubmitResult
    },

    async myOrders() {
      return ok(await sb.rpc('my_orders')) as MyOrder[]
    },

    admin: {
      async state() {
        return ok(await sb.rpc('form_admin_state')) as AdminState
      },
      async setOpen(campaignId, open) {
        ok(await sb.rpc('form_admin_set_open', { p_campaign_id: campaignId, p_open: open }))
      },
      async saveRound(campaignId, patch) {
        ok(await sb.from('form_rounds').upsert({ campaign_id: campaignId, ...patch }, { onConflict: 'campaign_id' }))
      },
      async saveProduct(productId, patch) {
        ok(await sb.rpc('form_admin_save_product', { p_product_id: productId, p: patch }))
      },
      async uploadAsset(folder, file) {
        const path = `${folder}/${Date.now()}-${rand()}.${ext(file)}`
        ok(await sb.storage.from('form-assets').upload(path, file, { contentType: file.type, upsert: false }))
        return path
      },
      async addQr(q) {
        ok(await sb.from('form_payment_qrs').insert(q))
      },
      async setActiveQr(id) {
        ok(await sb.rpc('form_admin_set_active_qr', { p_qr_id: id }))
      },
      async isSuper() {
        const { data, error } = await sb.rpc('is_super')
        return !error && data === true
      },
      async setTheme(campaignId, theme) {
        ok(await sb.rpc('form_set_theme', { p_campaign_id: campaignId, p_theme: theme }))
      },
    },
  }
}
