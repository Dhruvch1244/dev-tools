import { useEffect, useMemo, useState } from 'react'
import * as PhosphorIcons from '@phosphor-icons/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CaretDown, MagnifyingGlass, Copy } from '@phosphor-icons/react'
import { Panel } from '../components/ui'

const NON_ICON_EXPORTS = new Set(['IconContext', 'IconBase', 'SSRBase'])
type IconComponent = React.ComponentType<{ size?: number; weight?: string }>

// The full Phosphor set — 1,500+ distinct icons across every category (UI, arrows, devices,
// communication, weather, finance, maps, brand marks, and more), each in 6 weights. No cap here:
// every one of them is searchable and browsable, the grid just renders in pages so the DOM stays light.
const ALL_ICONS: [string, IconComponent][] = Object.entries(PhosphorIcons)
  .filter(([name, val]) => !NON_ICON_EXPORTS.has(name) && /^[A-Z]/.test(name) && (typeof val === 'function' || typeof val === 'object'))
  .map(([name, val]): [string, IconComponent] => [name, val as IconComponent])
  .sort((a, b) => a[0].localeCompare(b[0]))

const WEIGHTS = ['thin', 'light', 'regular', 'bold', 'fill', 'duotone']
const PAGE_SIZE = 300
const INITIAL_PAGES = 2 // 600 shown up front — well past "500+" — before Show more is even needed

export function IconLibraryPage() {
  const [query, setQuery] = useState('')
  const [weight, setWeight] = useState('regular')
  const [copied, setCopied] = useState<string | null>(null)
  const [visible, setVisible] = useState(PAGE_SIZE * INITIAL_PAGES)

  const matched = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? ALL_ICONS.filter(([name]) => name.toLowerCase().includes(q)) : ALL_ICONS
  }, [query])

  useEffect(() => {
    setVisible(PAGE_SIZE * INITIAL_PAGES)
  }, [query])

  const shown = matched.slice(0, visible)
  const remaining = matched.length - shown.length

  async function copyJsx(name: string) {
    const code = `import { ${name} } from '@phosphor-icons/react'\n\n<${name} size={24} weight="${weight}" />`
    await navigator.clipboard.writeText(code)
    setCopied(`${name}-jsx`)
    setTimeout(() => setCopied(null), 1200)
  }

  async function copySvg(name: string, Icon: IconComponent) {
    const markup = renderToStaticMarkup(<Icon size={24} weight={weight} />)
    await navigator.clipboard.writeText(markup)
    setCopied(`${name}-svg`)
    setTimeout(() => setCopied(null), 1200)
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <Panel>
        <div className="flex items-center gap-3 p-3">
          <div className="relative flex-1">
            <MagnifyingGlass size={14} weight="light" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input
              className="devtools-input pl-8 text-xs"
              placeholder={`Search ${ALL_ICONS.length.toLocaleString()} icons…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select className="devtools-input w-auto text-xs" value={weight} onChange={(e) => setWeight(e.target.value)}>
            {WEIGHTS.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
          <span className="shrink-0 text-[10.5px] text-ink-faint">
            {shown.length.toLocaleString()} of {matched.length.toLocaleString()} shown
          </span>
        </div>
      </Panel>

      <Panel className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-auto p-3">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-2">
            {shown.map(([name, Icon]) => (
              <div key={name} className="group flex flex-col items-center gap-1.5 rounded-xl border border-rule-soft bg-glass px-2 py-3 text-center">
                <Icon size={22} weight={weight as never} />
                <span className="w-full truncate text-[9.5px] text-ink-faint" title={name}>{name}</span>
                <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button onClick={() => copyJsx(name)} title="Copy JSX + import" className="rounded p-1 text-ink-faint hover:bg-glass-strong hover:text-cyan">
                    {copied === `${name}-jsx` ? <span className="text-[9px] text-emerald">✓</span> : <Copy size={11} weight="light" />}
                  </button>
                  <button onClick={() => copySvg(name, Icon)} title="Copy raw SVG" className="rounded px-1 text-[9px] text-ink-faint hover:bg-glass-strong hover:text-cyan">
                    {copied === `${name}-svg` ? '✓' : 'SVG'}
                  </button>
                </div>
              </div>
            ))}
          </div>
          {matched.length === 0 && <div className="py-8 text-center text-sm text-ink-faint">No icons match "{query}"</div>}
          {remaining > 0 && (
            <div className="flex justify-center py-4">
              <button
                onClick={() => setVisible((v) => v + PAGE_SIZE * 3)}
                className="flex items-center gap-1.5 rounded-full border border-rule bg-glass px-4 py-2 text-xs text-ink-soft transition-colors hover:bg-glass-strong hover:text-ink"
              >
                <CaretDown size={12} weight="bold" /> Show {Math.min(remaining, PAGE_SIZE * 3).toLocaleString()} more ({remaining.toLocaleString()} left)
              </button>
            </div>
          )}
        </div>
      </Panel>
    </div>
  )
}
