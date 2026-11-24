import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react'
import type { Api, Bucket } from '../lib/api'

export const ApiCtx = createContext<Api | null>(null)
export function useApi(): Api {
  const a = useContext(ApiCtx)
  if (!a) throw new Error('useApi outside provider')
  return a
}

/** Signed link for a private file; null while loading or if it fails. */
export function useFileUrl(bucket: Bucket, path: string | null | undefined): string | null {
  const api = useApi()
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let live = true
    setUrl(null)
    if (path) api.fileUrl(bucket, path).then((u) => live && setUrl(u), () => undefined)
    return () => {
      live = false
    }
  }, [api, bucket, path])
  return url
}

// ---- toast ----
const ToastCtx = createContext<(msg: string) => void>(() => undefined)
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<{ text: string; n: number } | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const show = useCallback((text: string) => {
    setMsg((m) => ({ text, n: (m?.n ?? 0) + 1 }))
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setMsg(null), 3800)
  }, [])
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="toast" role="status" aria-live="polite">
        {msg && <span key={msg.n}>{msg.text}</span>}
      </div>
    </ToastCtx.Provider>
  )
}

/** Label + control + hint/error. The control gets `id` and `aria-describedby` from the render prop. */
export function Field({ label, error, hint, children, aside }: {
  label: ReactNode
  error?: string | null
  hint?: ReactNode
  aside?: ReactNode
  children: (a: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) => ReactNode
}) {
  const id = useId()
  const msgId = `${id}-msg`
  const has = !!(error || hint)
  return (
    <div className="field">
      <div className="field-top">
        <label htmlFor={id}>{label}</label>
        {aside}
      </div>
      {children({ id, 'aria-describedby': has ? msgId : undefined, 'aria-invalid': error ? true : undefined })}
      {error ? <span id={msgId} className="hint bad" role="alert">{error}</span> : hint ? <span id={msgId} className="hint">{hint}</span> : null}
    </div>
  )
}

/** A choice group: native radio buttons styled as chips, so arrow keys and screen readers just work. */
export function Choice<T extends string>({ legend, options, value, onChange, error, variant = 'chips', render, aside, hideLegend }: {
  legend: ReactNode
  options: readonly T[]
  value: T | ''
  onChange(v: T): void
  error?: string | null
  variant?: 'chips' | 'seg' | 'sizes' | 'swatches'
  render?: (o: T) => ReactNode
  aside?: ReactNode
  hideLegend?: boolean
}) {
  const name = useId()
  return (
    <div className="choice" role="radiogroup" aria-labelledby={`${name}-l`} aria-invalid={error ? true : undefined}>
      <div className={hideLegend && !aside ? 'sr-only' : 'field-top'}>
        <span id={`${name}-l`} className={`label ${hideLegend ? 'sr-only' : ''}`}>{legend}</span>
        {aside}
      </div>
      <div className={`opts ${variant}`} style={variant === 'sizes' ? { ['--n' as string]: Math.min(options.length, 8) } : undefined}>
        {options.map((o) => (
          <label key={o} className="opt">
            <input type="radio" name={name} value={o} checked={o === value} onChange={() => onChange(o)} />
            <span>{render ? render(o) : o}</span>
          </label>
        ))}
      </div>
      {error && <span className="hint bad" role="alert">{error}</span>}
    </div>
  )
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="loading" role="status">
      <span className="spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

/** Bottom sheet / dialog built on <dialog>, so focus and Escape are handled by the browser. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose(): void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal?.()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog ref={ref} className="sheet" onClose={onClose} onClick={(e) => e.target === ref.current && onClose()} aria-label={title}>
      <div className="sheet-body">
        <div className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>×</button>
        </div>
        {children}
      </div>
    </dialog>
  )
}

/** Sticky action bar at the bottom of a step. */
export function Dock({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`dock ${className}`}>{children}</div>
}
