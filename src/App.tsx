import { useCallback, useEffect, useState } from 'react'
import Snow from './components/Snow'
import SpinGarment from './components/SpinGarment'
import { ApiCtx, Spinner, ToastProvider } from './components/ui'
import type { Api, AuthUser } from './lib/api'
import { friendlyError } from './lib/api'
import type { Line } from './lib/order'
import { redirectErrorMessage } from './lib/redirect'
import { applySkin, resolveTheme, ThemeCtx, useTheme, type Theme, type ThemeId } from './lib/theme'
import type { OrderForm, SubmitResult } from './lib/types'
import { inr } from './lib/validate'
import Admin from './pages/Admin'
import MyOrders from './pages/MyOrders'
import Order from './screens/Order'

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
  return redirectErrorMessage(desc)
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
  const [placed, setPlaced] = useState<{ r: SubmitResult; first?: Line; colour: string } | null>(null)
  const [look, setLook] = useState<ThemeId>('tees')
  const theme: Theme = resolveTheme(look)
  useEffect(() => applySkin(theme), [theme])

  // The round's look (set by MART super admins). Known before sign-in, so the sign-in page matches.
  const reloadLook = useCallback(() => api.getLook().then(setLook, () => undefined), [api])

  const refresh = useCallback(async () => {
    try {
      setError(null)
      void reloadLook()
      const u = await api.getUser()
      setUser(u)
      setForm(u ? await api.getForm() : null)
    } catch (e) {
      setError(friendlyError(e))
      setUser((u) => u ?? null)
    }
  }, [api, reloadLook])

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
    const reload = () => {
      void reloadLook()
      return api.getForm().then(setForm, () => undefined)
    }
    void reload()
    const onVis = () => document.visibilityState === 'visible' && void reload()
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [api, signedIn, tab, reloadLook])

  const go = (t: Tab) => {
    window.location.hash = t === 'order' ? '/' : `/${t}`
    setTab(t)
    window.scrollTo(0, 0)
  }

  const page = user === undefined ? 'boot' : !user ? 'login' : 'app'

  return (
    <ThemeCtx.Provider value={theme}>
    <div className={`app page-${page} tab-${tab}`}>
      <header className="topbar">
        <a className="wordmark" href="#/" onClick={(e) => { e.preventDefault(); go('order') }} aria-label="MART order form, home">
          MART{api.mode === 'demo' && <span className="demo">Demo</span>}
        </a>
        {user && form && (
          <nav className="tabs" aria-label="Pages">
            <a href="#/" aria-current={tab === 'order' ? 'page' : undefined} onClick={(e) => { e.preventDefault(); go('order') }}>Order</a>
            <a href="#/orders" aria-current={tab === 'orders' ? 'page' : undefined} onClick={(e) => { e.preventDefault(); go('orders') }}>My orders</a>
            {form.is_form_admin && <a href="#/admin" aria-current={tab === 'admin' ? 'page' : undefined} onClick={(e) => { e.preventDefault(); go('admin') }}>Admin</a>}
          </nav>
        )}
      </header>

      <main className="main" id="main">
        {user === undefined ? (
          <Spinner />
        ) : !user ? (
          <Login api={api} error={error} />
        ) : !form ? (
          error ? (
            <section className="empty">
              <h1>Couldn't load the form.</h1>
              <p className="error" role="alert">{error}</p>
              <div className="actions"><button type="button" className="btn primary" onClick={() => void refresh()}>Try again</button></div>
            </section>
          ) : <Spinner label="Loading the form…" />
        ) : tab === 'orders' ? (
          <MyOrders justPlaced={placed?.r.order_id} onOrder={() => go('order')} />
        ) : tab === 'admin' && form.is_form_admin ? (
          <Admin onLook={() => void reloadLook()} />
        ) : placed ? (
          <Done r={placed.r} first={placed.first} colour={placed.colour} onOrders={() => go('orders')} onAgain={() => { setPlaced(null); void refresh() }} />
        ) : !form.round ? (
          <Closed teamOnly={form.team_only_round_open} onOrders={() => go('orders')} />
        ) : (
          <Order form={form} user={user} onDone={(r, first) => { setPlaced({ r, first, colour: form.products.find((p) => p.id === first?.product_id)?.colour ?? '' }); window.scrollTo(0, 0) }} />
        )}
      </main>
    </div>
    </ThemeCtx.Provider>
  )
}

/** The sign-in picture: the round's garment turning slowly inside its orbit, with a name on the back. */
const SHOW_COLOUR = { polo: 'Navy Blue', hoodie: 'Black' } as const
function Showcase({ name = 'YOUR NAME', colour, batch = "PG'27" }: { name?: string; colour?: string; batch?: string }) {
  const theme = useTheme()
  return (
    <div className="show" aria-hidden="true">
      <div className="cz-orbit" />
      <div className="cz-orbit two" />
      <span className="sparkle s1" /><span className="sparkle s2" /><span className="sparkle s3" />
      <SpinGarment auto garment={theme.garment} colour={colour ?? SHOW_COLOUR[theme.garment]} printName={name} printBatch={batch} label="" />
    </div>
  )
}

function Login({ api, error }: { api: Api; error: string | null }) {
  const theme = useTheme()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(error)
  return (
    <section className="login">
      {theme.snow && <div className="snow-layer"><Snow /></div>}
      <div className="login-copy">
        <p className="login-word" aria-hidden="true">{theme.word}</p>
        <h1 className="hero">{theme.heroLines.join(' ')}</h1>
        <p className="lede">{theme.lede}</p>
        {IN_APP && (
          <p className="callout">
            You opened this inside another app, and Google blocks sign-in there. Tap ⋮ and choose <b>Open in Chrome</b> (or Safari).
          </p>
        )}
        {err && <p className="error" role="alert">{err}</p>}
        <button type="button" className="btn primary big" disabled={busy} onClick={async () => {
          setBusy(true)
          setErr(null)
          try {
            await api.signIn()
          } catch (e) {
            setErr(friendlyError(e))
            setBusy(false)
          }
        }}>
          <GoogleG /> {busy ? 'Opening Google…' : 'Sign in with Google'}
        </button>
        <p className="fineprint">Use your @mdi.ac.in account. You'll only ever see your own orders.</p>
      </div>
      <Showcase />
      <div className="ticker" aria-hidden="true">
        <div className="ticker-track">
          {Array.from({ length: 2 }, (_, k) => (
            <span key={k}>{theme.ticker.map((t) => <span key={t} className="tick">{t} <i /></span>)}</span>
          ))}
        </div>
      </div>
    </section>
  )
}

function GoogleG() {
  return (
    <svg className="g" viewBox="0 0 48 48" aria-hidden="true" width="20" height="20">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

function Closed({ teamOnly, onOrders }: { teamOnly: boolean; onOrders(): void }) {
  const theme = useTheme()
  return (
    <section className="closed">
      {theme.snow && <div className="snow-layer"><Snow /></div>}
      <div className="login-copy">
        <p className="login-word" aria-hidden="true">{theme.word}</p>
        <h1 className="hero">Orders are closed.</h1>
        <p className="lede">
          {teamOnly
            ? 'Orders are open to the MART team only right now. Watch the MART group for when they open to everyone.'
            : theme.closedLede}
        </p>
        <div className="actions"><button type="button" className="btn ghost" onClick={onOrders}>See my orders</button></div>
      </div>
      <Showcase name="SOON" />
    </section>
  )
}

function Done({ r, first, colour, onOrders, onAgain }: { r: SubmitResult; first?: Line; colour: string; onOrders(): void; onAgain(): void }) {
  const code = r.order_id.replace(/-/g, '').slice(0, 8).toUpperCase()
  return (
    <section className="done-screen">
      <Showcase colour={colour} batch={first?.batch} name={first && !first.no_name ? first.name.trim() : ''} />
      <div className="done-copy" role="status">
        <p className="login-word" aria-hidden="true">dropped</p>
        <h1 className="hero">Order placed.</h1>
        <dl className="kv">
          <div><dt>Order</dt><dd className="print-face">{code}</dd></div>
          <div><dt>Items</dt><dd>{r.items}</dd></div>
          <div className="kv-total"><dt>Paid</dt><dd>{inr(r.total_inr)}</dd></div>
        </dl>
        <p className="lede">MART checks your payment next. Each item moves to “Ready to collect” in My orders, and MART calls you when it's there.</p>
        <div className="actions">
          <button type="button" className="btn primary" onClick={onOrders}>See my orders</button>
          <button type="button" className="btn ghost" onClick={onAgain}>Place another order</button>
        </div>
      </div>
    </section>
  )
}
