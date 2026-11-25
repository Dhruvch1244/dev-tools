#!/usr/bin/env node
/**
 * Rendered-UI audit across EVERY theme: for each theme × tool it opens the page and measures
 * the real contrast of every visible piece of text against what is actually painted behind it
 * (compositing translucent panel/badge backgrounds and inherited opacity, the way the user
 * sees it), plus JavaScript errors and failed API calls.
 *
 * Thresholds (WCAG 2.x): 4.5:1 for normal text, 3:1 for large text (>= 24px, or >= 18.66px
 * bold). Placeholder text, disabled controls and purely decorative layers are skipped.
 *
 *   node scripts/ux-audit.mjs [baseUrl] [--tools=a,b] [--themes=x,y] [--verbose]
 */
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const { chromium } = createRequire(import.meta.url)('playwright')
const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const base = args.find((a) => !a.startsWith('--')) ?? 'http://localhost:8383'
const opt = (k) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3)
const verbose = args.includes('--verbose')

const themesSrc = readFileSync(join(here, '..', 'src', 'lib', 'themes.ts'), 'utf8')
let themes = [...themesSrc.matchAll(/\bid: '([a-z0-9-]+)'/g)].map((m) => m[1])
if (opt('themes')) themes = opt('themes').split(',')
const appSrc = readFileSync(join(here, '..', 'src', 'App.tsx'), 'utf8')
const allTools = [...appSrc.slice(appSrc.indexOf('export const GROUPS'), appSrc.indexOf('export const ALL_TOOLS')).matchAll(/id: '([a-z0-9-]+)',\s*label/g)].map((m) => m[1])
const tools = opt('tools') ? opt('tools').split(',') : ['home', 'jenkins', 'rehydration', 'k8s-lint', 'health-board', 'semver', 'color-studio', 'api-client', 'notes', 'task-list', 'sql', 'diff']

function measure() {
  const parse = (s) => {
    let m = /^rgba?\(([^)]+)\)$/.exec(s)
    if (m) {
      const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number)
      return [p[0], p[1], p[2], p[3] ?? 1]
    }
    m = /^color\(srgb ([^)]+)\)$/.exec(s)
    if (m) {
      const p = m[1].split(/[\s/]+/).filter(Boolean).map(Number)
      return [p[0] * 255, p[1] * 255, p[2] * 255, p[3] ?? 1]
    }
    return null
  }
  const over = (top, bot) => [0, 1, 2].map((i) => top[i] * top[3] + bot[i] * (1 - top[3])).concat(1)
  const lum = (c) => {
    const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
  }
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
    return (x + 0.05) / (y + 0.05)
  }
  const root = parse(getComputedStyle(document.body).backgroundColor) ?? [0, 0, 0, 1]
  const bgOf = (el) => {
    const chain = []
    const r0 = el.getBoundingClientRect()
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
      const c = parse(getComputedStyle(e).backgroundColor)
      if (c && c[3] > 0) chain.push(c)
      // a sliding "active pill" is often an absolutely-positioned sibling painted behind the text
      for (let sib = e.previousElementSibling; sib; sib = sib.previousElementSibling) {
        const sc = getComputedStyle(sib)
        if (sc.position !== 'absolute') continue
        const sr = sib.getBoundingClientRect()
        const covers = sr.left <= r0.left + 1 && sr.right >= r0.right - 1 && sr.top <= r0.top + 1 && sr.bottom >= r0.bottom - 1
        const bc = parse(sc.backgroundColor)
        if (covers && bc && bc[3] > 0) chain.push([bc[0], bc[1], bc[2], bc[3] * Number(sc.opacity)])
      }
    }
    let bg = root
    for (let i = chain.length - 1; i >= 0; i--) bg = over(chain[i], bg)
    return bg
  }
  const opacityOf = (el) => {
    let o = 1
    for (let e = el; e && e !== document.documentElement; e = e.parentElement) o *= Number(getComputedStyle(e).opacity)
    return o
  }
  const out = { checked: 0, fails: [] }
  const seen = new Set()
  for (const el of document.querySelectorAll('aside *, main *')) {
    if (!el.childNodes.length || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue
    if (el.closest('svg, canvas, .fx-root, [aria-hidden="true"], [data-layout-ok], .marquee, [disabled], button:disabled')) continue
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden') continue
    const fg = parse(cs.color)
    if (!fg || fg[3] === 0 || cs.webkitTextFillColor === 'rgba(0, 0, 0, 0)') continue // gradient text etc.
    const op = opacityOf(el)
    if (op < 0.05) continue
    const bg = bgOf(el)
    const eff = over([fg[0], fg[1], fg[2], fg[3] * op], bg)
    const cr = ratio(eff, bg)
    const size = parseFloat(cs.fontSize)
    const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700)
    const need = large ? 3 : 4.5
    out.checked++
    if (cr + 0.01 < need) {
      const text = el.textContent.trim().slice(0, 40)
      const key = `${text}|${cr.toFixed(1)}`
      if (seen.has(key)) continue
      seen.add(key)
      out.fails.push({ text, ratio: +cr.toFixed(2), need, size, cls: String(el.className).slice(0, 80) })
    }
  }
  return out
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await ctx.newPage()
const report = []
let totalFails = 0
for (const theme of themes) {
  const perTheme = { theme, fails: 0, checked: 0, errors: 0, samples: [] }
  for (const tool of tools) {
    const errors = []
    const onErr = (e) => errors.push(String(e))
    const onResp = (r) => { if (r.url().includes('/api/') && r.status() >= 500) errors.push(`HTTP ${r.status()} ${r.url()}`) }
    page.on('pageerror', onErr)
    page.on('response', onResp)
    await page.goto(base + '/', { waitUntil: 'domcontentloaded' })
    await page.evaluate(({ theme, tool }) => {
      localStorage.setItem('devtools.theme', theme)
      localStorage.setItem('devtools.motion', 'off')
      localStorage.setItem('devtools.text-size', 'l')
      localStorage.setItem('devtools.sidebar-open', '1')
      localStorage.setItem('devtools.session', JSON.stringify({ openTabs: [tool], activeTab: tool }))
    }, { theme, tool })
    await page.reload({ waitUntil: 'networkidle' }).catch(() => {})
    await page.waitForTimeout(1200) // let entrance animations (opacity fades) finish
    const m = await page.evaluate(measure)
    page.off('pageerror', onErr)
    page.off('response', onResp)
    perTheme.checked += m.checked
    perTheme.fails += m.fails.length
    perTheme.errors += errors.length
    for (const f of m.fails) perTheme.samples.push({ tool, ...f })
    for (const e of errors) perTheme.samples.push({ tool, error: e })
  }
  totalFails += perTheme.fails + perTheme.errors
  report.push(perTheme)
  console.log(`${perTheme.fails || perTheme.errors ? '✗' : '✓'} ${theme.padEnd(18)} ${String(perTheme.checked).padStart(5)} text elements · ${perTheme.fails} low-contrast · ${perTheme.errors} errors`)
  if (verbose) for (const s of perTheme.samples.slice(0, 12)) console.log('    ', JSON.stringify(s))
}
await browser.close()
const out = join(here, '..', 'layout-report')
try {
  writeFileSync(join(out, 'ux-audit.json'), JSON.stringify(report, null, 2))
} catch {
  /* report dir may not exist */
}
console.log(`\n${themes.length} themes × ${tools.length} tools (${allTools.length} tools exist) — ${totalFails} problem(s)`)
process.exitCode = totalFails ? 1 : 0
