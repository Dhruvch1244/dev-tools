function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(`Could not decode '${file.name}' as an image.`))
    }
    img.src = url
  })
}

function loadImageFromSvgText(svgText: string): Promise<{ img: HTMLImageElement; url: string }> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgText], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => resolve({ img, url })
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not parse this as SVG.'))
    }
    img.src = url
  })
}

function parseSvgDimensions(svgText: string): { width: number; height: number } {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml')
  const root = doc.documentElement
  const wAttr = root.getAttribute('width')
  const hAttr = root.getAttribute('height')
  const viewBox = root.getAttribute('viewBox')
  let width = wAttr ? parseFloat(wAttr) : NaN
  let height = hAttr ? parseFloat(hAttr) : NaN
  if ((!width || !height) && viewBox) {
    const parts = viewBox.trim().split(/[\s,]+/).map(Number)
    if (parts.length === 4) {
      width = width || parts[2]
      height = height || parts[3]
    }
  }
  return { width: width || 512, height: height || 512 }
}

/** Rasterizes SVG text to a PNG or JPEG blob at the given pixel scale factor. */
export async function svgToRaster(svgText: string, format: 'png' | 'jpeg', scale = 2): Promise<Blob> {
  const { width, height } = parseSvgDimensions(svgText)
  const { img, url } = await loadImageFromSvgText(svgText)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width * scale))
    canvas.height = Math.max(1, Math.round(height * scale))
    const ctx = canvas.getContext('2d')!
    if (format === 'jpeg') {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode image.'))), `image/${format}`, 0.95)
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Wraps a raster image (base64) in a minimal SVG container — not a real vectorization, just an SVG wrapper. */
export async function rasterToSvgWrapper(file: File): Promise<string> {
  const dataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
  const img = await loadImageFromFile(file)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${img.width}" height="${img.height}" viewBox="0 0 ${img.width} ${img.height}"><image href="${dataUrl}" width="${img.width}" height="${img.height}"/></svg>`
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

/** Simple k-means over RGB — a handful of iterations is plenty for flat-color logo/icon art. */
function quantizeColors(data: Uint8ClampedArray, k: number, iterations = 8): { centroids: [number, number, number][]; labels: Uint8Array } {
  const n = data.length / 4
  const centroids: [number, number, number][] = []
  for (let i = 0; i < k; i++) {
    const idx = Math.floor((i / k) * n) * 4
    centroids.push([data[idx], data[idx + 1], data[idx + 2]])
  }
  const labels = new Uint8Array(n)
  for (let iter = 0; iter < iterations; iter++) {
    for (let p = 0; p < n; p++) {
      const r = data[p * 4];
      const g = data[p * 4 + 1];
      const b = data[p * 4 + 2]
      let best = 0
      let bestDist = Infinity
      for (let c = 0; c < k; c++) {
        const [cr, cg, cb] = centroids[c]
        const d = (r - cr) ** 2 + (g - cg) ** 2 + (b - cb) ** 2
        if (d < bestDist) {
          bestDist = d
          best = c
        }
      }
      labels[p] = best
    }
    const sums = Array.from({ length: k }, () => [0, 0, 0, 0])
    for (let p = 0; p < n; p++) {
      const c = labels[p]
      sums[c][0] += data[p * 4]
      sums[c][1] += data[p * 4 + 1]
      sums[c][2] += data[p * 4 + 2]
      sums[c][3]++
    }
    for (let c = 0; c < k; c++) {
      if (sums[c][3] > 0) centroids[c] = [sums[c][0] / sums[c][3], sums[c][1] / sums[c][3], sums[c][2] / sums[c][3]]
    }
  }
  return { centroids, labels }
}

export type TraceOptions = { colors: number; maxDimension: number }

/**
 * Client-side raster→SVG "tracer": downscales, quantizes to `colors` flat colors via k-means, then
 * emits one <rect> per horizontal run of same-color pixels (scaled back to the original image size).
 * This is deliberately a mosaic/pixel-run vectorization, not smooth curve tracing — always produces
 * valid, non-self-intersecting SVG, at the cost of blocky edges at low `maxDimension`. Works best on
 * flat-color logos/icons, not photos.
 */
export async function traceImageToSvg(file: File, opts: TraceOptions): Promise<{ svg: string; width: number; height: number }> {
  const img = await loadImageFromFile(file)
  const scale = Math.min(1, opts.maxDimension / Math.max(img.width, img.height))
  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0, w, h)
  const { data } = ctx.getImageData(0, 0, w, h)

  const k = Math.max(2, Math.min(24, opts.colors))
  const { centroids, labels } = quantizeColors(data, k)

  const areas = new Array(k).fill(0)
  for (let i = 0; i < labels.length; i++) areas[labels[i]]++
  const order = Array.from({ length: k }, (_, i) => i).sort((a, b) => areas[b] - areas[a])

  const outW = img.width
  const outH = img.height
  const sx = outW / w
  const sy = outH / h

  let rects = ''
  for (const c of order) {
    if (areas[c] === 0) continue
    const [r, g, b] = centroids[c]
    const hex = rgbToHex(r, g, b)
    for (let y = 0; y < h; y++) {
      let runStart = -1
      for (let x = 0; x <= w; x++) {
        const isC = x < w && labels[y * w + x] === c
        if (isC && runStart === -1) runStart = x
        if (!isC && runStart !== -1) {
          const rx = runStart * sx
          const ry = y * sy
          const rw = (x - runStart) * sx
          rects += `<rect x="${rx.toFixed(1)}" y="${ry.toFixed(1)}" width="${rw.toFixed(1)}" height="${(sy + 0.5).toFixed(1)}" fill="${hex}"/>`
          runStart = -1
        }
      }
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${outW}" height="${outH}" viewBox="0 0 ${outW} ${outH}">${rects}</svg>`
  return { svg, width: outW, height: outH }
}

export function downloadText(text: string, filename: string, mime: string) {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
