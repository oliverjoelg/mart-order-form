import { useEffect, useRef } from 'react'
import { swatch } from '../lib/colours'
import { createShirtScene, type ShirtScene } from '../lib/shirt3d'
import type { ShirtView } from './ShirtStage'

interface Props {
  colour: string
  printName: string
  printBatch: string
  view: ShirtView
  onFlip(): void
  /** WebGL failed after all: show the 2D shirt instead */
  onFail(): void
}

/** Loaded on demand (three.js is ~150 KB gzipped), so the form opens fast. */
export default function Shirt3D({ colour, printName, printBatch, view, onFlip, onFail }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const scene = useRef<ShirtScene | null>(null)
  const look = { swatch: swatch(colour), name: printName, batch: printBatch }
  const lookRef = useRef(look)
  lookRef.current = look

  useEffect(() => {
    try {
      scene.current = createShirtScene(canvas.current!, host.current!, lookRef.current)
    } catch {
      onFail()
      return
    }
    return () => {
      scene.current?.dispose()
      scene.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    scene.current?.update({ swatch: swatch(colour), name: printName, batch: printBatch })
  }, [colour, printName, printBatch])

  useEffect(() => {
    scene.current?.setAngle(view === 'back' ? Math.PI : 0)
  }, [view])

  // a tap (not a drag) turns the shirt round
  const downAt = useRef<{ x: number; y: number } | null>(null)
  return (
    <div ref={host} className="shirt3d">
      <canvas
        ref={canvas}
        aria-label={`3D preview of the ${colour} shirt, showing the ${view}. Drag to turn, tap to flip.`}
        role="img"
        onPointerDown={(e) => (downAt.current = { x: e.clientX, y: e.clientY })}
        onPointerUp={(e) => {
          const d = downAt.current
          downAt.current = null
          if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) onFlip()
        }}
      />
    </div>
  )
}
