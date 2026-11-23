import { useCallback, useEffect, useState } from 'react'
import { ApiCtx, Spinner, ToastProvider } from './components/ui'
import type { Api, AuthUser } from './lib/api'
import { friendlyError } from './lib/api'
import type { OrderForm } from './lib/types'
import Admin from './pages/Admin'
import MyOrders from './pages/MyOrders'
import Order from './pages/Order'

type Tab = 'order' | 'orders' | 'admin'
const readTab = (): Tab => {
  const h = window.location.hash.replace(/^#\/?/, '')
  return h === 'orders' || h === 'admin' ? h : 'order'
}

/** Google's in-app browsers (WhatsApp, Instagram…) block Google sign-in. */
const IN_APP = /FBAN|FBAV|Instagram|WhatsApp|Line\/|LinkedInApp|Snapchat|; wv\)/i.test(navigator.userAgent)

/** Error Supabase puts in the URL when the sign-up trigger refuses a non-MDI account. */
function readRedirectError(): string | null {
  const params = new URLSearchParams(window.location.search || window.location.hash.replace(/^#\/?/, ''))
  const desc = params.get('error_description')
  if (!desc) return null
  window.history.replaceState(null, '', window.location.pathname)
  return /database error|mdi\.ac\.in/i.test(desc) ? 'Use your @mdi.ac.in Google account. Other accounts can’t order.' : desc
}

export default function App({ api }: { api: Api }) {
  return (
    <ApiCtx.Provider value={api}>
      <ToastProvider>
        <Shell api={api} />
      </ToastProvider>
    </ApiCtx.Provider>
  )
}

function Shell({ api }: { api: Api }) {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined)
  const [form, setForm] = useState<OrderForm | null>(null)
  const [error, setError] = useState<string | null>(() => readRedirectError())
  const [tab, setTab] = useState<Tab>(readTab)
  const [placed, setPlaced] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const u = await api.getUser()
      setUser(u)
      setForm(u ? await api.getForm() : null)
    } catch (e) {
      setError(friendlyError(e))
      setUser((u) => u ?? null)
    }
  }, [api])

  useEffect(() => {
    void refresh()
    return api.onAuthChange(() => void refresh())
  }, [api, refresh])

  useEffect(() => {
    const on = () => setTab(readTab())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])

  // Keep the form current: the live QR may rotate or the round close while a student is
  // paying in their UPI app. Reload it on opening the Order tab and on coming back to the page.
  const signedIn = !!user
  useEffect(() => {
    if (!signedIn || tab !== 'order') return
    const reload = () => api.getForm().then(setForm, () => undefined)
    void reload()
    const onVis = () => document.visibilityState === 'visible' && void reload()
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [api, signedIn, tab])

  const go = (t: Tab) => {
    window.location.hash = t === 'order' ? '/' : `/${t}`
    setTab(t)
    window.scrollTo(0, 0)
  }

  return (
    <>
      <header className="topbar">
        <div className="brand">MART<span>Order form</span></div>
        <div className="topbar-right">
          {api.mode === 'demo' && <span className="pill">Demo</span>}
          {user && <button type="button" className="link small" onClick={() => void api.signOut()}>Sign out</button>}
        </div>
      </header>

      {user && form && (
        <nav className="tabs" aria-label="Pages">
          <button type="button" aria-current={tab === 'order' ? 'page' : undefined} onClick={() => go('order')}>Order</button>
          <button type="button" aria-current={tab === 'orders' ? 'page' : undefined} onClick={() => go('orders')}>My orders</button>
          {form.is_form_admin && <button type="button" aria-current={tab === 'admin' ? 'page' : undefined} onClick={() => go('admin')}>Admin</button>}
        </nav>
      )}

      <main className="main">
        {user === undefined ? (
          <Spinner />
        ) : !user ? (
          <Login api={api} error={error} />
        ) : !form ? (
          error ? <section className="panel"><p className="error">{error}</p><button type="button" className="btn" onClick={() => void refresh()}>Try again</button></section> : <Spinner />
        ) : tab === 'orders' ? (
          <MyOrders justPlaced={placed} />
        ) : tab === 'admin' && form.is_form_admin ? (
          <Admin />
        ) : placed ? (
          <section className="panel stack">
            <span className="eyebrow">Done</span>
            <h2>Order placed</h2>
            <p className="lede">MART will check your payment. You'll see each item move to “Ready to collect” in My orders.</p>
            <div className="actions">
              <button type="button" className="btn primary" onClick={() => go('orders')}>See my orders</button>
              <button type="button" className="btn" onClick={() => { setPlaced(null); void refresh() }}>Place another order</button>
            </div>
          </section>
        ) : !form.round ? (
          <section className="panel stack">
            <h2>Orders are closed right now</h2>
            <p className="lede">Watch the MART group for the next round. Your past orders are under My orders.</p>
          </section>
        ) : (
          <Order form={form} user={user} onDone={(r) => setPlaced(r.order_id)} />
        )}
      </main>
    </>
  )
}

function Login({ api, error }: { api: Api; error: string | null }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(error)
  return (
    <section className="panel stack login">
      <span className="eyebrow">MDI Gurgaon · MART</span>
      <h1>Wear the batch.</h1>
      <p className="lede">Order MART merch: pick colour and size, see your name on the back, pay by UPI. Takes about two minutes.</p>
      {IN_APP && (
        <p className="warn-box note">
          You opened this inside another app. Google blocks sign-in here: tap ⋮ and choose <b>Open in Chrome</b> (or Safari).
        </p>
      )}
      {err && <p className="error" role="alert">{err}</p>}
      <button type="button" className="btn primary" disabled={busy} onClick={async () => {
        setBusy(true)
        setErr(null)
        try {
          await api.signIn()
        } catch (e) {
          setErr(friendlyError(e))
          setBusy(false)
        }
      }}>
        {busy ? 'Opening Google…' : 'Sign in with Google'}
      </button>
      <p className="muted small">Use your @mdi.ac.in account. You'll only ever see your own orders.</p>
    </section>
  )
}
