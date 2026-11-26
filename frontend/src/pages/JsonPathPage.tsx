import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { query } from '../lib/jsonpath'
import { Badge, CodeOut, ErrorBanner, Input, Panel, SectionLabel, TextArea } from '../components/ui'

const SAMPLE = JSON.stringify({
  release: 'R26.11',
  services: [
    { name: 'order-service', env: { DIT: '1.4.57-dit.31', UAT: '1.4.57-uat.33', PROD: '1.4.55-prod.29' }, owners: ['dhruv'], replicas: 4, healthy: true },
    { name: 'payment-service', env: { DIT: '2.1.3-dit.12', UAT: '2.1.2-uat.11' }, owners: ['anita', 'li'], replicas: 2, healthy: false },
    { name: 'inventory-service', env: { DIT: '0.9.8-dit.7' }, owners: [], replicas: 1, healthy: true },
  ],
}, null, 2)

const PRESETS = [
  '$.services[*].name',
  '$..UAT',
  '$.services[?(@.healthy == false)].name',
  '$.services[?(@.replicas >= 2 && @.env.PROD)].name',
  "$.services[?(@.name =~ /pay/)].owners[*]",
  '$.services[-1:]',
  '$.services[0].env.*',
  '$..owners.length',
]

export function JsonPathPage() {
  const [doc, setDoc] = useState(SAMPLE)
  const [path, setPath] = useState(PRESETS[2])
  const parsed = useMemo(() => {
    try {
      return { v: JSON.parse(doc) as unknown, error: null as string | null }
    } catch (e) {
      return { v: null, error: e instanceof Error ? e.message : 'Invalid JSON' }
    }
  }, [doc])
  const res = useMemo(() => {
    if (parsed.error) return { r: [], error: null }
    try {
      return { r: query(parsed.v, path), error: null as string | null }
    } catch (e) {
      return { r: [], error: e instanceof Error ? e.message : 'Invalid path' }
    }
  }, [parsed, path])

  return (
    <div className="flex h-full min-w-0 flex-col gap-3 overflow-y-auto max-xl:[&>*]:shrink-0 xl:flex-row xl:overflow-hidden">
      <Panel className="xl:w-[min(34rem,42%)] xl:shrink-0">
        <div className="flex h-full min-h-[24rem] flex-col gap-3 p-4">
          <SectionLabel>JSON document</SectionLabel>
          <TextArea value={doc} onChange={(e) => setDoc(e.target.value)} />
          {parsed.error && <ErrorBanner message={parsed.error} />}
        </div>
      </Panel>
      <Panel className="min-w-0 flex-1">
        <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-5 [&>*]:shrink-0">
          <SectionLabel>JSONPath</SectionLabel>
          <Input value={path} onChange={(e) => setPath(e.target.value)} className="!text-[1.125rem] font-mono" />
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => <button key={p} onClick={() => setPath(p)} className={`rounded-full px-3 py-1 font-mono text-[0.8125rem] ring-1 transition-colors ${p === path ? 'bg-cyan/15 text-cyan ring-cyan/40' : 'text-ink-faint ring-rule-soft hover:text-ink'}`}>{p}</button>)}
          </div>
          {res.error && <ErrorBanner message={res.error} />}
          <div className="flex items-center gap-2"><Badge tone={res.r.length ? 'emerald' : 'muted'}>{res.r.length} match{res.r.length === 1 ? '' : 'es'}</Badge></div>
          <div className="flex flex-col gap-1.5">
            {res.r.slice(0, 200).map((r, i) => (
              <motion.div key={r.path} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.02, 0.3) }} className="rounded-xl bg-glass px-3 py-2 ring-1 ring-rule-soft">
                <button onClick={() => setPath(r.path)} className="break-all text-left font-mono text-[0.8125rem] text-violet hover:underline">{r.path}</button>
                <pre className="mt-0.5 max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono text-[0.875rem] text-ink">{typeof r.value === 'string' ? JSON.stringify(r.value) : JSON.stringify(r.value, null, 2)}</pre>
              </motion.div>
            ))}
          </div>
          {res.r.length > 0 && <CodeOut text={JSON.stringify(res.r.map((r) => r.value), null, 2)} label="Result array" />}
          <div className="rounded-2xl border border-dashed border-rule p-3 text-[0.875rem] leading-relaxed text-ink-faint">
            <b className="text-ink-soft">Syntax:</b> <code>$</code> root · <code>.key</code> / <code>['key']</code> · <code>..</code> recursive · <code>*</code> wildcard · <code>[0]</code> <code>[-1]</code> <code>[0,2]</code> <code>[1:3]</code> · filters <code>[?(@.a &gt; 1 &amp;&amp; @.b == 'x')]</code>, regex <code>=~ /re/i</code>, <code>@.list.length</code>.
          </div>
        </div>
      </Panel>
    </div>
  )
}
