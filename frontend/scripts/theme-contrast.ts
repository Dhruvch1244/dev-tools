/**
 * WCAG contrast audit of every theme's colour tokens. Fails (exit 1) if any pairing the UI
 * actually uses for text drops below its threshold.
 *   node --experimental-strip-types scripts/theme-contrast.ts
 */
import { THEMES, type Theme } from '../src/lib/themes.ts'

function rgb(c: string, over: [number, number, number] = [0, 0, 0]): [number, number, number] {
  let m = /^#([0-9a-f]{6})$/i.exec(c)
  if (m) return [0, 2, 4].map((i) => parseInt(m![1].slice(i, i + 2), 16)) as [number, number, number]
  m = /^rgba?\(([^)]+)\)$/i.exec(c)
  if (m) {
    const [r, g, b, a = '1'] = m[1].split(',').map((x) => x.trim())
    const al = Number(a)
    return [Number(r), Number(g), Number(b)].map((v, i) => v * al + over[i] * (1 - al)) as [number, number, number]
  }
  throw new Error('bad colour ' + c)
}
function lum([r, g, b]: [number, number, number]) {
  const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
export function contrast(a: string, b: string) {
  const [x, y] = [lum(rgb(a)), lum(rgb(b))].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

const CHECKS: [keyof Theme['colors'], number, string][] = [
  ['ink', 7, 'body text'],
  ['inkSoft', 4.5, 'secondary text'],
  ['inkFaint', 4.5, 'hints / labels'],
  ['cyan', 4.5, 'accent text'],
  ['emerald', 4.5, 'success text'],
  ['rose', 4.5, 'error text'],
  ['warm', 4.5, 'warning text'],
  ['violet', 4.5, 'accent text'],
]

let fails = 0
for (const t of THEMES) {
  const bad: string[] = []
  const light = t.scheme === 'light'
  for (const bgKey of ['surface', 'panel', 'void'] as const) {
    for (const [k, min, what] of CHECKS) {
      const r = contrast(t.colors[k], t.colors[bgKey])
      if (r < min) bad.push(`${k} on ${bgKey} ${r.toFixed(2)} < ${min} (${what})`)
    }
  }
  // primary button: on-accent text over the cyan fill
  const onAccent = light ? '#ffffff' : t.colors.void
  const btn = contrast(onAccent, t.colors.cyan)
  if (btn < 4.5) bad.push(`button text on cyan ${btn.toFixed(2)} < 4.5`)
  if (bad.length) {
    fails += bad.length
    console.log(`✗ ${t.name}\n   ${bad.join('\n   ')}`)
  } else console.log(`✓ ${t.name}`)
}
console.log(`\n${THEMES.length} themes, ${fails} failing pairing(s)`)
process.exitCode = fails ? 1 : 0
