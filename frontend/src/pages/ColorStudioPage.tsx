import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle, XCircle } from '@phosphor-icons/react'
import { CodeOut, CopyButton, Field, Input, Panel, Segmented, SectionLabel } from '../components/ui'

type RGB = [number, number, number]

function parseColor(s: string): RGB | null {
  const t = s.trim()
  if (!t) return null
  const ctx = document.createElement('canvas').getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = '#010203'
  ctx.fillStyle = t
  const v = ctx.fillStyle as string
  if (v === '#010203' && !/^#?010203$/i.test(t)) return null
  if (v.startsWith('#')) return [parseInt(v.slice(1, 3), 16), parseInt(v.slice(3, 5), 16), parseInt(v.slice(5, 7), 16)]
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(v)
  return m ? [+m[1], +m[2], +m[3]] : null
}
const hex = ([r, g, b]: RGB) => '#' + [r, g, b].map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, '0')).join('')
function toHsl([r, g, b]: RGB): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l * 100]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s * 100, l * 100]
}
function fromHsl(h: number, s: number, l: number): RGB {
  s /= 100; l /= 100
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [f(0) * 255, f(8) * 255, f(4) * 255]
}
function lum([r, g, b]: RGB) {
  const c = [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
}
const contrast = (a: RGB, b: RGB) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

export function ColorStudioPage() {
  const [fg, setFg] = useState('#28e0ec')
  const [bg, setBg] = useState('#0d0f16')
  const [scheme, setScheme] = useState<'shades' | 'complementary' | 'triadic' | 'analogous' | 'split'>('shades')
  const f = parseColor(fg)
  const b = parseColor(bg)
  const ratio = f && b ? contrast(f, b) : null

  const palette = useMemo(() => {
    if (!f) return []
    const [h, s, l] = toHsl(f)
    const rot = (d: number) => hex(fromHsl((h + d + 360) % 360, s, l))
    switch (scheme) {
      case 'shades': return [95, 85, 72, 60, l, 40, 30, 20, 12].map((x) => hex(fromHsl(h, s, x)))
      case 'complementary': return [hex(f), rot(180)]
      case 'triadic': return [hex(f), rot(120), rot(240)]
      case 'analogous': return [rot(-40), rot(-20), hex(f), rot(20), rot(40)]
      case 'split': return [hex(f), rot(150), rot(210)]
    }
  }, [f, scheme])

  const themeVars = ['--cyan', '--violet', '--rose', '--warm', '--emerald', '--ink', '--surface', '--void']
  const fromTheme = themeVars.map((v) => [v, getComputedStyle(document.documentElement).getPropertyValue(v).trim()] as const)
  const hsl = f ? toHsl(f) : null
  const grades: [string, number, string][] = [['AA normal text', 4.5, 'body copy'], ['AA large text', 3, '≥ 24px / 19px bold'], ['AAA normal text', 7, 'strict'], ['UI components', 3, 'borders, icons']]

  return (
    <div className="flex h-full min-w-0 flex-col gap-3 overflow-y-auto [&>*]:shrink-0">
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Panel>
          <div className="flex flex-col gap-4 p-5">
            <SectionLabel>Colours — any CSS colour: #hex, rgb(), hsl(), oklch(), names</SectionLabel>
            {([['Foreground', fg, setFg, f], ['Background', bg, setBg, b]] as const).map(([label, val, set, rgb]) => (
              <Field key={label} label={label}>
                <div className="flex gap-2">
                  <input type="color" value={rgb ? hex(rgb) : '#000000'} onChange={(e) => set(e.target.value)} className="h-11 w-14 shrink-0 cursor-pointer rounded-xl border border-rule bg-transparent" aria-label={`${label} picker`} />
                  <Input value={val} onChange={(e) => set(e.target.value)} className="font-mono" />
                </div>
              </Field>
            ))}
            <div className="flex flex-wrap gap-1.5">
              {fromTheme.map(([k, v]) => <button key={k} onClick={() => setFg(v)} onContextMenu={(e) => { e.preventDefault(); setBg(v) }} title={`${k} — click: foreground, right-click: background`} className="h-8 w-8 rounded-lg ring-1 ring-rule transition-transform hover:scale-110" style={{ background: v }} />)}
              <span className="self-center text-[0.8125rem] text-ink-faint">current theme · click = fg, right-click = bg</span>
            </div>
            {f && hsl && (
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {[hex(f), `rgb(${f.join(', ')})`, `hsl(${Math.round(hsl[0])} ${Math.round(hsl[1])}% ${Math.round(hsl[2])}%)`, `luminance ${lum(f).toFixed(3)}`].map((x) => (
                  <div key={x} className="flex items-center justify-between rounded-xl bg-glass px-3 py-1.5 font-mono text-[0.875rem] text-ink">{x}<CopyButton text={x} label="" /></div>
                ))}
              </div>
            )}
          </div>
        </Panel>
        <Panel>
          <div className="flex flex-col gap-4 p-5">
            <SectionLabel>Contrast (WCAG 2.x)</SectionLabel>
            <motion.div key={fg + bg} initial={{ opacity: 0.4, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="rounded-2xl p-6 ring-1 ring-rule" style={{ background: b ? hex(b) : undefined, color: f ? hex(f) : undefined }}>
              <div className="font-display text-[2.4rem] leading-none">Deploy to PROD?</div>
              <div className="mt-2 text-[1rem]">The quick brown fox jumps over the lazy dog — 0123456789</div>
              <div className="mt-1 text-[0.8125rem]">small print: build #57 · helm tag 1.4.57</div>
            </motion.div>
            <div className="font-display text-[3rem] leading-none text-ink">{ratio ? ratio.toFixed(2) : '—'}<span className="text-[1.4rem] text-ink-faint"> : 1</span></div>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {grades.map(([k, need, hint]) => {
                const ok = ratio !== null && ratio >= need
                return (
                  <div key={k} className={`flex items-center gap-2 rounded-xl px-3 py-2 ${ok ? 'bg-emerald/10 text-emerald' : 'bg-rose/10 text-rose'}`}>
                    {ok ? <CheckCircle size={17} weight="fill" /> : <XCircle size={17} weight="fill" />}
                    <span className="text-[0.875rem] font-semibold">{k}</span>
                    <span className="ml-auto text-[0.75rem]">{need}:1 · {hint}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </Panel>
      </div>
      <Panel>
        <div className="flex flex-col gap-3 p-5">
          <div className="flex flex-wrap items-center gap-3">
            <SectionLabel>Palette from foreground</SectionLabel>
            <Segmented id="color-scheme" size="sm" value={scheme} onChange={setScheme} options={[{ id: 'shades', label: 'Shades' }, { id: 'complementary', label: 'Complementary' }, { id: 'triadic', label: 'Triadic' }, { id: 'analogous', label: 'Analogous' }, { id: 'split', label: 'Split' }]} />
          </div>
          <div className="flex flex-wrap gap-2">
            {palette.map((c, i) => (
              <motion.button key={c + i} initial={{ opacity: 0, y: 12, rotate: -6 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ delay: i * 0.04, type: 'spring', stiffness: 300, damping: 18 }} onClick={() => navigator.clipboard.writeText(c)} className="flex w-24 flex-col overflow-hidden rounded-2xl ring-1 ring-rule transition-transform hover:-translate-y-1" title="Copy">
                <span className="h-16" style={{ background: c }} />
                <span className="bg-surface py-1 text-center font-mono text-[0.75rem] text-ink-soft">{c}</span>
              </motion.button>
            ))}
          </div>
          <CodeOut text={`:root {\n${palette.map((c, i) => `  --color-${scheme}-${i + 1}: ${c};`).join('\n')}\n}`} label="CSS variables" />
        </div>
      </Panel>
    </div>
  )
}
