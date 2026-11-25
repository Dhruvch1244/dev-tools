import { useMemo, useState } from 'react'
import { Plus, Trash } from '@phosphor-icons/react'
import { flatten, merge, parseLayer, parseSet, toYaml, type Layer } from '../lib/helmValues'
import { Badge, Button, CodeOut, ErrorBanner, Field, Input, Panel, Segmented, SectionLabel } from '../components/ui'

const LS = 'devtools.helm-values.layers'
const DEFAULT: Layer[] = [
  { name: 'values.yaml', text: 'replicaCount: 1\nimage:\n  repository: registry.local/order-service\n  tag: "1.0.0"\n  pullPolicy: IfNotPresent\nresources:\n  requests: { cpu: 100m, memory: 256Mi }\ningress:\n  enabled: false\nenv:\n  LOG_LEVEL: INFO\n  FEATURE_X: "off"\n' },
  { name: 'values-uat.yaml', text: 'replicaCount: 2\nimage:\n  tag: "1.4.57"\ningress:\n  enabled: true\n  hosts: [orders.uat.local]\nenv:\n  FEATURE_X: "on"\n' },
  { name: 'values-prod.yaml', text: 'replicaCount: 4\nimage:\n  tag: "1.4.55"\nresources:\n  limits: { memory: 1Gi }\nenv:\n  LOG_LEVEL: WARN\n  FEATURE_X: null\n' },
]

export function HelmValuesPage() {
  const [layers, setLayers] = useState<Layer[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(LS) ?? '') as Layer[]
    } catch {
      return DEFAULT
    }
  })
  const [sets, setSets] = useState('')
  const [active, setActive] = useState(0)
  const [view, setView] = useState<'merged' | 'provenance' | 'diff'>('merged')
  const [diffA, setDiffA] = useState(1)
  const [diffB, setDiffB] = useState(2)

  function save(next: Layer[]) {
    setLayers(next)
    try {
      localStorage.setItem(LS, JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }

  const parsed = useMemo(() => layers.map((l) => ({ name: l.name, ...parseLayer(l) })), [layers])
  const { merged, origin } = useMemo(() => {
    const ls = parsed.map((p) => ({ name: p.name, value: p.value }))
    if (sets.trim()) ls.push({ name: '--set', value: parseSet(sets) })
    return merge(ls)
  }, [parsed, sets])
  const flat = useMemo(() => flatten(merged), [merged])

  // diff: effective values when stacking base + layer A vs base + layer B
  const diff = useMemo(() => {
    const base = parsed[0]
    const a = flatten(merge([{ name: base.name, value: base.value }, ...(diffA > 0 ? [{ name: parsed[diffA]?.name, value: parsed[diffA]?.value }] : [])]).merged)
    const b = flatten(merge([{ name: base.name, value: base.value }, ...(diffB > 0 ? [{ name: parsed[diffB]?.name, value: parsed[diffB]?.value }] : [])]).merged)
    const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)])).sort()
    return keys.map((k) => ({ k, a: a[k], b: b[k] })).filter((r) => r.a !== r.b)
  }, [parsed, diffA, diffB])

  const errors = parsed.filter((p) => p.error)
  const cur = layers[active]

  return (
    <div className="flex h-full min-w-0 flex-col gap-3 overflow-y-auto max-xl:[&>*]:shrink-0 xl:flex-row xl:overflow-hidden">
      <Panel className="xl:w-[min(34rem,42%)] xl:shrink-0">
        <div className="flex h-full min-h-[26rem] flex-col gap-3 p-4">
          <SectionLabel>Layers (applied top → bottom, like -f a.yaml -f b.yaml)</SectionLabel>
          <div className="flex flex-wrap gap-1.5">
            {layers.map((l, i) => (
              <button key={i} onClick={() => setActive(i)} className={`rounded-full px-3 py-1.5 text-[0.875rem] font-semibold ring-1 transition-colors ${i === active ? 'bg-glass-strong text-ink ring-cyan/50' : 'text-ink-soft ring-rule-soft hover:text-ink'} ${parsed[i]?.error ? '!ring-rose/60' : ''}`}>
                <span className="mr-1 text-ink-faint">{i + 1}.</span>{l.name}
              </button>
            ))}
            <Button variant="ghost" onClick={() => { save([...layers, { name: `values-${layers.length}.yaml`, text: '' }]); setActive(layers.length) }}><Plus size={14} /> layer</Button>
          </div>
          {cur && (
            <>
              <div className="flex gap-2">
                <Input value={cur.name} onChange={(e) => save(layers.map((l, i) => (i === active ? { ...l, name: e.target.value } : l)))} />
                {layers.length > 1 && <Button variant="ghost" onClick={() => { save(layers.filter((_, i) => i !== active)); setActive(0) }} className="!text-rose"><Trash size={15} /></Button>}
              </div>
              <textarea spellCheck={false} value={cur.text} onChange={(e) => save(layers.map((l, i) => (i === active ? { ...l, text: e.target.value } : l)))} className="devtools-input min-h-[14rem] flex-1 resize-none font-mono" />
            </>
          )}
          <Field label="--set overrides" hint="Comma-separated, e.g. image.tag=1.5.0,ingress.hosts[0]=x.io,replicaCount=3">
            <Input value={sets} onChange={(e) => setSets(e.target.value)} placeholder="image.tag=1.5.0,replicaCount=3" className="font-mono" />
          </Field>
          <Button variant="ghost" onClick={() => save(DEFAULT)}>Reset to example</Button>
        </div>
      </Panel>
      <Panel className="min-w-0 flex-1">
        <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-5 [&>*]:shrink-0">
          <Segmented id="helm-view" value={view} onChange={setView} options={[{ id: 'merged', label: 'Effective values' }, { id: 'provenance', label: 'Where each value came from' }, { id: 'diff', label: 'Diff two envs' }]} />
          {errors.map((e) => <ErrorBanner key={e.name} message={`${e.name}: ${e.error}`} />)}
          {view === 'merged' && <CodeOut text={toYaml(merged)} label="helm template would see" />}
          {view === 'provenance' && (
            <div className="overflow-x-auto rounded-2xl border border-rule-soft">
              <table className="w-full text-left text-[0.875rem]">
                <thead className="bg-glass text-[0.75rem] uppercase tracking-wider text-ink-faint"><tr><th className="px-3 py-2">Key</th><th className="px-3 py-2">Value</th><th className="px-3 py-2">Set by</th></tr></thead>
                <tbody>
                  {Object.entries(origin).sort().map(([k, src]) => (
                    <tr key={k} className="border-t border-rule-soft">
                      <td className="px-3 py-2 font-mono text-ink">{k}</td>
                      <td className="break-all px-3 py-2 font-mono text-ink-soft">{flat[k] ?? <span className="text-rose">removed</span>}</td>
                      <td className="px-3 py-2"><Badge tone={src === layers[0]?.name ? 'muted' : src.includes('deleted') ? 'rose' : src === '--set' ? 'warm' : 'cyan'}>{src}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {view === 'diff' && (
            <>
              <div className="flex flex-wrap items-center gap-2 text-[0.9375rem] text-ink-soft">
                {layers[0]?.name} +
                <select className="devtools-input !w-auto" value={diffA} onChange={(e) => setDiffA(Number(e.target.value))}>{layers.map((l, i) => <option key={i} value={i}>{i === 0 ? '(base only)' : l.name}</option>)}</select>
                vs
                <select className="devtools-input !w-auto" value={diffB} onChange={(e) => setDiffB(Number(e.target.value))}>{layers.map((l, i) => <option key={i} value={i}>{i === 0 ? '(base only)' : l.name}</option>)}</select>
              </div>
              {diff.length === 0 ? <div className="text-emerald">Identical effective values.</div> : (
                <div className="overflow-x-auto rounded-2xl border border-rule-soft">
                  <table className="w-full text-left text-[0.875rem]">
                    <tbody>
                      {diff.map((r) => (
                        <tr key={r.k} className="border-t border-rule-soft first:border-t-0">
                          <td className="px-3 py-2 font-mono text-ink">{r.k}</td>
                          <td className="break-all px-3 py-2 font-mono text-rose">{r.a ?? '—'}</td>
                          <td className="break-all px-3 py-2 font-mono text-emerald">{r.b ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </Panel>
    </div>
  )
}
