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

type Point = { x: number; y: number }

/**
 * Extracts every boundary loop of a binary mask as a closed polygon, using consistent edge
 * orientation (filled region always on the right of the direction of travel) so outer boundaries
 * and holes come out with opposite winding automatically — that's what lets a single <path> with
 * fill-rule="evenodd" render holes correctly without any separate hole-detection pass.
 */
function traceContours(mask: (x: number, y: number) => boolean, w: number, h: number): Point[][] {
  // directed edge, keyed by its start vertex "x,y" -> end vertex
  const nextOf = new Map<string, Point>()
  const key = (p: Point) => `${p.x},${p.y}`

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask(x, y)) continue
      if (!mask(x, y - 1)) nextOf.set(key({ x, y }), { x: x + 1, y }) // top edge, region below-right
      if (!mask(x, y + 1)) nextOf.set(key({ x: x + 1, y: y + 1 }), { x, y: y + 1 }) // bottom edge
      if (!mask(x - 1, y)) nextOf.set(key({ x, y: y + 1 }), { x, y }) // left edge
      if (!mask(x + 1, y)) nextOf.set(key({ x: x + 1, y }), { x: x + 1, y: y + 1 }) // right edge
    }
  }

  const loops: Point[][] = []
  const visited = new Set<string>()
  for (const startKey of nextOf.keys()) {
    if (visited.has(startKey)) continue
    const loop: Point[] = []
    let cursorKey = startKey
    let guard = 0
    while (!visited.has(cursorKey) && guard++ < (w + 1) * (h + 1) * 4) {
      visited.add(cursorKey)
      const [cx, cy] = cursorKey.split(',').map(Number)
      loop.push({ x: cx, y: cy })
      const next = nextOf.get(cursorKey)
      if (!next) break
      cursorKey = key(next)
    }
    if (loop.length >= 3) loops.push(loop)
  }
  return loops
}

/** Douglas-Peucker polyline simplification on a closed loop. */
function simplifyLoop(points: Point[], epsilon: number): Point[] {
  if (points.length <= 4) return points
  function perpDist(p: Point, a: Point, b: Point): number {
    const dx = b.x - a.x, dy = b.y - a.y
    const len = Math.hypot(dx, dy)
    if (len === 0) return Math.hypot(p.x - a.x, p.y - a.y)
    return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len
  }
  function dp(pts: Point[]): Point[] {
    if (pts.length <= 2) return pts
    let maxDist = -1
    let idx = 0
    for (let i = 1; i < pts.length - 1; i++) {
      const d = perpDist(pts[i], pts[0], pts[pts.length - 1])
      if (d > maxDist) { maxDist = d; idx = i }
    }
    if (maxDist > epsilon) {
      const left = dp(pts.slice(0, idx + 1))
      const right = dp(pts.slice(idx))
      return [...left.slice(0, -1), ...right]
    }
    return [pts[0], pts[pts.length - 1]]
  }
  // treat the loop as an open path back to its own start so DP has stable endpoints, then drop
  // the duplicated closing point — smoothClosedPathD already wraps the array circularly.
  const augmented = [...points, points[0]]
  const simplified = dp(augmented)
  return simplified.slice(0, -1)
}

/** Fits a smooth closed curve through the given points via Catmull-Rom -> cubic-Bezier conversion. */
function smoothClosedPathD(points: Point[]): string {
  const n = points.length
  if (n < 3) return ''
  const pt = (i: number) => points[((i % n) + n) % n]
  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} `
  for (let i = 0; i < n; i++) {
    const p0 = pt(i - 1), p1 = pt(i), p2 = pt(i + 1), p3 = pt(i + 2)
    const c1x = p1.x + (p2.x - p0.x) / 6
    const c1y = p1.y + (p2.y - p0.y) / 6
    const c2x = p2.x - (p3.x - p1.x) / 6
    const c2y = p2.y - (p3.y - p1.y) / 6
    d += `C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)} `
  }
  return d + 'Z'
}

/**
 * Client-side raster→SVG tracer: downscales, quantizes to `colors` flat colors via k-means, then
 * for each color extracts every boundary loop (outer + holes) via edge-following contour tracing,
 * simplifies each with Douglas-Peucker, and fits a smooth Catmull-Rom/cubic-Bezier curve through
 * the result. Multiple loops per color (disjoint regions, holes) become separate subpaths in one
 * <path fill-rule="evenodd">. Works best on flat-color logos/icons, not photos.
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
  const epsilon = Math.max(0.6, Math.min(w, h) / 200)
  const minRegionArea = Math.max(2, Math.round((w * h) / 4000))

  let paths = ''
  for (const c of order) {
    if (areas[c] < minRegionArea) continue
    const [r, g, b] = centroids[c]
    const hex = rgbToHex(r, g, b)
    const mask = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && labels[y * w + x] === c

    const loops = traceContours(mask, w, h)
    let d = ''
    for (const loop of loops) {
      const simplified = simplifyLoop(loop, epsilon)
      const scaled = simplified.map((p) => ({ x: p.x * sx, y: p.y * sy }))
      d += smoothClosedPathD(scaled) + ' '
    }
    if (d.trim()) paths += `<path d="${d.trim()}" fill="${hex}" fill-rule="evenodd"/>`
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${outW}" height="${outH}" viewBox="0 0 ${outW} ${outH}">${paths}</svg>`
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
