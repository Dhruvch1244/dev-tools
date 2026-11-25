import { useMemo, useState } from 'react'
import { Plus, Trash } from '@phosphor-icons/react'
import { CodeOut, CopyButton, ErrorBanner, Input, Panel, SectionLabel } from '../components/ui'

export function UrlParserPage() {
  const [raw, setRaw] = useState('https://user:pa%24s@ci.example.com:8443/job/platform/job/order-service-cd/buildWithParameters?ENV=UAT&VERSION=1.4.57&tags=a&tags=b#console')
  const [encIn, setEncIn] = useState('order service/1.4 & ü')

  const parsed = useMemo(() => {
    try {
      return { u: new URL(raw.trim()), error: null as string | null }
    } catch {
      return { u: null, error: 'Not a valid absolute URL (include the scheme, e.g. https://).' }
    }
  }, [raw])
  const u = parsed.u
  const params = u ? [...u.searchParams.entries()] : []

  function edit(fn: (url: URL) => void) {
    if (!u) return
    const n = new URL(u.toString())
    fn(n)
    setRaw(n.toString())
  }
  function setParams(next: [string, string][]) {
    edit((n) => {
      n.search = ''
      next.forEach(([k, v]) => n.searchParams.append(k, v))
    })
  }

  const parts: [string, string, (v: string) => void][] = u
    ? [
        ['protocol', u.protocol, (v) => edit((n) => (n.protocol = v))],
        ['username', decodeURIComponent(u.username), (v) => edit((n) => (n.username = v))],
        ['password', decodeURIComponent(u.password), (v) => edit((n) => (n.password = v))],
        ['hostname', u.hostname, (v) => edit((n) => (n.hostname = v))],
        ['port', u.port, (v) => edit((n) => (n.port = v))],
        ['pathname', decodeURIComponent(u.pathname), (v) => edit((n) => (n.pathname = v))],
        ['hash', u.hash, (v) => edit((n) => (n.hash = v))],
      ]
    : []

  return (
    <div className="flex h-full min-w-0 flex-col gap-3 overflow-y-auto [&>*]:shrink-0">
      <Panel>
        <div className="flex flex-col gap-3 p-5">
          <SectionLabel>URL</SectionLabel>
          <textarea spellCheck={false} value={raw} onChange={(e) => setRaw(e.target.value)} rows={3} className="devtools-input break-all font-mono !text-[1rem]" />
          {parsed.error && <ErrorBanner message={parsed.error} />}
          {u && (
            <div className="break-all rounded-2xl bg-glass p-3 font-mono text-[1rem] leading-relaxed">
              <span className="text-violet">{u.protocol}//</span>
              {u.username && <span className="text-warm">{u.username}{u.password ? ':' + u.password : ''}@</span>}
              <span className="text-cyan">{u.hostname}</span>
              {u.port && <span className="text-rose">:{u.port}</span>}
              <span className="text-ink">{u.pathname}</span>
              {u.search && <span className="text-emerald">{u.search}</span>}
              {u.hash && <span className="text-ink-faint">{u.hash}</span>}
            </div>
          )}
        </div>
      </Panel>
      {u && (
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          <Panel>
            <div className="flex flex-col gap-2 p-5">
              <SectionLabel>Parts (editable)</SectionLabel>
              {parts.map(([k, v, set]) => (
                <div key={k} className="grid grid-cols-[7rem_1fr] items-center gap-2">
                  <span className="text-[0.8125rem] font-bold uppercase tracking-wider text-ink-faint">{k}</span>
                  <Input value={v} onChange={(e) => set(e.target.value)} className="font-mono" />
                </div>
              ))}
              <div className="grid grid-cols-[7rem_1fr] items-center gap-2"><span className="text-[0.8125rem] font-bold uppercase tracking-wider text-ink-faint">origin</span><span className="font-mono text-ink-soft">{u.origin}</span></div>
              <div className="flex flex-wrap gap-2 pt-1">{u.pathname.split('/').filter(Boolean).map((s, i) => <span key={i} className="rounded-lg bg-glass px-2 py-1 font-mono text-[0.8125rem] text-ink-soft">{decodeURIComponent(s)}</span>)}</div>
            </div>
          </Panel>
          <Panel>
            <div className="flex flex-col gap-2 p-5">
              <div className="flex items-center justify-between"><SectionLabel>Query parameters ({params.length})</SectionLabel><button onClick={() => setParams([...params, ['key', 'value']])} className="text-cyan" aria-label="Add parameter"><Plus size={16} weight="bold" /></button></div>
              {params.map(([k, v], i) => (
                <div key={i} className="flex gap-2">
                  <Input value={k} onChange={(e) => setParams(params.map((p, j) => (j === i ? [e.target.value, p[1]] : p)))} className="font-mono !w-2/5" />
                  <Input value={v} onChange={(e) => setParams(params.map((p, j) => (j === i ? [p[0], e.target.value] : p)))} className="font-mono" />
                  <button onClick={() => setParams(params.filter((_, j) => j !== i))} className="px-1 text-ink-faint hover:text-rose" aria-label="Remove parameter"><Trash size={15} /></button>
                </div>
              ))}
              <CodeOut text={JSON.stringify(Object.fromEntries(params.reduce<Map<string, string | string[]>>((m, [k, v]) => (m.set(k, m.has(k) ? [m.get(k)!].flat().concat(v) : v), m), new Map())), null, 2)} label="as JSON" />
            </div>
          </Panel>
        </div>
      )}
      <Panel>
        <div className="flex flex-col gap-3 p-5">
          <SectionLabel>Encode / decode</SectionLabel>
          <Input value={encIn} onChange={(e) => setEncIn(e.target.value)} className="font-mono" />
          {([
            ['encodeURIComponent', () => encodeURIComponent(encIn)],
            ['encodeURI', () => encodeURI(encIn)],
            ['form (+ for space)', () => new URLSearchParams({ x: encIn }).toString().slice(2)],
            ['decodeURIComponent', () => decodeURIComponent(encIn.replace(/\+/g, ' '))],
          ] as [string, () => string][]).map(([label, fn]) => {
            let v = ''
            try {
              v = fn()
            } catch {
              v = '(malformed % sequence)'
            }
            return (
              <div key={label} className="flex items-center gap-3 rounded-xl bg-glass px-3 py-2">
                <span className="w-44 shrink-0 text-[0.8125rem] font-bold text-ink-faint">{label}</span>
                <span className="min-w-0 flex-1 break-all font-mono text-[0.9375rem] text-ink">{v}</span>
                <CopyButton text={v} label="" />
              </div>
            )
          })}
        </div>
      </Panel>
    </div>
  )
}
