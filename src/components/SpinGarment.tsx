import { useEffect, useRef } from 'react'
import type { Garment as GarmentKind } from '../lib/theme'
import { Garment, type ShirtView } from './ShirtStage'

const face = (v: ShirtView) => (v === 'back' ? 180 : 0)
/** the angle nearest `near` that shows `deg` (mod 360) */
const nearest = (deg: number, near: number) => deg + 360 * Math.round((near - deg) / 360)
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * The garment as a two-sided card that turns in 3D.
 * - Scrolling the page spins it one full turn over the first screen, landing where it started.
 * - Drag (or arrow keys) spins it by hand; let go and it settles on the nearer side.
 * - On a mouse, it leans toward the pointer. `spin` going up does a victory turn (Add to bag).
 * Everything runs on one requestAnimationFrame loop writing a transform: no React re-renders.
 */
export default function SpinGarment({ garment, colour, printName, printBatch, view = 'back', onView, spin = 0, label, auto = false }: {
  garment: GarmentKind; colour: string; printName: string; printBatch: string
  view?: ShirtView; onView?(v: ShirtView): void; spin?: number; label: string
  /** keeps turning slowly by itself (sign-in, confirmation) */
  auto?: boolean
}) {
  const box = useRef<HTMLDivElement>(null)
  const rig = useRef<HTMLDivElement>(null)
  // starts a turn and a half behind, so it whirls in on arrival
  const m = useRef({ base: face(view), shown: face(view) - (reduced() ? 0 : 540), drag: 0, dragging: false, x: 0, tiltX: 0, tiltY: 0, scroll: 0, wheelT: 0 })
  const viewRef = useRef(view)
  viewRef.current = view
  const onViewRef = useRef(onView)
  onViewRef.current = onView
  const autoRef = useRef(auto)
  autoRef.current = auto

  // a new side was picked (buttons, a field focusing the back): turn the short way round
  useEffect(() => {
    const s = m.current
    s.base = nearest(face(view), s.shown - s.scroll - s.drag)
  }, [view])

  // victory turn after Add to bag
  const lastSpin = useRef(spin)
  useEffect(() => {
    if (spin !== lastSpin.current) {
      lastSpin.current = spin
      m.current.base += 360
    }
  }, [spin])

  useEffect(() => {
    const s = m.current
    const el = box.current!
    let raf = 0
    const settle = () => {
      // let go: land on whichever side is nearer to the viewer
      const total = s.base + s.drag
      const side: ShirtView = Math.abs((((total % 360) + 360) % 360) - 180) < 90 ? 'back' : 'front'
      s.base = nearest(face(side), total)
      s.drag = 0
      if (side !== viewRef.current) onViewRef.current?.(side)
    }
    const loop = () => {
      // one full turn over the first stretch of page scroll (up to 90% of a screen); --p tells the CSS how far
      const page = document.scrollingElement!
      const span = Math.min(page.scrollHeight - window.innerHeight, window.innerHeight * 0.9)
      const p = span > 40 ? Math.min(1, Math.max(0, window.scrollY / span)) : 0
      s.scroll = p * 360
      el.closest<HTMLElement>('.cz')?.style.setProperty('--p', p.toFixed(3))
      if (autoRef.current && !s.dragging && !reduced()) s.base += 0.5
      const goal = s.base + s.scroll + s.drag
      s.shown += (goal - s.shown) * (s.dragging || reduced() ? 1 : 0.11)
      const a = s.shown
      const cos = Math.cos((a * Math.PI) / 180)
      rig.current!.style.transform = `rotateX(${s.tiltY}deg) rotateY(${a + s.tiltX}deg)`
      el.style.setProperty('--edge', Math.abs(cos).toFixed(3))
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    const down = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('button, a, input')) return
      s.dragging = true
      s.x = e.clientX
      el.setPointerCapture(e.pointerId)
    }
    const move = (e: PointerEvent) => {
      if (s.dragging) {
        s.drag += (e.clientX - s.x) * 0.6
        s.x = e.clientX
      } else if (e.pointerType === 'mouse' && !reduced()) {
        const r = el.getBoundingClientRect()
        s.tiltX = ((e.clientX - r.left) / r.width - 0.5) * 16
        s.tiltY = -((e.clientY - r.top) / r.height - 0.5) * 10
      }
    }
    const up = () => {
      if (!s.dragging) return
      s.dragging = false
      settle()
    }
    const leave = () => {
      s.tiltX = 0
      s.tiltY = 0
    }
    // a wheel over the garment spins it when there's nothing to scroll (laptop customiser fits one screen)
    const wheel = (e: WheelEvent) => {
      const page = document.scrollingElement!
      if (page.scrollHeight > page.clientHeight + 4) return
      e.preventDefault()
      s.drag += e.deltaY * 0.5
      window.clearTimeout(s.wheelT)
      s.wheelT = window.setTimeout(settle, 220)
    }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    el.addEventListener('pointerleave', leave)
    el.addEventListener('wheel', wheel, { passive: false })
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(s.wheelT)
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      el.removeEventListener('pointerleave', leave)
      el.removeEventListener('wheel', wheel)
    }
  }, [])

  const art = { colour, printName, printBatch }
  return (
    <div className={`gspin${auto ? ' auto' : ''}`} ref={box} role="img" aria-label={label} tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault()
          if (onView) onView(view === 'back' ? 'front' : 'back')
          else m.current.base += 180
        }
      }}>
      <div className="gspin-shadow" aria-hidden="true" />
      <div className="gspin-float">
        <div className="gspin-rig" ref={rig}>
          <div className="gspin-face front"><Garment garment={garment} side="front" {...art} /></div>
          <div className="gspin-face back"><Garment garment={garment} side="back" {...art} /></div>
        </div>
      </div>
    </div>
  )
}
