export type TreemapRect = { x: number; y: number; w: number; h: number }

function worstRatio(sizes: number[], side: number): number {
  if (sizes.length === 0) return Infinity
  const sum = sizes.reduce((a, b) => a + b, 0)
  if (sum <= 0) return Infinity
  let max = sizes[0]
  let min = sizes[0]
  for (const v of sizes) {
    if (v > max) max = v
    if (v < min) min = v
  }
  const s2 = side * side
  const sum2 = sum * sum
  return Math.max((s2 * max) / sum2, sum2 / (s2 * min || 1))
}

/**
 * Squarified treemap (Bruls/Huizing/van Wijk): fills rows greedily, always picking the split
 * that keeps rectangle aspect ratios closest to square, laid out along whichever side of the
 * remaining space is currently shorter. Replaces a naive single-row slice-and-dice, which
 * degenerates into a wall of unreadable slivers once there are more than a handful of items.
 */
export function squarify<T>(items: { size: number; item: T }[], x: number, y: number, w: number, h: number): (T & TreemapRect)[] {
  const total = items.reduce((a, it) => a + Math.max(0, it.size), 0)
  if (total <= 0 || items.length === 0 || w <= 0 || h <= 0) return []

  const area = w * h
  const scaled = items
    .filter((it) => it.size > 0)
    .map((it) => ({ item: it.item, size: (it.size / total) * area }))

  const results: (T & TreemapRect)[] = []
  let remaining = scaled
  let rx = x
  let ry = y
  let rw = w
  let rh = h

  while (remaining.length > 0) {
    const side = Math.min(rw, rh)
    let row = [remaining[0]]
    let i = 1
    while (i < remaining.length) {
      const candidate = [...row, remaining[i]]
      if (worstRatio(candidate.map((r) => r.size), side) <= worstRatio(row.map((r) => r.size), side)) {
        row = candidate
        i++
      } else {
        break
      }
    }
    remaining = remaining.slice(i)

    const rowSum = row.reduce((a, r) => a + r.size, 0)
    if (rw <= rh) {
      const rowH = rowSum / rw
      let oy = ry
      for (const r of row) {
        const itemH = r.size / rw
        results.push({ ...(r.item as object), x: rx, y: oy, w: rw, h: itemH } as T & TreemapRect)
        oy += itemH
      }
      ry += rowH
      rh -= rowH
    } else {
      const rowW = rowSum / rh
      let ox = rx
      for (const r of row) {
        const itemW = r.size / rh
        results.push({ ...(r.item as object), x: ox, y: ry, w: itemW, h: rh } as T & TreemapRect)
        ox += itemW
      }
      rx += rowW
      rw -= rowW
    }
  }
  return results
}

/** Simple single-row slice-and-dice — kept for callers that genuinely want one axis, not a grid. */
export function layoutRow<T extends { size: number }>(items: T[], x: number, y: number, w: number, h: number): (T & TreemapRect)[] {
  const total = items.reduce((a, it) => a + Math.max(0, it.size), 0)
  if (total <= 0 || items.length === 0) return []
  const horizontal = w >= h
  let offset = 0
  return items.map((it) => {
    const frac = Math.max(0, it.size) / total
    if (horizontal) {
      const iw = frac * w
      const rect = { x: x + offset, y, w: iw, h }
      offset += iw
      return { ...it, ...rect }
    }
    const ih = frac * h
    const rect = { x, y: y + offset, w, h: ih }
    offset += ih
    return { ...it, ...rect }
  })
}
