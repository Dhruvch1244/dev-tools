import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowsClockwise, CircleNotch, DownloadSimple, Heartbeat, LockKey, Plus, Trash } from '@phosphor-icons/react'
import { listVaultEntries } from '../lib/vaultApi'
import { Badge, Button, EmptyState, Field, Input, Panel, Segmented, SectionLabel, StatTile, Toggle } from '../components/ui'

type Target = { id: string; name: string; env: string; url: string; expect: string }
type Result = { id: string; status: number | null; ms: number; body: string | null; error: string | null; at: number }

const LS = 'devtools.health.targets'
const uid = () => Math.random().toString(36).slice(2, 10)

function load(): Target[] {
  try {
    const raw = localStorage.getItem(LS)
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignore */
  }
  return [
    { id: uid(), name: 'Dev Tools (this app)', env: 'LOCAL', url: `${location.origin}/api/jenkins/servers`, expect: '' },
    { id: uid(), name: 'Demo Jenkins', env: 'LOCAL', url: `${location.origin.replace(/:\d+$/, ':8383')}/demo-jenkins/api/json`, expect: 'jobs' },
  ]
}

function verdict(t: Target, r?: Result): 'up' | 'down' | 'degraded' | 'unknown' {
  if (!r) return 'unknown'
  if (r.error || r.status === null) return 'down'
  if (r.status >= 500) return 'down'
  if (r.status >= 400) return 'degraded'
  if (t.expect && !(r.body ?? '').includes(t.expect)) return 'degraded'
  if (/"status"\s*:\s*"(DOWN|OUT_OF_SERVICE)"/.test(r.body ?? '')) return 'down'
  return r.ms > 2000 ? 'degraded' : 'up'
}

export function HealthBoardPage() {
  const [targets, setTargets] = useState<Target[]>(load)
  const [results, setResults] = useState<Record<string, Result>>({})
  const [history, setHistory] = useState<Record<string, number[]>>({})
  const [busy, setBusy] = useState(false)
  const [auto, setAuto] = useState(false)
  const [every, setEvery] = useState<'15' | '30' | '60'>('30')
  const [env, setEnv] = useState('ALL')
  const [form, setForm] = useState({ name: '', env: 'UAT', url: '', expect: '"UP"' })
  const [note, setNote] = useState<string | null>(null)
  const running = useRef(false)

  useEffect(() => {
    try {
      localStorage.setItem(LS, JSON.stringify(targets))
    } catch {
      /* ignore */
    }
  }, [targets])

  const run = useCallback(async (only?: Target[]) => {
    if (running.current) return
    running.current = true
    setBusy(true)
    const list = only ?? targets
    try {
      const res = await fetch('/api/health-ping', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targets: list.map((t) => ({ id: t.id, url: t.url })) }) })
      const data: { id: string; status: number | null; ms: number; body: string | null; error: string | null }[] = await res.json()
      const at = Date.now()
      setResults((r) => ({ ...r, ...Object.fromEntries(data.filter((d) => d.id).map((d) => [d.id, { ...d, at }])) }))
      setHistory((h) => {
        const n = { ...h }
        for (const d of data) if (d.id) n[d.id] = [...(n[d.id] ?? []), d.error ? -1 : d.ms].slice(-30)
        return n
      })
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Ping failed')
    } finally {
      running.current = false
      setBusy(false)
    }
  }, [targets])

  useEffect(() => {
    if (!auto) return
    run()
    const id = setInterval(() => run(), Number(every) * 1000)
    return () => clearInterval(id)
  }, [auto, every, run])

  async function importVault() {
    try {
      const entries = await listVaultEntries()
      const withUrl = entries.filter((e) => e.url && /^https?:\/\//.test(e.url) && !targets.some((t) => t.url === e.url))
      setTargets((t) => [...t, ...withUrl.map((e) => ({ id: uid(), name: e.name, env: e.environment.toUpperCase(), url: e.url!, expect: '' }))])
      setNote(`Imported ${withUrl.length} URL${withUrl.length === 1 ? '' : 's'} from the Vault`)
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Vault import failed')
    }
  }

  const envs = useMemo(() => ['ALL', ...Array.from(new Set(targets.map((t) => t.env)))], [targets])
  const shown = targets.filter((t) => env === 'ALL' || t.env === env)
  const counts = { up: 0, down: 0, degraded: 0, unknown: 0 }
  shown.forEach((t) => counts[verdict(t, results[t.id])]++)
  const grouped = Array.from(new Set(shown.map((t) => t.env))).map((e) => ({ env: e, items: shown.filter((t) => t.env === e) }))

  return (
    <div className="flex h-full min-w-0 flex-col gap-3 overflow-y-auto [&>*]:shrink-0">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Up" value={counts.up} tone="emerald" />
        <StatTile label="Degraded" value={counts.degraded} tone="warm" />
        <StatTile label="Down" value={counts.down} tone="rose" />
        <StatTile label="Not checked" value={counts.unknown} tone="muted" />
      </div>
      <Panel>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <Button variant="primary" onClick={() => run()} disabled={busy || targets.length === 0}>{busy ? <CircleNotch size={16} className="animate-spin" /> : <Heartbeat size={16} weight="fill" />} Check all</Button>
          <Toggle checked={auto} onChange={setAuto} label="Auto refresh" />
          <Segmented id="health-every" size="sm" value={every} onChange={setEvery} options={[{ id: '15', label: '15s' }, { id: '30', label: '30s' }, { id: '60', label: '60s' }]} />
          <div className="ml-auto flex flex-wrap gap-2">
            <Segmented id="health-env" size="sm" value={env} onChange={setEnv} options={envs.map((e) => ({ id: e, label: e }))} />
            <Button variant="ghost" onClick={importVault}><LockKey size={15} /> Import from Vault</Button>
            <Button variant="ghost" onClick={() => { const b = new Blob([JSON.stringify(targets, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'health-targets.json'; a.click() }}><DownloadSimple size={15} /></Button>
          </div>
          {note && <div className="w-full text-[0.875rem] text-ink-faint">{note}</div>}
        </div>
      </Panel>
      <Panel>
        <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-[1fr_8rem_2fr_10rem_auto]">
          <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Order API" /></Field>
          <Field label="Env"><Input value={form.env} onChange={(e) => setForm({ ...form, env: e.target.value.toUpperCase() })} /></Field>
          <Field label="Health URL"><Input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://orders.uat.mycorp/actuator/health" /></Field>
          <Field label="Body must contain"><Input value={form.expect} onChange={(e) => setForm({ ...form, expect: e.target.value })} /></Field>
          <div className="flex items-end"><Button onClick={() => { setTargets([...targets, { id: uid(), ...form }]); setForm({ ...form, name: '', url: '' }) }} disabled={!form.url}><Plus size={15} /> Add</Button></div>
        </div>
      </Panel>
      {targets.length === 0 && <EmptyState icon={<Heartbeat size={44} weight="duotone" />} title="No endpoints yet">Add your DIT / UAT / PROD health URLs, or import them from the Vault.</EmptyState>}
      {grouped.map((g) => (
        <div key={g.env}>
          <div className="font-display mb-2 text-[1.5rem] text-ink">{g.env}</div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {g.items.map((t, i) => {
              const r = results[t.id]
              const v = verdict(t, r)
              const color = { up: 'bg-emerald', down: 'bg-rose', degraded: 'bg-warm', unknown: 'bg-ink-faint' }[v]
              const h = history[t.id] ?? []
              const max = Math.max(1, ...h)
              return (
                <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <Panel>
                    <div className="flex flex-col gap-2 p-4">
                      <div className="flex items-center gap-2.5">
                        <span className="relative flex h-3.5 w-3.5 shrink-0">
                          {v === 'up' && <span className={`absolute inset-0 animate-ping rounded-full ${color} opacity-50`} />}
                          <span className={`relative h-3.5 w-3.5 rounded-full ${color}`} />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[1rem] font-semibold text-ink">{t.name || t.url}</span>
                        <Badge tone={v === 'up' ? 'emerald' : v === 'down' ? 'rose' : v === 'degraded' ? 'warm' : 'muted'}>{r ? (r.status ?? 'ERR') : '—'}</Badge>
                        <button onClick={() => run([t])} className="text-ink-faint hover:text-ink" aria-label="Check now"><ArrowsClockwise size={15} /></button>
                        <button onClick={() => setTargets(targets.filter((x) => x.id !== t.id))} className="text-ink-faint hover:text-rose" aria-label="Remove"><Trash size={15} /></button>
                      </div>
                      <div className="truncate font-mono text-[0.8125rem] text-ink-faint" title={t.url}>{t.url}</div>
                      <div className="flex h-8 items-end gap-[2px]">
                        {h.map((ms, k) => <div key={k} className={`w-1.5 rounded-sm ${ms < 0 ? 'bg-rose' : ms > 2000 ? 'bg-warm' : 'bg-cyan/70'}`} style={{ height: ms < 0 ? '100%' : `${Math.max(8, (ms / max) * 100)}%` }} title={ms < 0 ? 'error' : `${ms} ms`} />)}
                      </div>
                      {r && <div className="text-[0.8125rem] text-ink-soft">{r.error ? <span className="text-rose">{r.error}</span> : <>{r.ms} ms · {new Date(r.at).toLocaleTimeString()}</>}</div>}
                      {r?.body && <pre className="max-h-24 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-glass p-2 font-mono text-[0.75rem] text-ink-faint">{r.body.slice(0, 400)}</pre>}
                    </div>
                  </Panel>
                </motion.div>
              )
            })}
          </div>
        </div>
      ))}
      <SectionLabel>Pings run server-side from this app (no CORS limits), GET only, 8s timeout.</SectionLabel>
    </div>
  )
}
