// Falling snow for the Winter Hoodies theme: a canvas that fills its parent, behind the content.
// Colour from the --snow token. Reduced motion: a still scatter of flakes. Pauses when the tab is hidden.
import { useEffect, useRef } from 'react'

interface Flake { x: number; y: number; r: number; v: number; drift: number; phase: number }

export default function Snow({ density = 1 }: { density?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const host = canvas?.parentElement
    const ctx = canvas?.getContext('2d')
    if (!canvas || !host || !ctx) return
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let flakes: Flake[] = []
    let w = 0
    let h = 0
    let raf = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const colour = () => getComputedStyle(canvas).getPropertyValue('--snow').trim() || 'rgba(255,255,255,.85)'
    let fill = colour()

    const make = (y?: number): Flake => ({
      x: Math.random() * w,
      y: y ?? Math.random() * h,
      r: 0.8 + Math.random() * 2.2,
      v: 0.25 + Math.random() * 0.7,
      drift: 0.3 + Math.random() * 0.6,
      phase: Math.random() * Math.PI * 2,
    })
    const resize = () => {
      w = host.clientWidth
      h = host.clientHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const n = Math.round(Math.min(160, (w * h) / 9000) * density)
      flakes = Array.from({ length: n }, () => make())
      fill = colour()
      draw()
    }
    const draw = () => {
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = fill
      for (const f of flakes) {
        ctx.beginPath()
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    const tick = (t: number) => {
      if (!document.hidden) {
        for (const f of flakes) {
          f.y += f.v
          f.x += Math.sin(t / 1600 + f.phase) * f.drift * 0.4
          if (f.y > h + 4) Object.assign(f, make(-4))
          if (f.x > w + 4) f.x = -4
          if (f.x < -4) f.x = w + 4
        }
        draw()
      }
      raf = requestAnimationFrame(tick)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(host)
    resize()
    if (!still) raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [density])

  return <canvas ref={ref} className="snow" aria-hidden="true" />
}
