#!/usr/bin/env node
/**
 * Layout regression sweep: opens EVERY tool at several viewport sizes and text sizes, stuffs every
 * text field with very long content, and reports what breaks — horizontal page overflow, clipped
 * (cut-off) text, buttons whose label spills out, and text rendered too small to read. Saves a
 * screenshot per tool/config so a human can eyeball the result.
 *
 *   node scripts/layout-regression.mjs [baseUrl] [outDir] [--quick] [--only=tool1,tool2] [--config=phone-L]
 *   (the app must be running — e.g. java -jar backend/target/devtools-suite.jar)
 */
import { createRequire } from 'node:module'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// require() so a globally installed Playwright (npm i -g playwright) is found too
const { chromium } = createRequire(import.meta.url)('playwright')
const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const quick = process.argv.includes('--quick')
const onlyArg = process.argv.find((a) => a.startsWith('--only='))
const base = args[0] ?? 'http://localhost:8383'
const out = args[1] ?? join(here, '..', 'layout-report')
mkdirSync(out, { recursive: true })

const appSrc = readFileSync(join(here, '..', 'src', 'App.tsx'), 'utf8')
const groupsSrc = appSrc.slice(appSrc.indexOf('export const GROUPS'), appSrc.indexOf('export const ALL_TOOLS'))
let tools = [...groupsSrc.matchAll(/id: '([a-z0-9-]+)',\s*label/g)].map((m) => m[1])
if (onlyArg) tools = onlyArg.slice(7).split(',')

const CONFIGS = [
  { name: 'desktop-L', width: 1440, height: 900, text: 'l', theme: 'constellation' },
  { name: 'laptop-XXL', width: 1280, height: 800, text: 'xxl', theme: 'synthwave' },
  { name: 'tablet-XL', width: 820, height: 1180, text: 'xl', theme: 'light' },
  { name: 'phone-L', width: 390, height: 844, text: 'l', theme: 'matrix' },
]
const configArg = process.argv.find((a) => a.startsWith('--config='))
const configs = configArg ? CONFIGS.filter((c) => configArg.slice(9).split(',').includes(c.name)) : quick ? CONFIGS.slice(0, 2) : CONFIGS

const LONG =
  'Supercalifragilistic_build_artifact_name_without_any_spaces_1234567890 ' +
  'The quick brown fox jumps over the lazy dog while the CD pipeline waits for Proceed. '.repeat(6)

function inspect() {
  const res = { pageOverflowX: 0, clipped: [], spilling: [], tiny: 0, tinySamples: [] }
  const vw = window.innerWidth
  res.pageOverflowX = Math.max(0, document.documentElement.scrollWidth - vw, document.body.scrollWidth - vw)
  const path = (el) => {
    const parts = []
    for (let e = el; e && e !== document.body && parts.length < 4; e = e.parentElement) {
      const cls =
        e.className && typeof e.className === 'string'
          ? e.className.split(/\s+/).filter((c) => c && !c.includes(':') && !c.includes('[')).slice(0, 2).join('.')
          : ''
      parts.unshift(e.tagName.toLowerCase() + (cls ? '.' + cls : ''))
    }
    return parts.join(' > ')
  }
  const main = document.querySelector('main')
  if (!main) return res
  for (const el of main.querySelectorAll('*')) {
    if (el.closest('svg, canvas, .fx-root, [aria-hidden="true"], [data-layout-ok]')) continue
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) continue
    const cs = getComputedStyle(el)
    if (cs.visibility === 'hidden' || cs.display === 'none') continue
    const text = (el.textContent ?? '').trim()
    if (
      (cs.overflowX === 'hidden' || cs.overflowX === 'clip') &&
      el.scrollWidth > el.clientWidth + 2 &&
      cs.textOverflow !== 'ellipsis' &&
      text &&
      !['TEXTAREA', 'INPUT', 'SELECT'].includes(el.tagName)
    ) {
      const hasScroller = [...el.children].some((c) => ['auto', 'scroll'].includes(getComputedStyle(c).overflowX))
      if (!hasScroller) res.clipped.push({ at: path(el), over: el.scrollWidth - el.clientWidth, text: text.slice(0, 60) })
    }
    if ((el.tagName === 'BUTTON' || el.tagName === 'A') && cs.overflowX === 'visible' && el.scrollWidth > el.clientWidth + 3 && text) {
      res.spilling.push({ at: path(el), over: el.scrollWidth - el.clientWidth, text: text.slice(0, 60) })
    }
    if ([...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) {
      const fs = parseFloat(cs.fontSize)
      if (fs < 11.5) {
        res.tiny++
        if (res.tinySamples.length < 3) res.tinySamples.push(`${fs}px: ${text.slice(0, 40)}`)
      }
    }
  }
  res.clipped = res.clipped.slice(0, 12)
  res.spilling = res.spilling.slice(0, 12)
  return res
}

const browser = await chromium.launch()
const report = []
let issues = 0

for (const cfg of configs) {
  const ctx = await browser.newContext({ viewport: { width: cfg.width, height: cfg.height }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  for (const tool of tools) {
    errors.length = 0
    await page.goto(base + '/', { waitUntil: 'domcontentloaded' })
    await page.evaluate(
      ({ tool, cfg }) => {
        localStorage.setItem('devtools.session', JSON.stringify({ openTabs: [tool], activeTab: tool }))
        localStorage.setItem('devtools.text-size', cfg.text)
        localStorage.setItem('devtools.motion', 'off')
        localStorage.setItem('devtools.theme', cfg.theme)
        localStorage.setItem('devtools.sidebar-open', cfg.width >= 900 ? '1' : '0')
      },
      { tool, cfg },
    )
    await page.reload({ waitUntil: 'networkidle' }).catch(() => {})
    await page.waitForTimeout(400)

    const fields = await page.$$('main input[type="text"], main input:not([type]), main textarea')
    for (const f of fields.slice(0, 12)) {
      try {
        if (!(await f.isVisible()) || !(await f.isEditable())) continue
        await f.fill(LONG, { timeout: 800 })
      } catch {
        /* detached or not fillable */
      }
    }
    await page.waitForTimeout(250)

    const found = await page.evaluate(inspect)
    const shot = join(out, `${cfg.name}__${tool}.png`)
    await page.screenshot({ path: shot })
    const n = (found.pageOverflowX > 0 ? 1 : 0) + found.clipped.length + found.spilling.length + (found.tiny > 0 ? 1 : 0) + errors.length
    issues += n
    report.push({ config: cfg.name, tool, ...found, errors: [...errors], screenshot: shot })
    const bits = [
      found.pageOverflowX ? `overflowX=${found.pageOverflowX}` : '',
      found.clipped.length ? `clipped=${found.clipped.length}` : '',
      found.spilling.length ? `spilling=${found.spilling.length}` : '',
      found.tiny ? `tiny=${found.tiny}` : '',
      errors.length ? `JS-errors=${errors.length}` : '',
    ].filter(Boolean)
    console.log(`${cfg.name.padEnd(11)} ${tool.padEnd(22)} ${n ? '⚠ ' + bits.join(' ') : '✓'}`)
  }
  await ctx.close()
}
await browser.close()
writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2))
console.log(`\n${tools.length} tools × ${configs.length} configs — ${issues} issue(s). Report: ${join(out, 'report.json')}`)
process.exitCode = issues ? 1 : 0
