import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
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
  const [msg, setMsg] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const show = useCallback((m: string) => {
    setMsg(m)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setMsg(null), 3600)
  }, [])
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className="toast" role="status" aria-live="polite" hidden={!msg}>
        {msg}
      </div>
    </ToastCtx.Provider>
  )
}

export function Field({ label, error, hint, children, htmlFor }: { label: string; error?: string | null; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="field">
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {error ? <span className="hint warn">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  )
}

/** A row of pill buttons acting as radio buttons. */
export function Chips<T extends string>({ options, value, onChange, label, disabled }: {
  options: readonly T[]
  value: T | ''
  onChange(v: T): void
  label: string
  disabled?: (v: T) => boolean
}) {
  return (
    <div className="chips" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o} type="button" role="radio" aria-checked={o === value} className="chip" disabled={disabled?.(o)} onClick={() => onChange(o)}>
          {o}
        </button>
      ))}
    </div>
  )
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="center muted" role="status">
      <span className="spin" aria-hidden="true" /> {label}
    </div>
  )
}
