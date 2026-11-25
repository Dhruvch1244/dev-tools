import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { HEADERS, METHODS, STATUS } from '../lib/httpReference'
import { Badge, Input, Panel, Segmented } from '../components/ui'

const toneFor = (c: number) => (c < 200 ? 'text-violet' : c < 300 ? 'text-emerald' : c < 400 ? 'text-cyan' : c < 500 ? 'text-warm' : 'text-rose')

export function HttpReferencePage() {
  const [tab, setTab] = useState<'status' | 'headers' | 'methods'>('status')
  const [q, setQ] = useState('')
  const [cls, setCls] = useState<'all' | '1' | '2' | '3' | '4' | '5'>('all')
  const needle = q.trim().toLowerCase()
  const statuses = useMemo(() => STATUS.filter((s) => (cls === 'all' || String(s.code)[0] === cls) && (!needle || `${s.code} ${s.name} ${s.desc} ${s.tip ?? ''}`.toLowerCase().includes(needle))), [needle, cls])
  const headers = useMemo(() => HEADERS.filter((h) => !needle || `${h.name} ${h.desc} ${h.example}`.toLowerCase().includes(needle)), [needle])

  return (
    <div className="flex h-full min-w-0 flex-col gap-3 overflow-y-auto [&>*]:shrink-0">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented id="http-tab" value={tab} onChange={setTab} options={[{ id: 'status', label: 'Status codes' }, { id: 'headers', label: 'Headers' }, { id: 'methods', label: 'Methods' }]} />
        {tab === 'status' && <Segmented id="http-class" size="sm" value={cls} onChange={setCls} options={[{ id: 'all', label: 'All' }, { id: '1', label: '1xx' }, { id: '2', label: '2xx' }, { id: '3', label: '3xx' }, { id: '4', label: '4xx' }, { id: '5', label: '5xx' }]} />}
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: 403, crumb, cors, timeout…" className="ml-auto !w-80 max-w-full" />
      </div>
      {tab === 'status' && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {statuses.map((s, i) => (
            <motion.div key={s.code} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.4) }}>
              <Panel>
                <div className="flex gap-4 p-4">
                  <div className={`font-display text-[2.6rem] leading-none ${toneFor(s.code)}`}>{s.code}</div>
                  <div className="min-w-0">
                    <div className="text-[1.0625rem] font-semibold text-ink">{s.name}</div>
                    <div className="text-[0.9375rem] leading-relaxed text-ink-soft">{s.desc}</div>
                    {s.tip && <div className="mt-1.5 rounded-xl bg-glass px-3 py-1.5 text-[0.875rem] leading-relaxed text-ink-faint">💡 {s.tip}</div>}
                  </div>
                </div>
              </Panel>
            </motion.div>
          ))}
        </div>
      )}
      {tab === 'headers' && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {headers.map((h) => (
            <Panel key={h.name}>
              <div className="flex flex-col gap-1.5 p-4">
                <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-[1rem] font-semibold text-cyan">{h.name}</span><Badge tone={h.dir === 'request' ? 'violet' : h.dir === 'response' ? 'emerald' : 'muted'}>{h.dir}</Badge></div>
                <div className="text-[0.9375rem] text-ink-soft">{h.desc}</div>
                <code className="break-all rounded-lg bg-glass px-2.5 py-1.5 font-mono text-[0.8125rem] text-ink-faint">{h.example}</code>
              </div>
            </Panel>
          ))}
        </div>
      )}
      {tab === 'methods' && (
        <Panel>
          <div className="overflow-x-auto p-2">
            <table className="w-full text-left text-[0.9375rem]">
              <thead className="text-[0.75rem] uppercase tracking-wider text-ink-faint"><tr><th className="px-3 py-2">Method</th><th className="px-3 py-2">Safe</th><th className="px-3 py-2">Idempotent</th><th className="px-3 py-2">Body</th><th className="px-3 py-2">Use</th></tr></thead>
              <tbody>
                {METHODS.map((m) => (
                  <tr key={m.m} className="border-t border-rule-soft">
                    <td className="px-3 py-2.5 font-mono font-bold text-ink">{m.m}</td>
                    {[m.safe, m.idem, m.body].map((v, i) => <td key={i} className={`px-3 py-2.5 ${v ? 'text-emerald' : 'text-ink-faint'}`}>{v ? '✓' : '—'}</td>)}
                    <td className="px-3 py-2.5 text-ink-soft">{m.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  )
}
