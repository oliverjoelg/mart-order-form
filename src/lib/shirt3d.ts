// 3D polo, ported from the 2026-11-20 prototype (claude.ai artifact "MART Tee Studio").
// Stand-in until the real photogrammetry .glb arrives; same inputs, so it can be swapped later.
// The print (MDI logo, back emblem with batch, name) is drawn on a canvas and wrapped round the
// body: u = 0.25 is the back centre, u = 0.75 the front centre.
import * as THREE from 'three'
import type { Swatch } from './colours'

export interface ShirtLook {
  swatch: Swatch
  name: string
  batch: string // "PG'26"
}

export interface ShirtScene {
  update(look: ShirtLook): void
  /** 0 = front, Math.PI = back */
  setAngle(a: number): void
  dispose(): void
}

const TW = 2048
const TH = 1024
const SQUASH = 0.83 // the body is wider round the front than the texture assumes
const H = 2.6
const TOP = 0.78 + H * 0.2 * 0.9

const smooth = (a: number, b: number, t: number) => {
  t = Math.max(0, Math.min(1, (t - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16)
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + 255 * amt)))
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`
}

function setFont(c: CanvasRenderingContext2D, f: string, stretch: CanvasFontStretch = 'normal') {
  c.font = `${f}, "Arial Black", sans-serif`
  if ('fontStretch' in c) c.fontStretch = stretch
}
function spacing(c: CanvasRenderingContext2D, v: string) {
  if ('letterSpacing' in c) (c as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = v
}

function knitGrain(): HTMLCanvasElement {
  const cv = document.createElement('canvas')
  cv.width = cv.height = 128
  const g = cv.getContext('2d')!
  const img = g.createImageData(128, 128)
  for (let i = 0; i < img.data.length; i += 4) {
    const px = (i / 4) % 128
    const py = Math.floor(i / 4 / 128)
    const v = ((px >> 1) + (py >> 1)) % 2 ? 255 : 0
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v
    img.data[i + 3] = 4 + Math.random() * 8
  }
  g.putImageData(img, 0, 0)
  return cv
}

function bumpMap(): HTMLCanvasElement {
  const cv = document.createElement('canvas')
  cv.width = 1024
  cv.height = 512
  const g = cv.getContext('2d')!
  const img = g.createImageData(1024, 512)
  for (let y = 0; y < 512; y++)
    for (let x = 0; x < 1024; x++) {
      const i = (y * 1024 + x) * 4
      const v = (x % 3 < 2 && y % 3 < 2 ? 150 : 110) + (Math.random() - 0.5) * 30
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v
      img.data[i + 3] = 255
    }
  g.putImageData(img, 0, 0)
  return cv
}

function drawArt(c: CanvasRenderingContext2D, grain: HTMLCanvasElement, look: ShirtLook) {
  const p = look.swatch
  const year = look.batch.replace(/\D/g, '') || '26'
  c.save()
  c.fillStyle = p.base
  c.fillRect(0, 0, TW, TH)
  const hem = c.createLinearGradient(0, 0, 0, TH)
  hem.addColorStop(0, 'rgba(0,0,0,0)')
  hem.addColorStop(0.85, 'rgba(0,0,0,0)')
  hem.addColorStop(1, 'rgba(0,0,0,0.10)')
  c.fillStyle = hem
  c.fillRect(0, 0, TW, TH)
  c.fillStyle = c.createPattern(grain, 'repeat')!
  c.fillRect(0, 0, TW, TH)
  for (const x of [0, 1024, 2048]) {
    c.fillStyle = 'rgba(0,0,0,0.12)'
    c.fillRect(x - 3, 0, 6, TH)
  }
  c.strokeStyle = 'rgba(0,0,0,0.18)'
  c.lineWidth = 2
  c.setLineDash([8, 6])
  c.beginPath()
  c.moveTo(0, TH - 26)
  c.lineTo(TW, TH - 26)
  c.stroke()
  c.setLineDash([])

  // front: placket, buttons, chest logo
  c.save()
  c.translate(1536, 0)
  c.scale(SQUASH, 1)
  c.fillStyle = 'rgba(0,0,0,0.06)'
  c.fillRect(-26, 0, 52, 300)
  c.strokeStyle = 'rgba(0,0,0,0.22)'
  c.lineWidth = 3
  c.beginPath()
  c.moveTo(-26, 0)
  c.lineTo(-26, 300)
  c.lineTo(26, 300)
  c.lineTo(26, 0)
  c.stroke()
  for (const y of [150, 235]) {
    c.fillStyle = 'rgba(0,0,0,0.25)'
    c.beginPath()
    c.arc(0, y + 2, 11, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = shade(p.base, 0.06)
    c.beginPath()
    c.arc(0, y, 10, 0, Math.PI * 2)
    c.fill()
    c.fillStyle = 'rgba(0,0,0,0.35)'
    for (const [dx, dy] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) {
      c.beginPath()
      c.arc(dx, y + dy, 1.8, 0, 7)
      c.fill()
    }
  }
  c.fillStyle = p.ink
  c.textAlign = 'center'
  c.textBaseline = 'alphabetic'
  setFont(c, '800 54px Archivo', 'expanded')
  c.fillText('MDI', 175, 350)
  c.restore()

  // back: MDI, institute line, emblem with batch, rule, name
  c.save()
  c.translate(512, 0)
  c.scale(SQUASH, 1)
  c.fillStyle = p.ink
  c.textAlign = 'center'
  setFont(c, '900 128px Archivo', 'expanded')
  spacing(c, '4px')
  c.fillText('MDI', 0, 330)
  spacing(c, '3px')
  c.fillStyle = p.sub
  setFont(c, '600 17px Archivo', 'expanded')
  c.fillText('MANAGEMENT DEVELOPMENT INSTITUTE', 0, 368)
  spacing(c, '0px')
  c.strokeStyle = p.sub
  c.lineWidth = 5
  c.lineCap = 'round'
  const baseY = 548
  for (let i = 0; i < 10; i++) {
    const x = -196 + i * 17
    c.beginPath()
    c.moveTo(x, baseY)
    c.lineTo(x, baseY - (34 + i * 10))
    c.stroke()
  }
  c.beginPath()
  c.moveTo(-204, baseY - 30)
  c.lineTo(-30, baseY - 132)
  c.stroke()
  c.beginPath()
  c.moveTo(-204, baseY)
  c.lineTo(-30, baseY)
  c.stroke()
  c.strokeStyle = p.ink
  c.lineWidth = 4
  c.beginPath()
  c.arc(40, 480, 104, Math.PI * 0.62, Math.PI * 2.2)
  c.stroke()
  c.fillStyle = p.ink
  c.textAlign = 'left'
  setFont(c, '700 58px Archivo', 'expanded')
  c.fillText("PG'", 20, 470)
  setFont(c, '900 74px Archivo', 'expanded')
  c.fillText(year, 22, 540)
  c.strokeStyle = p.sub
  c.lineWidth = 3
  c.beginPath()
  c.moveTo(-230, 596)
  c.lineTo(230, 596)
  c.stroke()
  c.fillStyle = p.ink
  c.beginPath()
  c.arc(0, 596, 7, 0, Math.PI * 2)
  c.fill()
  if (look.name) {
    c.textAlign = 'center'
    let size = 54
    c.font = `${size}px Michroma, Archivo, sans-serif`
    spacing(c, '6px')
    while (c.measureText(look.name).width > 470 && size > 30) {
      size -= 2
      c.font = `${size}px Michroma, Archivo, sans-serif`
    }
    c.fillText(look.name, 0, 668)
    spacing(c, '0px')
  }
  c.restore()
  c.restore()
}

function torsoGeometry(): THREE.BufferGeometry {
  const SEG_R = 96
  const SEG_H = 60
  const geo = new THREE.CylinderGeometry(1, 1, H, SEG_R, SEG_H, true, Math.PI / 2, Math.PI * 2)
  const pos = geo.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    let y = pos.getY(i)
    const z = pos.getZ(i)
    const t = (y + H / 2) / H
    let r = 0.95 + 0.06 * smooth(0.3, 0.72, t) + 0.025 * (1 - smooth(0, 0.25, t))
    if (t > 0.8) {
      const s = (t - 0.8) / 0.2
      r *= 0.36 + 0.64 * Math.pow(Math.max(0, 1 - s * s), 0.8)
      y = 0.78 + (y - 0.78) * 0.9
    }
    const zs = 0.5 + 0.32 * smooth(0.82, 1, t)
    const theta = Math.atan2(x, z)
    const drape = (1 - smooth(0, 0.35, t)) * 0.012 * Math.sin(theta * 5)
    pos.setXYZ(i, x * (r + drape), y, z * (r + drape) * zs)
  }
  geo.computeVertexNormals()
  // weld the seam normals so there is no visible line down the side
  const nrm = geo.attributes.normal as THREE.BufferAttribute
  const cols = SEG_R + 1
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  for (let iy = 0; iy <= SEG_H; iy++) {
    const ia = iy * cols
    const ib = iy * cols + SEG_R
    a.fromBufferAttribute(nrm, ia)
    b.fromBufferAttribute(nrm, ib)
    a.add(b).normalize()
    nrm.setXYZ(ia, a.x, a.y, a.z)
    nrm.setXYZ(ib, a.x, a.y, a.z)
  }
  nrm.needsUpdate = true
  return geo
}

export function createShirtScene(canvas: HTMLCanvasElement, host: HTMLElement, look: ShirtLook): ShirtScene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100)
  scene.add(new THREE.HemisphereLight(0xffffff, 0x7b8090, 2.2))
  const lights: [number, number, [number, number, number]][] = [
    [0xffffff, 3.4, [3, 4, 5]], [0xdfe6ff, 1.0, [-5, 1, 2]], [0xffffff, 2.0, [-2, 3, -5]], [0xffffff, 1.3, [3, 2, -4]],
  ]
  for (const [col, k, p] of lights) {
    const l = new THREE.DirectionalLight(col, k)
    l.position.set(...p)
    scene.add(l)
  }

  const art = document.createElement('canvas')
  art.width = TW
  art.height = TH
  const actx = art.getContext('2d')!
  const grain = knitGrain()
  const tex = new THREE.CanvasTexture(art)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy()
  const bumpTex = new THREE.CanvasTexture(bumpMap())

  const bodyMat = new THREE.MeshStandardMaterial({ map: tex, bumpMap: bumpTex, bumpScale: 0.035, roughness: 0.93, metalness: 0 })
  const trimMat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, side: THREE.DoubleSide })
  const innerMat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, side: THREE.DoubleSide })

  const shirt = new THREE.Group()
  shirt.add(new THREE.Mesh(torsoGeometry(), bodyMat))

  const hemInside = new THREE.Mesh(new THREE.CylinderGeometry(0.99, 0.99, 0.5, 64, 1, true), innerMat)
  hemInside.scale.set(0.9, 1, 0.43)
  hemInside.position.y = -1.04
  shirt.add(hemInside)

  const hemRing = new THREE.Group()
  const hemTorus = new THREE.Mesh(new THREE.TorusGeometry(1, 0.018, 8, 96), trimMat)
  hemTorus.rotation.x = Math.PI / 2
  hemRing.add(hemTorus)
  hemRing.scale.set(0.975, 1, 0.488)
  hemRing.position.y = -H / 2 + 0.005
  shirt.add(hemRing)

  const sleeve = (side: 1 | -1) => {
    const g = new THREE.Group()
    const L = 0.85
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.3, L, 48, 1, false), trimMat))
    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.022, 8, 48), trimMat)
    cuff.rotation.x = Math.PI / 2
    cuff.position.y = -L / 2
    g.add(cuff)
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.285, 40), innerMat)
    hole.rotation.x = Math.PI / 2
    hole.position.y = -L / 2 - 0.002
    g.add(hole)
    g.scale.z = 0.62
    const dir = new THREE.Vector2(0.72, -0.69).normalize()
    g.rotation.z = (side * Math.PI) / 4
    g.position.set(side * (0.7 + (dir.x * L) / 2), 0.66 + (dir.y * L) / 2, 0)
    return g
  }
  shirt.add(sleeve(1), sleeve(-1))

  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.36, 0.15, 64, 1, true), trimMat)
  stand.scale.z = 0.82
  stand.position.y = TOP + 0.05
  shirt.add(stand)
  const fall = new THREE.Mesh(new THREE.CylinderGeometry(0.41, 0.58, 0.2, 64, 1, true), trimMat)
  fall.scale.z = 0.84
  fall.position.y = TOP
  shirt.add(fall)
  const neck = new THREE.Mesh(new THREE.CircleGeometry(0.37, 48), innerMat)
  neck.rotation.x = -Math.PI / 2
  neck.scale.y = 0.82
  neck.position.y = TOP - 0.02
  shirt.add(neck)
  scene.add(shirt)

  // soft floor shadow
  const sh = document.createElement('canvas')
  sh.width = sh.height = 256
  const sg = sh.getContext('2d')!
  const rg = sg.createRadialGradient(128, 128, 0, 128, 128, 128)
  rg.addColorStop(0, 'rgba(0,0,0,0.38)')
  rg.addColorStop(0.6, 'rgba(0,0,0,0.12)')
  rg.addColorStop(1, 'rgba(0,0,0,0)')
  sg.fillStyle = rg
  sg.fillRect(0, 0, 256, 256)
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 1.3),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sh), transparent: true, depthWrite: false }),
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = -1.62
  scene.add(shadow)

  let current = look
  const paint = () => {
    drawArt(actx, grain, current)
    tex.needsUpdate = true
    const lin = new THREE.Color(current.swatch.base)
    trimMat.color.copy(lin)
    innerMat.color.copy(lin).multiplyScalar(0.45)
  }
  paint()
  // repaint once the print fonts have loaded (the first paint may use fallbacks)
  void document.fonts?.ready.then(paint)

  const resize = () => {
    const w = host.clientWidth
    const h = host.clientHeight
    if (!w || !h) return
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    const half = THREE.MathUtils.degToRad(camera.fov / 2)
    const d = Math.max(3.15 / 2 / Math.tan(half), 3.25 / 2 / (Math.tan(half) * camera.aspect)) * 1.08
    camera.position.set(0, 0.55, d)
    camera.lookAt(0, -0.12, 0)
    camera.updateProjectionMatrix()
  }
  const ro = new ResizeObserver(resize)
  ro.observe(host)
  resize()

  // turning: target angle from the form, plus drag; eased each frame
  let target = 0
  let shown = 0
  let drag = 0
  let dragging = false
  let lastX = 0
  let lastDragAt = -1e9
  const down = (e: PointerEvent) => {
    dragging = true
    lastX = e.clientX
    canvas.setPointerCapture(e.pointerId)
  }
  const move = (e: PointerEvent) => {
    if (!dragging) return
    drag += (e.clientX - lastX) * 0.012
    lastX = e.clientX
    lastDragAt = performance.now()
  }
  const up = () => {
    if (!dragging) return
    dragging = false
    lastDragAt = performance.now()
    const k = Math.round(drag / (Math.PI * 2))
    drag -= k * Math.PI * 2
    shown -= k * Math.PI * 2
  }
  canvas.addEventListener('pointerdown', down)
  canvas.addEventListener('pointermove', move)
  canvas.addEventListener('pointerup', up)
  canvas.addEventListener('pointercancel', up)

  let raf = 0
  let alive = true
  const start = performance.now()
  const tick = (now: number) => {
    if (!alive) return
    if (document.hidden) {
      raf = requestAnimationFrame(tick)
      return
    }
    if (!dragging && now - lastDragAt > 1800) drag *= 0.93
    const sway = target === 0 && !dragging ? Math.sin((now - start) / 1400) * 0.18 : 0
    shown += (target + sway + drag - shown) * (dragging ? 0.5 : 0.12)
    shirt.rotation.y = shown
    renderer.render(scene, camera)
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)

  return {
    update(l) {
      current = l
      paint()
    },
    setAngle(a) {
      target = a
    },
    dispose() {
      alive = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointercancel', up)
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose()
          const m = o.material as THREE.Material & { map?: THREE.Texture | null }
          m.map?.dispose()
          m.dispose()
        }
      })
      bumpTex.dispose()
      renderer.dispose()
    },
  }
}
