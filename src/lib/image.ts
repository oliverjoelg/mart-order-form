// Shrinks a phone screenshot to about 200 KB before upload (the bucket refuses files over 1 MB).
// Screenshots are tall and mostly text, so we keep the width readable and step quality down.

const TARGET = 200 * 1024

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not read that image'))), 'image/jpeg', quality),
  )
}

export async function compressImage(file: File, maxSide = 1400): Promise<Blob> {
  if (!/^image\//.test(file.type)) throw new Error('Pick an image (a screenshot of your payment)')
  const bmp = await createImageBitmap(file)
  let scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
  let best: Blob | null = null
  for (let pass = 0; pass < 4; pass++) {
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bmp.width * scale))
    canvas.height = Math.max(1, Math.round(bmp.height * scale))
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    for (const q of [0.82, 0.7, 0.58, 0.46]) {
      best = await toBlob(canvas, q)
      if (best.size <= TARGET) return best
    }
    scale *= 0.75
  }
  bmp.close?.()
  if (!best || best.size > 1024 * 1024) throw new Error('That image is too big even after shrinking. Crop it and try again.')
  return best
}
